import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const wallet = '10000000-0000-4000-8000-000000000001'
const user = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor = (n, expression, label) => `set application_name='${label}'; begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${user(n)}"}',true); select ${expression}; commit;`
const reply = output => output.split(/\r?\n/).filter(x=>x.startsWith('{')).map(x=>JSON.parse(x)).findLast(x=>typeof x.ok==='boolean')

export async function runQrJoinRaces({ container, sql, proveGuards }) {
  const open = () => {
    const proc = spawn('docker',['exec','-i',container,'psql','-X','-h','127.0.0.1','-U','postgres','-d','qr_join_test_local','-v','ON_ERROR_STOP=1','-qAt'],{stdio:'pipe'})
    let output='', errors=''
    proc.stdout.on('data',d=>output+=d)
    proc.stderr.on('data',d=>errors+=d)
    const done = new Promise((resolve,reject)=>{
      proc.on('error',reject)
      proc.on('close',code=>code===0?resolve(output):reject(new Error(errors)))
    })
    // A killed coordinator must not produce an unhandled rejection.
    done.catch(()=>{})
    return { proc, done, output:()=>output }
  }
  const batch = text => { const s=open(); s.proc.stdin.end(text); return s.done }
  const parallel = async expressions => {
    const coordinator=open()
    let workers=[]
    try {
      coordinator.proc.stdin.write(`begin; select pg_advisory_xact_lock(hashtextextended('qr-join:${wallet}',0));\n\\echo QR_LOCK_READY\n`)
      let deadline=Date.now()+15000
      while(!coordinator.output().includes('QR_LOCK_READY')) {
        if(Date.now()>deadline) throw new Error('Race coordinator deadline')
        await new Promise(r=>setTimeout(r,25))
      }
      workers=expressions.map(([n,e],i)=>batch(actor(n,e,`qr_race_${i}`)))
      deadline=Date.now()+15000
      while(Number(sql("select count(*) from pg_stat_activity where application_name like 'qr_race_%' and wait_event_type='Lock';").trim())!==expressions.length) {
        if(Date.now()>deadline) throw new Error('Workers did not reach advisory lock barrier')
        await new Promise(r=>setTimeout(r,25))
      }
      coordinator.proc.stdin.end('commit;\n')
      await coordinator.done
      return (await Promise.all(workers)).map(reply)
    } finally {
      if(!coordinator.proc.stdin.destroyed) coordinator.proc.stdin.end('rollback;\n')
      await Promise.allSettled(workers)
    }
  }
  const invoke = (n,e) => reply(sql(actor(n,e,'qr_setup')))
  const cleanup = () => sql(`delete from public.workspace_members where workspace_id='${wallet}' and user_id='${user(4)}'; delete from public.workspace_join_requests where requester_id='${user(4)}';`)
  const setup = () => {
    cleanup()
    const token=invoke(1,`public.manage_workspace_qr('${wallet}','enable')`).value.invite.token
    const pending=invoke(4,`public.submit_workspace_join_request('${token}',false)`)
    assert.equal(pending.value.request.status,'pending')
    return { token,id:pending.value.request.id }
  }
  const invariant = id => {
    const result=JSON.parse(sql(`select json_build_object('status',r.status,'member',exists(select 1 from public.workspace_members m where m.workspace_id=r.workspace_id and m.user_id=r.requester_id)) from public.workspace_join_requests r where r.id='${id}';`).trim())
    assert.equal(result.member,result.status==='approved','membership must match winning decision')
    return result
  }
  const opposing = async () => {
    const {id}=setup()
    const results=await parallel([[1,`public.decide_workspace_join_request('${id}','approved')`],[2,`public.decide_workspace_join_request('${id}','rejected')`]])
    assert.equal(results[0].value.status,results[1].value.status,'opposing decisions must return the same terminal result')
    invariant(id)
  }
  const same=await parallel([[1,`public.manage_workspace_qr('${wallet}','enable')`],[2,`public.manage_workspace_qr('${wallet}','enable')`]])
  assert.equal(same[0].value.invite.token,same[1].value.invite.token,'concurrent enable creates one QR')
  const token=same[0].value.invite.token
  const submissions=await parallel([[4,`public.submit_workspace_join_request('${token}',false)`],[4,`public.submit_workspace_join_request('${token}',false)`]])
  assert.equal(submissions[0].value.request.id,submissions[1].value.request.id,'concurrent submit creates one request')
  await opposing()
  console.log('PASS real two-session get/submit/opposing-decision races')
  const resetCase=setup()
  await parallel([[1,`public.decide_workspace_join_request('${resetCase.id}','approved')`],[2,`public.manage_workspace_qr('${wallet}','reset')`]])
  assert.ok(['approved','expired'].includes(invariant(resetCase.id).status))
  assert.equal(Number(sql(`select count(*) from public.workspace_invites where workspace_id='${wallet}' and kind='static' and revoked_at is null;`).trim()),1)
  console.log('PASS approval-versus-reset race')
  if(proveGuards) {
    const original=sql("select pg_get_functiondef('public.decide_workspace_join_request(uuid,text)'::regprocedure);")
    const marker="and status = 'pending' returning * into r;"
    assert.equal(original.split(marker).length,2,'mutation must target exactly one pending guard')
    sql(original.replace(marker,'returning * into r;'))
    let caught=false
    try { await opposing() } catch(e) { if(e.code==='ERR_ASSERTION') caught=true; else throw e }
    finally { sql(original) }
    assert.ok(caught,'race probe must reject the unguarded mutant')
    await opposing()
    console.log('PASS positive control: unguarded decision fails, restored guard passes')
  }
  cleanup()
}
