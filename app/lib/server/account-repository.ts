import type {Pool,PoolClient} from 'pg';
import {createHash,randomBytes} from 'node:crypto';
export type Member={householdId:string;name:string;role:'owner'|'member'};
export type Guest={householdId:string;name:string;dataEpoch:string;version:number};
export class AccountAccessError extends Error {status:number;constructor(message:string,status=409){super(message);this.status=status;}}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
export class AccountRepository {
  private pool:Pool;
  constructor(pool:Pool){this.pool=pool;}
  async list(sub:string):Promise<Member[]>{return(await this.pool.query('SELECT m.household_id AS "householdId",h.name,m.role FROM household_members m JOIN households h ON h.id=m.household_id WHERE m.account_id=$1 ORDER BY m.created_at',[sub])).rows;}
  async selected(sub:string):Promise<Member|null>{return(await this.pool.query('SELECT m.household_id AS "householdId",h.name,m.role FROM household_members m JOIN households h ON h.id=m.household_id LEFT JOIN account_selections s ON s.account_id=m.account_id WHERE m.account_id=$1 ORDER BY (m.household_id=s.household_id) DESC NULLS LAST,m.created_at LIMIT 1',[sub])).rows[0]??null;}
  async select(sub:string,household:string){const result=await this.pool.query('INSERT INTO account_selections(account_id,household_id) SELECT account_id,household_id FROM household_members WHERE account_id=$1 AND household_id=$2 ON CONFLICT(account_id) DO UPDATE SET household_id=excluded.household_id RETURNING household_id',[sub,household]);if(!result.rowCount)throw new AccountAccessError('你不是这个家庭的成员',403);}
  async guest(proof:string,client:Pool|PoolClient=this.pool,lock=false):Promise<Guest|null>{if(!proof)return null;return(await client.query(`SELECT h.id AS "householdId",h.name,h.data_epoch AS "dataEpoch",h.version::double precision AS version FROM sessions s JOIN households h ON h.id=s.household_id WHERE s.token_digest=$1 AND s.expires_at>now() AND h.is_guest=true AND NOT EXISTS(SELECT 1 FROM household_members m WHERE m.household_id=h.id) LIMIT 1 ${lock?'FOR UPDATE OF h':''}`,[proof])).rows[0]??null;}
  async claimStatus(sub:string){const row=(await this.pool.query('SELECT household_id AS "householdId",preview_hash AS "previewHash" FROM account_guest_claims WHERE account_id=$1',[sub])).rows[0];return{used:Boolean(row),...row} as {used:boolean;householdId?:string;previewHash?:string};}
  async preview(sub:string,proof:string){if((await this.claimStatus(sub)).used)throw new AccountAccessError('本账号在好好吃饭的游客认领机会已使用');if(await this.selected(sub))throw new AccountAccessError('账号已有家庭空间，不能覆盖');const guest=await this.guest(proof);if(!guest)throw new AccountAccessError('当前浏览器没有可认领的游客厨房');return guest;}
  async claim(sub:string,proof:string,preview:Guest&{previewHash:string}){
    const client=await this.pool.connect();try{
      await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['meal-account:'+sub]);
      const old=(await client.query('SELECT household_id,preview_hash FROM account_guest_claims WHERE account_id=$1',[sub])).rows[0];if(old){if(old.preview_hash!==preview.previewHash)throw new AccountAccessError('本服务游客认领机会已使用');await client.query('COMMIT');return old.household_id as string;}
      if((await client.query('SELECT 1 FROM household_members WHERE account_id=$1 LIMIT 1',[sub])).rowCount)throw new AccountAccessError('账号已有家庭空间，不能覆盖');
      const guest=await this.guest(proof,client,true);if(!guest||guest.householdId!==preview.householdId||guest.version!==preview.version||guest.dataEpoch!==preview.dataEpoch)throw new AccountAccessError('游客厨房已变化，请重新预览');
      await client.query("INSERT INTO household_members(account_id,household_id,role) VALUES($1,$2,'owner')",[sub,guest.householdId]);
      await client.query('INSERT INTO account_selections VALUES($1,$2)',[sub,guest.householdId]);
      await client.query('INSERT INTO account_guest_claims(account_id,household_id,preview_hash) VALUES($1,$2,$3)',[sub,guest.householdId,preview.previewHash]);
      await client.query('UPDATE households SET is_guest=false WHERE id=$1',[guest.householdId]);await client.query('DELETE FROM sessions WHERE household_id=$1',[guest.householdId]);
      await client.query('COMMIT');return guest.householdId;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async create(sub:string|null,id:string,name:string,passcodeHash:string,seed:(client:PoolClient,id:string)=>Promise<void>){
    const client=await this.pool.connect();try{await client.query('BEGIN');if(sub){await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['meal-account:'+sub]);if((await client.query('SELECT 1 FROM household_members WHERE account_id=$1',[sub])).rowCount)throw new AccountAccessError('账号已有厨房，请直接进入或选择家庭');}
      await client.query('INSERT INTO households(id,name,passcode_hash,is_guest) VALUES($1,$2,$3,$4)',[id,name,passcodeHash,!sub]);await seed(client,id);
      if(sub){await client.query("INSERT INTO household_members(account_id,household_id,role) VALUES($1,$2,'owner')",[sub,id]);await client.query('INSERT INTO account_selections VALUES($1,$2)',[sub,id]);}
      await client.query('COMMIT');return id;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async invite(sub:string,householdId:string){const token=randomBytes(32).toString('base64url'),expires=new Date(Date.now()+7*86400000);const row=await this.pool.query("INSERT INTO household_invites(token_hash,household_id,created_by,expires_at) SELECT $1,household_id,account_id,$2 FROM household_members WHERE account_id=$3 AND household_id=$4 AND role='owner' RETURNING household_id",[digest(token),expires,sub,householdId]);if(!row.rowCount)throw new AccountAccessError('只有家庭所有者可以邀请家人',403);return{token,expiresAt:expires.toISOString()};}
  async join(sub:string,token:string){if(!/^[\w-]{43}$/.test(token))throw new AccountAccessError('邀请已失效');const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['meal-account:'+sub]);
      const row=(await client.query('SELECT household_id,uses,max_uses FROM household_invites WHERE token_hash=$1 AND expires_at>now() FOR UPDATE',[digest(token)])).rows[0];if(!row||row.uses>=row.max_uses)throw new AccountAccessError('邀请已失效或已用完');
      const inserted=await client.query("INSERT INTO household_members(account_id,household_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING RETURNING account_id",[sub,row.household_id]);if(inserted.rowCount)await client.query('UPDATE household_invites SET uses=uses+1 WHERE token_hash=$1',[digest(token)]);
      await client.query('INSERT INTO account_selections VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET household_id=excluded.household_id',[sub,row.household_id]);await client.query('COMMIT');return row.household_id as string;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
}
