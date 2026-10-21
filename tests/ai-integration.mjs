import assert from 'node:assert/strict';
import {MongoClient,ObjectId} from 'mongodb';
import {randomBytes,scryptSync} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readClinicData} from '../src/lib/ai-data.mjs';
import {answerClinicQuestion} from '../src/lib/ai-assistant.mjs';
import sharp from 'sharp';
import {cleanClinicProfile} from '../src/lib/clinic-profile.mjs';
const name='dentalcare_ai_test_'+Date.now(),client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
let server,passed=0;const origin='http://localhost:3119';
const test=(condition,label)=>{assert(condition,label);console.log('PASS '+(++passed)+': '+label)};
try{
 await client.connect();const database=client.db(name),clinicId=String(new ObjectId()),otherId=String(new ObjectId()),patientId=String(new ObjectId());
 await database.collection('clinics').insertMany([{_id:new ObjectId(clinicId),name:'AI QA Clinic',slug:'account-qa',status:'active'},{_id:new ObjectId(otherId),name:'Other QA',slug:'other-qa',status:'active'}]);
 const password='QA-'+randomBytes(12).toString('hex'),salt=randomBytes(16).toString('hex'),passwordHash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
 await database.collection('users').insertMany([{clinicId,role:'clinic_admin',active:true,name:'QA Admin',email:'ai@qa.invalid',passwordHash},{clinicId,role:'receptionist',active:true,email:'reception@qa.invalid',passwordHash},{clinicId:otherId,role:'clinic_admin',active:true,email:'other@qa.invalid',passwordHash}]);
 await database.collection('patients').insertMany([{_id:new ObjectId(patientId),clinicId,name:'Synthetic Patient',phone:'PRIVATE_PHONE',medicalHistory:'PRIVATE_HISTORY'},{clinicId:otherId,name:'Other Clinic Secret'}]);
 await database.collection('invoices').insertMany(Array.from({length:25},(_,i)=>({clinicId,patientId,invoiceNumber:`QA-${i}`,totalAmount:100,paidAmount:40,balanceAmount:60,status:'partial',createdAt:new Date('2026-10-20T20:00:00Z')})).concat([{clinicId:otherId,totalAmount:999999,balanceAmount:999999}]));
 await database.collection('follow-ups').insertOne({clinicId,patientId,dueDate:'2026-10-21',status:'pending'});
 const result=await readClinicData(database,clinicId,{dataset:'invoices',outstanding:true});
 test(result.totals.balanceAmount===1500&&result.totals.count===25&&result.shown===20&&result.hasMore,'Database totals cover all pages and isolate clinic');
 test((await readClinicData(database,clinicId,{dataset:'invoices',offset:20})).shown===5,'Pagination');
 test((await readClinicData(database,clinicId,{dataset:'invoices',from:'2026-10-21',to:'2026-10-21'})).totals.count===25,'Karachi date boundaries');
 test((await readClinicData(database,clinicId,{dataset:'invoices',to:'2026-10-20'})).totals.count===0,'Date exclusion');
 const patients=JSON.stringify(await readClinicData(database,clinicId,{dataset:'patients'}));test(!patients.includes('PRIVATE_')&&!patients.includes('Other Clinic'),'Patient projection excludes sensitive and other tenant data');
 test((await readClinicData(database,clinicId,{dataset:'followups'})).totals.count===1,'Follow-up collection mapping');
 for(const args of [{dataset:'users'},{dataset:'invoices',clinicId:otherId},{dataset:'patients',search:{$ne:null}},{dataset:'invoices',from:'2026-02-31'},{dataset:'patients',patientId:{$ne:null}},{dataset:'invoices',offset:-1}]){await assert.rejects(()=>readClinicData(database,clinicId,args));passed++}
 test((await readClinicData(database,clinicId,{dataset:'patients',search:'.*'})).totals.count===0,'Regex search escaped');
 let step=0;const fetcher=async()=>({ok:true,json:async()=>({choices:[{message:step++===0?{tool_calls:[{id:'qa',type:'function',function:{name:'clinic_records',arguments:'{"dataset":"invoices","outstanding":true}'}}]}:{content:'Outstanding balance: PKR 1,500.'}}]})});
 const answer=await answerClinicQuestion({database,clinicId,history:[],question:'Balance?',fetcher});test(answer.sources[0].totals.balanceAmount===1500,'Model tool loop grounded in scoped query');
 await assert.rejects(()=>answerClinicQuestion({database,clinicId,history:[],question:'Balance?',fetcher:async()=>({ok:false,status:401})}),/credentials/);passed++;
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3119'],{env:{...process.env,MONGODB_DB:name,NODE_ENV:'production'},windowsHide:true,stdio:'pipe'});let log='';server.stderr.on('data',d=>log+=d);server.stdout.on('data',d=>log+=d);
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin+'/login')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}assert(ready,log);
 async function req(path,{cookie,body,method,originHeader=origin}={}){return fetch(origin+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Origin:originHeader,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})})}
 async function login(email){const r=await req('/api/auth/login',{body:{email,password}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
 const admin=await login('ai@qa.invalid'),other=await login('other@qa.invalid'),reception=await login('reception@qa.invalid');
 test((await req('/api/ai')).status===403,'Anonymous API blocked');test((await req('/api/ai',{cookie:reception})).status===403,'Non-admin API blocked');
 test((await req('/api/ai',{cookie:admin,body:{question:'Hello'},originHeader:'https://evil.invalid'})).status===403,'Cross-origin writes blocked');
 test((await req('/api/ai',{cookie:admin,body:{question:'x'.repeat(2001)}})).status===400,'Input limit');
 const chat=await database.collection('aiChats').insertOne({clinicId,userId:String((await database.collection('users').findOne({email:'ai@qa.invalid'}))._id),title:'Private QA',messages:[]});
 test((await req('/api/ai?id='+chat.insertedId,{cookie:other})).status===404,'Chat tenant isolation');
 test((await req('/api/ai',{cookie:other,body:{id:String(chat.insertedId),question:'Read history'}})).status===404,'Cross-tenant continuation blocked');
 test((await req('/dashboard/ai',{cookie:admin})).status===200,'Assistant UI route renders');
 const profile={name:'Evergreen Dental Studio',bio:'Thoughtful dental care for every smile.',phone:'+92 300 0000000',email:'hello@qa.invalid',address:'12 Clinic Avenue',city:'Lahore',country:'Pakistan',postalCode:'54000',website:'https://example.com',openingHours:'Monday–Saturday: 9 AM–8 PM',whatsappNumber:'+92 300 0000000'};
 test((await req('/api/clinic-settings',{cookie:reception,method:'PATCH',body:profile})).status===403,'Staff cannot edit clinic profile');
 for(const bad of [{name:''},{email:'invalid'},{website:'javascript:alert(1)'},{bio:'x'.repeat(1501)}]){assert.throws(()=>cleanClinicProfile(bad));passed++}
 test((await req('/api/clinic-settings',{cookie:admin,method:'PATCH',body:profile})).status===200,'Clinic details saved');
 const own=await(await req('/api/clinic-settings',{cookie:admin})).json();test(own.clinic.bio===profile.bio&&own.clinic.city==='Lahore','Clinic fields persist');
 const foreign=await(await req('/api/clinic-settings',{cookie:other})).json();test(foreign.clinic.name==='Other QA','Clinic profile tenant isolation');
 test((await req('/api/account',{cookie:admin,method:'PATCH',body:{action:'profile',name:'QA Admin Updated',phone:'03000000000'}})).status===200,'Personal details saved');
 test((await req('/api/account',{cookie:admin,method:'PATCH',body:{currentPassword:'incorrect',password:'Unchanged123'}})).status===403,'Password requires current password');
 async function asset(kind,bytes,cookie=admin,remove=false){const form=new FormData();form.set('kind',kind);if(remove)form.set('remove','true');else form.set('file',new Blob([bytes],{type:'image/png'}),'test.png');return fetch(origin+'/api/clinic-settings/branding',{method:'POST',headers:{Origin:origin,Cookie:cookie},body:form})}
 const png=await sharp({create:{width:128,height:128,channels:4,background:'#168760'}}).png().toBuffer();
 test((await asset('logo',png,reception)).status===403,'Staff cannot upload clinic branding');
 test((await asset('logo',Buffer.from('<svg><script>alert(1)</script></svg>'))).status===400,'Active image content rejected');
 let logo=await asset('logo',png);test(logo.status===200,'Logo upload');const logoUrl=(await logo.json()).url;
 const imageResponse=await fetch(origin+logoUrl),imageBytes=Buffer.from(await imageResponse.arrayBuffer());test(imageResponse.headers.get('content-type')==='image/png'&&(await sharp(imageBytes).metadata()).width===512,'Logo served as sanitised PNG');
 const favicon=await asset('favicon',png);test(favicon.status===200,'Favicon upload');const faviconUrl=(await favicon.json()).url;
 const safeProfile=await(await req('/api/clinic-settings',{cookie:admin})).json();test(safeProfile.clinic.logoUrl===logoUrl&&!JSON.stringify(safeProfile).includes('logoData'),'Settings excludes binary asset fields');
 const publicInfo=await(await req('/api/clinic/account-qa')).json();test(publicInfo.clinic.bio===profile.bio&&publicInfo.clinic.logoUrl===logoUrl,'Public clinic branding and bio');
 const accountHtml=await(await req('/dashboard/account',{cookie:admin})).text();test(accountHtml.includes(faviconUrl.replaceAll('&','&amp;')),'Dashboard favicon metadata');
 const clinicHtml=await(await req('/clinic/account-qa')).text();test(clinicHtml.includes('/favicon?v='),'Public clinic favicon metadata');
 test((await asset('favicon',null,admin,true)).status===200,'Remove branding asset');
 test((await fetch(origin+faviconUrl)).status===404,'Removed favicon no longer served');
 await asset('favicon',png);
 if(process.argv.includes('--live')){
   const response=await req('/api/ai',{cookie:admin,body:{question:'What is the all-time outstanding invoice balance? Use the database totals. Answer in one sentence.'}});
   assert.equal(response.status,200);const events=(await response.text()).trim().split('\n').map(s=>JSON.parse(s));const done=events.find(e=>e.type==='done');assert(done,JSON.stringify(events));test(done.messages[1].sources.some(s=>s.totals.balanceAmount===1500),'LIVE Groq tool call and answer');test(/1[,]?500/.test(done.messages[1].content),'LIVE answer agrees with exact totals');
   const saved=await(await req('/api/ai?id='+done.id,{cookie:admin})).json();test(saved.chat.messages.length===2,'Conversation saved');
   test((await req('/api/ai?id='+done.id,{cookie:admin,method:'DELETE'})).status===200,'Delete own chat');
 }
 if(process.argv.includes('--preview')){console.log(`BROWSER QA ${origin} | ai@qa.invalid | ${password}`);await new Promise(resolve=>process.stdin.once('data',resolve))}
 console.log(`PASS: ${passed} AI checks`);
}finally{if(server){server.kill();await new Promise(r=>setTimeout(r,1000))}if(name.startsWith('dentalcare_ai_test_'))await client.db(name).dropDatabase().catch(()=>{});await client.close()}
