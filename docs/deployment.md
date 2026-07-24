# 生产部署

目标主机为 Ubuntu 24.04、Docker Engine 29、Compose 5、宿主机 Nginx。应用使用一个 Next.js 容器，PostgreSQL 和 Redis 各自独立；数据库与缓存不映射宿主机端口。

## 1. 准备 Secret

以下文件由 root 创建，所有组设为专用的 `fribench-secrets`，权限设为 `0640`，不进入 Git：

```text
/etc/fribench/postgres_owner_password
/etc/fribench/postgres_app_password
/etc/fribench/database_url
/etc/fribench/migration_database_url
/etc/fribench/redis_password
/etc/fribench/redis_url
```

内容示例：

```text
database_url:           postgresql://pick_meal_well_app:<URL 编码后的 app 密码>@postgres:5432/pick_meal_well
migration_database_url: postgresql://pick_meal_well_owner:<URL 编码后的 owner 密码>@postgres:5432/pick_meal_well
redis_url:              redis://:<URL 编码后的密码>@redis:6379/0
```

三个密码都应独立随机生成。应用账户只有业务表 CRUD 权限；owner 连接串只挂载到迁移容器。
迁移容器额外挂载应用账户密码，用于在每次迁移前幂等创建或同步应用角色与默认权限，并在
迁移后补授现有表和序列权限；应用容器不会获得 owner 连接串或明文应用账户密码。
创建家庭不依赖服务器初始化令牌。

Compose 的 file-backed Secret 底层是 bind mount，不能用 `uid`、`gid`、`mode` 长语法
重映射权限。首发脚本因此创建固定 GID `1999` 的 `fribench-secrets` 组，将 Secret 设为
`root:fribench-secrets 0640`，再通过 `group_add` 只给容器补充该 GID。每个服务仍只挂载
自身需要的 Secret；宿主机普通用户不加入该组。GID 已被占用或组名/GID 不一致时脚本会
拒绝继续，可通过 `FRIBENCH_SECRET_GID` 显式选择其他未占用 GID。

复制并调整非敏感运行配置：

```bash
sudo install -m 0644 ops/config/pick-meal-well.env.example /etc/fribench/pick-meal-well.env
```

当前 Nginx 只监听 `127.0.0.1:8080` 时保留 `SESSION_COOKIE_SECURE=false`。Nginx 必须把原始 `Host`（含非默认端口）传给应用，应用据此执行动态同源校验，因此局域网 IP、SSH 隧道和正式域名都不需要配置固定来源白名单。接入真实 HTTPS 域名后必须将 Cookie Secure 设为 `true`。
这份文件只保存非敏感运行参数；数据库和 Redis Secret 仍必须分别保存在上列 `0640` 文件中。

## 2. 构建与启动

每个版本放入独立目录，并让 `current` 指向待发布版本。以下命令不会开放公网端口：

```bash
cd /srv/fribench/apps/web/pick-meal-well/current
sudo docker compose -f compose.prod.yml config --quiet
sudo docker compose -f compose.prod.yml build --pull
sudo docker compose -f compose.prod.yml up -d
sudo docker compose -f compose.prod.yml ps
curl --fail http://127.0.0.1:21001/api/health/ready
```

新数据库卷首次初始化时会创建无建库、建角色或超级用户权限的 `pick_meal_well_app` 角色。`migrate` 一次性容器会使用 owner 账户等待 PostgreSQL healthy 后应用已提交迁移；只有迁移成功，应用容器才会启动。所有服务使用 10 MB × 3 的 Docker JSON 日志轮转。

本次重构明确不迁移旧数据，因此 Compose 使用带 `pick-meal-well` 和 `v1` 的全新命名卷；旧 PostgreSQL/Redis 卷不会被覆盖或删除。确认新版本稳定并完成备份/恢复演练后，再单独决定是否清理旧卷。
Compose 项目、内部后端网络和应用 edge 网络均使用应用专用名称。PostgreSQL、Redis
只连接 `fribench-pick-meal-well-backend-v1`；应用同时连接该内部网络和
`fribench-pick-meal-well-edge-v1`，后者仅用于把应用发布到宿主机
`127.0.0.1:21001`。不要改回旧平台的 `fribench-backend`，否则两个项目的
`postgres`、`redis` DNS 别名会发生冲突。

首次部署可在 `current` 已指向待发布版本后运行：

```bash
cd /srv/fribench/apps/web/pick-meal-well/current
sudo ops/scripts/first-deploy.sh "$PWD"
```

该脚本只在文件不存在时生成独立随机 Secret，不会打印 Secret；它在启动前分别以真实的
非 root `migrate` 和 `app` 用户验证所需 Secret 可读且非空，再完成 Compose 渲染、
镜像构建、迁移、ready 检查、Nginx 切换、备份定时器安装和首次备份。

Fribench 生产 Compose 的依赖构建默认使用 `https://registry.npmmirror.com`，两个 npm
阶段通过 BuildKit cache mount 复用下载内容且不写入最终镜像。可在构建命令环境中用
`NPM_REGISTRY` 覆盖；这不会修改宿主机或账号的全局 npm 配置。镜像选择以服务器实测
HTTPS 下载速度和完整性校验为准，不使用返回明文 HTTP tarball 地址的源。

## 3. Nginx

```bash
sudo install -m 0644 ops/nginx/pick-meal-well.conf /etc/nginx/sites-available/pick-meal-well
sudo ln -sfn /etc/nginx/sites-available/pick-meal-well /etc/nginx/sites-enabled/pick-meal-well
sudo rm -f /etc/nginx/sites-enabled/fribench-private-status
sudo nginx -t
sudo systemctl reload nginx
curl --fail http://127.0.0.1:8080/api/health/ready
```

仓库配置故意只监听回环地址，符合当前“公网仅 SSH 22”的边界。以后公开服务时，应先配置域名、TLS 和 Secure Cookie，再单独评审 UFW 的 80/443 变更；不要直接把应用的 3000 端口开放公网。
旧的 `fribench-private-status` 与本应用占用相同的 `127.0.0.1:8080`，只能在应用的 `127.0.0.1:21001` ready 成功后切换；不能把两个站点同时启用。

## 4. 备份与恢复演练

PostgreSQL 是必须备份的事实源；Redis 仅保存可重建缓存和限流状态。安装定时器：

```bash
sudo install -m 0644 ops/systemd/pick-meal-well-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pick-meal-well-backup.timer
sudo systemctl start pick-meal-well-backup.service
```

备份写入 `/srv/fribench/backups`，生成 SHA-256，默认保留 14 天。至少在隔离环境做一次恢复演练：

```bash
sudo CONFIRM_RESTORE=RESTORE \
  /srv/fribench/apps/web/pick-meal-well/current/ops/scripts/restore-postgres.sh \
  /srv/fribench/backups/<backup>.sql.gz
```

恢复会替换当前数据库并短暂停止应用，必须先确认备份校验通过。
脚本始终从版本化的应用 `current` 目录执行，不向 `/srv/fribench/ops` 运维 Git 工作树写入未跟踪文件。

## 5. 发布与回滚检查

- 发布前：`npm ci && npm run verify`、迁移 SQL review、`docker compose config --quiet`。
- 发布后：`ps` 全部 healthy、ready 200、登录/推荐/接受/采购、手机尺寸、无控制台错误。
- 回滚代码：将 `current` 切回前一版本并重新 `up -d`；若新迁移不向后兼容，先按已演练步骤恢复发布前备份。
- 本仓库的 GitHub deploy workflow 只有在配置 Webhook Secret 时才触发外部部署；本次提交不会自动连接或修改服务器。
