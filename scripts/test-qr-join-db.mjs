import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runQrJoinRaces } from './qr-join-races.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const name = `dompet-qr-${randomUUID().slice(0,8)}`
const dir = path.join(root,'supabase/tests/qr_join')
const stage = process.argv.includes('--stage') ? process.argv[process.argv.indexOf('--stage')+1] : 'all'
const stages = ['schema','rpc','rls','race','rollback','performance','all']
if (!stages.includes(stage)) throw new Error('Unknown test stage')
const docker = (args,input) => execFileSync('docker',args,{input,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024})
const sql = text => docker(['exec','-i',name,'psql','-X','-h','127.0.0.1','-U','postgres','-d','qr_join_test_local','-v','ON_ERROR_STOP=1','-qAt'],text)
const run = file => { sql(readFileSync(file,'utf8')); console.log(`PASS ${path.basename(file)}`) }
let started = false
try {
 docker(['run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=qr_join_test_local','postgres:17-alpine'])
 started=true
 const deadline=Date.now()+45000
 while(true) {
  try { docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres','-d','qr_join_test_local']); break } catch {
   if(Date.now()>deadline) throw new Error('Postgres readiness deadline exceeded')
   await new Promise(r=>setTimeout(r,200))
  }
 }
 run(path.join(dir,'baseline.sql'))
 const baseline = readFileSync(path.join(dir,'baseline.sql'),'utf8')
 const authShim = baseline.slice(0,baseline.indexOf('create table public.workspaces'))
   .replace('create role anon nologin;','').replace('create role authenticated nologin;','')
 sql('create database qr_join_test_reference;')
 docker(['exec','-i',name,'psql','-X','-h','127.0.0.1','-U','postgres','-d','qr_join_test_reference','-v','ON_ERROR_STOP=1','-qAt'],authShim+readFileSync(path.join(root,'supabase/schema.sql'),'utf8'))
 console.log('PASS historical schema reference applies on clean PostgreSQL')
 run(path.join(dir,'assertions.sql'))
 run(path.join(dir,'fixtures.sql'))
 sql(`begin; set local role authenticated;
 select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000004"}',true);
 insert into public.workspace_members(workspace_id,user_id,role) values('10000000-0000-4000-8000-000000000001',auth.uid(),'admin');
 reset role; select public.test_assert(exists(select 1 from public.workspace_members where user_id='20000000-0000-4000-8000-000000000004' and role='admin'),'pre-cutover direct admission positive control'); rollback;`)
 console.log('PASS baseline positive control: unrestricted enrollment reproduced')
 const md=path.join(root,'supabase/migrations')
 const migrations=existsSync(md)?readdirSync(md).filter(f=>/^20261019000[123]00_qr_join_/.test(f)).sort():[]
 const limit=stage==='schema'||stage==='rollback'?1:stage==='rpc'?2:3
 for(const f of migrations.slice(0,limit)) run(path.join(md,f))
 run(path.join(dir,'fixtures.sql'))
 run(path.join(dir,'schema.sql'))
 if(stage!=='schema'&&stage!=='rollback') {
  sql("update public.app_configs set value='true' where key='qr_join_enabled';")
  for(const f of ['workflow.sql', ...(limit>=2?['flag_gate.sql']:[]), ...(limit===3?['authorization.sql']:[])]) run(path.join(dir,f))
 }
 if(stage==='rollback') {
  run(path.join(dir,'rollback_schema.sql'))
  for(const f of migrations.slice(0,1)) run(path.join(md,f))
  run(path.join(dir,'schema.sql'))
 }
 if(stage==='race'||stage==='all') await runQrJoinRaces({container:name,sql,proveGuards:process.argv.includes('--prove-guards')})
 if(stage==='performance'||stage==='all') run(path.join(dir,'performance.sql'))
 console.log(`QR database stage ${stage}: PASS`)
} finally { if(started) docker(['rm','-f',name]) }
