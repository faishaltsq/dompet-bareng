import {createRequire} from 'node:module'
import {createHmac} from 'node:crypto'
import {Readable} from 'node:stream'
import {afterEach,expect,it,vi} from 'vitest'
const require=createRequire(import.meta.url)
type Policy={hold:boolean;expectedProjectId:string;expectedAppIdentifier:string;expectedVersion:string;expectedVersionCode:number;approvedBuildId:string|null;approvedBuildUrl:string|null}
let helper:{verifyEasSignature:(body:Buffer,signature:unknown,secret:unknown)=>boolean;selectPromotableApk:(build:unknown,policy:Policy)=>{buildId:string;url:string}|null;promotionPolicy:(expo:unknown,env:Record<string,string|undefined>)=>Policy}|null=null
try{helper=require('../easApkPromotion.cjs')}catch{}
const id='30000000-0000-4000-8000-000000000001'
const url='https://expo.dev/artifacts/eas/VerifiedApk.apk'
const project='763c45e6-04da-426c-923d-c72da18c1d7c'
const currentVersionCode = require('../../app.json').expo.android.versionCode
const policy:Policy={hold:false,expectedProjectId:project,expectedAppIdentifier:'com.dompetbareng.app',expectedVersion:'1.3.0',expectedVersionCode:currentVersionCode,approvedBuildId:id,approvedBuildUrl:url}
const metadata={appIdentifier:'com.dompetbareng.app',appVersion:'1.3.0',appBuildVersion:String(currentVersionCode),runtimeVersion:'1.3.0',buildProfile:'preview',channel:'preview',distribution:'internal'}
const webhook={id,status:'finished',platform:'android',appId:project,metadata,artifacts:{buildUrl:url}}
const cli={id,status:'FINISHED',platform:'ANDROID',app:{id:project},...metadata,runtime:{version:'1.3.0'},channel:undefined,updateChannel:{name:'preview'},distribution:'INTERNAL',artifacts:{applicationArchiveUrl:url}}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('blocks held builds and accepts the exact approved webhook and CLI artifact',()=>{
 expect(helper,'promotion helper must exist').not.toBeNull()
 expect(helper!.selectPromotableApk(webhook,{...policy,hold:true})).toBeNull()
 expect(helper!.selectPromotableApk(webhook,policy)).toEqual({buildId:id,url})
 expect(helper!.selectPromotableApk(cli,policy)).toEqual({buildId:id,url})
})
it.each([
 {...webhook,status:'errored'}, {...webhook,platform:'ios'}, {...webhook,appId:'wrong-project'},
 {...webhook,id:'30000000-0000-4000-8000-000000000002'},
 ...['appIdentifier','appVersion','appBuildVersion','runtimeVersion','buildProfile','channel','distribution'].map(key=>({...webhook,metadata:{...metadata,[key]:'wrong'}})),
 {...webhook,metadata:{...metadata,buildProfile:'qr-join-qa',channel:'qr-join-qa'}},
 {...webhook,buildProfile:'qr-join-qa'},
 {...webhook,metadata:{}},
 ...['https://evil.example/file.apk','https://expo.dev/artifacts/eas/Other.apk',url.replace('.apk','.aab'),`${url}?token=x`].map(value=>({...webhook,artifacts:{buildUrl:value}})),
])('rejects held, missing, contradictory or unapproved metadata %#',build=>{
 expect(helper!.selectPromotableApk(build,policy)).toBeNull()
})
it('fails closed on missing operator settings',()=>{
 const config=require('../../app.json').expo
 expect(helper!.promotionPolicy(config,{}).hold).toBe(true)
 expect(helper!.selectPromotableApk(webhook,{...policy,approvedBuildId:null})).toBeNull()
 expect(helper!.selectPromotableApk(webhook,{...policy,approvedBuildUrl:null})).toBeNull()
})
it('authenticates original bytes rather than JSON reserialization',()=>{
 const raw=Buffer.from('{ "a": 1 }')
 const secret='synthetic-unit-signing-key'
 const sig=`sha1=${createHmac('sha1',secret).update(raw).digest('hex')}`
 expect(helper!.verifyEasSignature(raw,sig,secret)).toBe(true)
 expect(helper!.verifyEasSignature(Buffer.from('{"a":1}'),sig,secret)).toBe(false)
 expect(helper!.verifyEasSignature(raw,undefined,secret)).toBe(false)
 expect(helper!.verifyEasSignature(raw,sig,undefined)).toBe(false)
})
function serverEnv(hold='false'){
 vi.stubEnv('EAS_WEBHOOK_SIGNING_SECRET','synthetic-unit-signing-key')
 vi.stubEnv('WEBHOOK_APK_SECRET','synthetic-unit-rpc-key')
 vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL','https://example.supabase.co')
 vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY','synthetic-unit-anon-key')
 vi.stubEnv('APK_PROMOTION_HOLD',hold)
 vi.stubEnv('APK_PROMOTION_BUILD_ID',id)
 vi.stubEnv('APK_PROMOTION_BUILD_URL',url)
}
async function invoke(signed:boolean,hold='false',alter=false){
 serverEnv(hold)
 const fetch=vi.fn().mockResolvedValue({ok:true})
 vi.stubGlobal('fetch',fetch)
 const raw=Buffer.from(JSON.stringify(webhook,null,2))
 const signature=`sha1=${createHmac('sha1','synthetic-unit-signing-key').update(raw).digest('hex')}`
 const req=Object.assign(Readable.from([alter?Buffer.concat([raw,Buffer.from(' ')]):raw]),{method:'POST',headers:signed?{'expo-signature':signature}:{}})
 const res={statusCode:200,body:null as any,status(code:number){this.statusCode=code;return this},json(body:unknown){this.body=body;return this}}
 await require('../../api/eas-webhook.js')(req,res)
 return {fetch,res}
}
it('never writes for unsigned callbacks',async()=>{
 const result=await invoke(false)
 expect(result.res.statusCode).toBe(401)
 expect(result.fetch).not.toHaveBeenCalled()
})
it('writes exactly the approved URL for an authentic raw-body callback',async()=>{
 const result=await invoke(true)
 expect(result.res.statusCode).toBe(200)
 expect(result.fetch).toHaveBeenCalledTimes(1)
 expect(JSON.parse(result.fetch.mock.calls[0][1].body)).toEqual({p_url:url,p_secret:'synthetic-unit-rpc-key'})
})
it('acknowledges a held callback without writes',async()=>{
 const result=await invoke(true,'true')
 expect(result.res.body).toMatchObject({ignored:true})
 expect(result.fetch).not.toHaveBeenCalled()
})
it('rejects byte-different request bodies',async()=>{
 const result=await invoke(true,'false',true)
 expect(result.res.statusCode).toBe(401)
 expect(result.fetch).not.toHaveBeenCalled()
})
it('uses the same exact selector in manual sync and requires a build ID',async()=>{
 const {sync}=require('../../scripts/sync-latest-apk.js')
 const fetchImpl=vi.fn().mockResolvedValue({ok:true})
 const getBuild=vi.fn().mockResolvedValue(cli)
 const env={APK_PROMOTION_HOLD:'false',APK_PROMOTION_BUILD_ID:id,APK_PROMOTION_BUILD_URL:url,EXPO_PUBLIC_SUPABASE_URL:'https://example.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',WEBHOOK_APK_SECRET:'synthetic-rpc'}
 await expect(sync({argv:[],env,getBuild,fetchImpl,log:vi.fn()})).rejects.toThrow('build-id')
 await sync({argv:['--build-id',id],env:{...env,APK_PROMOTION_HOLD:'true'},getBuild,fetchImpl,log:vi.fn()})
 expect(getBuild).not.toHaveBeenCalled()
 expect(fetchImpl).not.toHaveBeenCalled()
 await sync({argv:['--build-id',id,'--dry-run'],env,getBuild,fetchImpl,log:vi.fn()})
 expect(fetchImpl).not.toHaveBeenCalled()
 await sync({argv:['--build-id',id],env,getBuild,fetchImpl,log:vi.fn()})
 expect(getBuild).toHaveBeenCalledWith(id)
 expect(fetchImpl).toHaveBeenCalledTimes(1)
})
