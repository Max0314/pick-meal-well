# 生产部署

目标主机为 Ubuntu 24.04、Docker Engine 29、Compose 5、宿主机 Nginx。应用使用一个 Next.js 容器，PostgreSQL 和 Redis 各自独立；数据库与缓存不映射宿主机端口。

## 1. 准备 Secret

以下文件由 root 创建，权限设为 `0600`，不进入 Git：

```text
/etc/fribench/postgres_owner_password
/etc/fribench/postgres_app_password
/etc/fribench/database_url
/etc/fribench/migration_database_url
/etc/fribench/redis_password
/etc/fribench/redis_url
/etc/fribench/setup_token
```

内容示例：

```text
database_url:           postgresql://pick_meal_well_app:<URL 编码后的 app 密码>@postgres:5432/pick_meal_well
migration_database_url: postgresql://pick_meal_well_owner:<URL 编码后的 owner 密码>@postgres:5432/pick_meal_well
redis_url:              redis://:<URL 编码后的密码>@redis:6379/0
```

四个密码/令牌都应独立随机生成。应用账户只有业务表 CRUD 权限；owner 连接串只挂载到迁移容器。`setup_token` 只用于首次认领，认领完成后仍保留在服务器 Secret 中，不提供给普通家庭成员。

复制并调整非敏感运行配置：

```bash
sudo install -m 0644 ops/config/pick-meal-well.env.example /srv/fribench/ops/pick-meal-well.env
```

当前 Nginx 只监听 `127.0.0.1:8080` 时保留 `SESSION_COOKIE_SECURE=false`。接入真实 HTTPS 域名后，必须将 `APP_ORIGIN` 改为完整公网源并设为 `true`。

## 2. 构建与启动

每个版本放入独立目录，并让 `current` 指向待发布版本。以下命令不会开放公网端口：

```bash
cd /srv/fribench/apps/pick-meal-well/current
sudo docker compose -f compose.prod.yml config --quiet
sudo docker compose -f compose.prod.yml build --pull
sudo docker compose -f compose.prod.yml up -d
sudo docker compose -f compose.prod.yml ps
curl --fail http://127.0.0.1:3000/api/health/ready
```

新数据库卷首次初始化时会创建无建库、建角色或超级用户权限的 `pick_meal_well_app` 角色。`migrate` 一次性容器会使用 owner 账户等待 PostgreSQL healthy 后应用已提交迁移；只有迁移成功，应用容器才会启动。所有服务使用 10 MB × 3 的 Docker JSON 日志轮转。

本次重构明确不迁移旧数据，因此 Compose 使用带 `pick-meal-well` 和 `v1` 的全新命名卷；旧 PostgreSQL/Redis 卷不会被覆盖或删除。确认新版本稳定并完成备份/恢复演练后，再单独决定是否清理旧卷。

## 3. Nginx

```bash
sudo install -m 0644 ops/nginx/pick-meal-well.conf /etc/nginx/sites-available/pick-meal-well
sudo ln -s /etc/nginx/sites-available/pick-meal-well /etc/nginx/sites-enabled/pick-meal-well
sudo nginx -t
sudo systemctl reload nginx
curl --fail http://127.0.0.1:8080/api/health/ready
```

仓库配置故意只监听回环地址，符合当前“公网仅 SSH 22”的边界。以后公开服务时，应先配置域名、TLS、`APP_ORIGIN` 和 Secure Cookie，再单独评审 UFW 的 80/443 变更；不要直接把应用的 3000 端口开放公网。

## 4. 备份与恢复演练

PostgreSQL 是必须备份的事实源；Redis 仅保存可重建缓存和限流状态。安装脚本和定时器：

```bash
sudo install -m 0700 ops/scripts/backup-postgres.sh /srv/fribench/ops/backup-postgres.sh
sudo install -m 0700 ops/scripts/restore-postgres.sh /srv/fribench/ops/restore-postgres.sh
sudo install -m 0644 ops/systemd/pick-meal-well-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pick-meal-well-backup.timer
sudo systemctl start pick-meal-well-backup.service
```

备份写入 `/srv/fribench/backups`，生成 SHA-256，默认保留 14 天。至少在隔离环境做一次恢复演练：

```bash
sudo CONFIRM_RESTORE=RESTORE /srv/fribench/ops/restore-postgres.sh /srv/fribench/backups/<backup>.sql.gz
```

恢复会替换当前数据库并短暂停止应用，必须先确认备份校验通过。

## 5. 发布与回滚检查

- 发布前：`npm ci && npm run verify`、迁移 SQL review、`docker compose config --quiet`。
- 发布后：`ps` 全部 healthy、ready 200、登录/推荐/接受/采购、手机尺寸、无控制台错误。
- 回滚代码：将 `current` 切回前一版本并重新 `up -d`；若新迁移不向后兼容，先按已演练步骤恢复发布前备份。
- 本仓库的 GitHub deploy workflow 只有在配置 Webhook Secret 时才触发外部部署；本次提交不会自动连接或修改服务器。
