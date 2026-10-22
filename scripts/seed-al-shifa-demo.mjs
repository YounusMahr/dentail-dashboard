import {MongoClient,ObjectId} from 'mongodb';

const apply=process.argv.includes('--apply');
if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI is missing');
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
const batch='al-shifa-flow-v1';
const serviceRows=[
  {key:'xray',name:'Dental X-ray',category:'General',description:'Digital dental imaging to support diagnosis.',standardFee:1500,durationMinutes:30,includesCheckup:false},
  {key:'root-canal',name:'Root Canal Treatment',category:'Endodontics',description:'Tooth-saving endodontic treatment.',standardFee:9000,durationMinutes:60,includesCheckup:false},
  {key:'extraction',name:'Simple Tooth Extraction',category:'Oral Surgery',description:'Routine extraction after clinical assessment.',standardFee:5000,durationMinutes:30,includesCheckup:false},
];
const patients=[
  {key:'ayesha',name:'Demo · Ayesha Khan',phone:'03000009011',email:'ayesha.demo@example.invalid',service:'xray',note:'Demo: tooth sensitivity; X-ray requested.'},
  {key:'hamza',name:'Demo · Hamza Ali',phone:'03000009012',email:'hamza.demo@example.invalid',service:'root-canal',note:'Demo: persistent molar pain; assessment requested.'},
  {key:'sana',name:'Demo · Sana Malik',phone:'03000009013',email:'sana.demo@example.invalid',service:'extraction',note:'Demo: consultation for an uncomfortable tooth.'},
];
function dateInKarachi(days){const base=new Date();base.setUTCDate(base.getUTCDate()+days);return base.toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'})}
async function main(){
 await client.connect();
 const database=client.db(process.env.MONGODB_DB||'dentists');
 const clinic=await database.collection('clinics').findOne({slug:'al-shifa',name:/^AL shifa$/i});
 if(!clinic)throw new Error('AL shifa clinic was not found; no data changed');
 const clinicId=String(clinic._id),doctor=await database.collection('doctors').findOne({clinicId,active:{$ne:false}});
 if(!doctor)throw new Error('AL shifa needs an active dentist before demo visits can be created');
 const summary={clinic:clinic.name,existing:{},planned:{services:3,patients:3,appointments:3,visitSessions:3,invoices:3,prescriptions:3,treatments:3,'follow-ups':3,payments:2}};
 for(const name of Object.keys(summary.planned))summary.existing[name]=await database.collection(name).countDocuments({clinicId,demoBatchId:batch});
 if(!apply){console.log(JSON.stringify({mode:'preview',...summary},null,2));return}
 const session=client.startSession();
 try{await session.withTransaction(async()=>{
   const now=new Date(),services={};
   if(clinic.newPatientCheckupFee===undefined)await database.collection('clinics').updateOne({_id:clinic._id},{$set:{newPatientCheckupFee:500,updatedAt:now}},{session});
   for(const row of serviceRows){const {_id}=await database.collection('services').findOneAndUpdate({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,name:row.name,category:row.category,description:row.description,standardFee:row.standardFee,durationMinutes:row.durationMinutes,includesCheckup:row.includesCheckup,active:true,createdAt:now,updatedAt:now}},{session,upsert:true,returnDocument:'after'});services[row.key]={_id,name:row.name,standardFee:row.standardFee}}
   await database.collection('services').updateOne({clinicId,name:'Consultation & Dental Checkup'},{$set:{includesCheckup:true,updatedAt:now}},{session});
   for(let index=0;index<patients.length;index++){
     const row=patients[index],service=services[row.service];
     const patient=await database.collection('patients').findOneAndUpdate({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,name:row.name,phone:row.phone,email:row.email,whatsappConsent:false,emailConsent:false,marketingConsent:false,preferredLanguage:'en',createdAt:now,updatedAt:now}},{session,upsert:true,returnDocument:'after'});
     let dayOffset=4+index,date=dateInKarachi(dayOffset),time=['11:00','12:00','13:00'][index];
     while(true){const weekday=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)).toLowerCase();const conflict=await database.collection('appointments').findOne({clinicId,doctorId:String(doctor._id),appointmentDate:date,startsAt:time,status:{$nin:['cancelled','rescheduled']}},{session});if((!doctor.workingDays||doctor.workingDays.split(',').includes(weekday))&&!conflict)break;date=dateInKarachi(++dayOffset)}
     const fee=Number(service.standardFee)+Number(clinic.newPatientCheckupFee??500),invoiceKey=`INV-DEMO-${String(index+1).padStart(2,'0')}-${clinicId.slice(-6)}`;
     const appointment=await database.collection('appointments').findOneAndUpdate({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,patientId:String(patient._id),doctorId:String(doctor._id),serviceId:String(service._id),chairName:doctor.chairName||'',appointmentDate:date,startsAt:time,endsAt:`${String(Number(time.slice(0,2))+Math.floor(Number(doctor.slotMinutes||30)/60)).padStart(2,'0')}:${String((Number(time.slice(3))+Number(doctor.slotMinutes||30))%60).padStart(2,'0')}`,status:'confirmed',patientNotes:row.note,createdAt:now,updatedAt:now}},{session,upsert:true,returnDocument:'after'});
     const paid=[0,1000,fee][index],status=paid===0?'unpaid':paid===fee?'paid':'partially_paid';
     const invoice=await database.collection('invoices').findOneAndUpdate({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,patientId:String(patient._id),doctorId:String(doctor._id),appointmentId:String(appointment._id),visitInvoiceKey:String(appointment._id),feeType:'treatment',currency:'PKR',invoiceNumber:invoiceKey,items:[{serviceId:String(service._id),description:service.name,quantity:1,unitPrice:Number(service.standardFee),totalPrice:Number(service.standardFee)},{serviceId:'',description:'New patient dental checkup',quantity:1,unitPrice:Number(clinic.newPatientCheckupFee??500),totalPrice:Number(clinic.newPatientCheckupFee??500)}],description:`${service.name}, New patient dental checkup`,discountAmount:0,totalAmount:fee,paidAmount:paid,balanceAmount:fee-paid,status,dueDate:date,createdAt:now,updatedAt:now}},{session,upsert:true,returnDocument:'after'});
     await database.collection('visitSessions').updateOne({clinicId,appointmentId:String(appointment._id)},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,appointmentId:String(appointment._id),patientId:String(patient._id),doctorId:String(doctor._id),serviceId:String(service._id),invoiceId:String(invoice._id),scheduledDate:date,startsAt:time,status:'scheduled',createdAt:now,updatedAt:now}},{session,upsert:true});
     await database.collection('prescriptions').updateOne({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,appointmentId:String(appointment._id),patientId:String(patient._id),doctorId:String(doctor._id),language:'bilingual',diagnosis:'',instructionsEn:'',instructionsUr:'',medications:[],status:'draft',revision:1,createdAt:now,updatedAt:now}},{session,upsert:true});
     await database.collection('treatments').updateOne({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,appointmentId:String(appointment._id),patientId:String(patient._id),doctorId:String(doctor._id),serviceId:String(service._id),diagnosis:'Demo record — clinician review pending',treatmentRendered:'Demo consultation request; no procedure recorded',clinicalNotes:'Synthetic sample for workflow review only.',createdAt:now,updatedAt:now}},{session,upsert:true});
     await database.collection('follow-ups').updateOne({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,patientId:String(patient._id),dueDate:date,reason:`Confirm ${service.name.toLowerCase()} appointment`,status:'pending',staffNotes:'Demo follow-up; do not contact.',createdAt:now,updatedAt:now}},{session,upsert:true});
     if(index>0)await database.collection('payments').updateOne({clinicId,demoBatchId:batch,demoKey:row.key},{$setOnInsert:{clinicId,demoBatchId:batch,demoKey:row.key,invoiceId:String(invoice._id),patientId:String(patient._id),amount:paid,paymentMethod:'cash',transactionReference:'DEMO — no money collected',createdAt:now,updatedAt:now}},{session,upsert:true});
   }
 })}finally{await session.endSession()}
 for(const name of Object.keys(summary.planned))summary.existing[name]=await database.collection(name).countDocuments({clinicId,demoBatchId:batch});
 console.log(JSON.stringify({mode:'applied',...summary},null,2));
}
try{await main()}finally{await client.close()}
