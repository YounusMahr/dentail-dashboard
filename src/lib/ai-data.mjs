import {localInstant} from './clinic-time.mjs';
import { ObjectId } from 'mongodb';

// Fixed collection/field allowlists: model output can never become a Mongo query.
const datasets = {
  patients: ['patients', 'createdAt', 'name preferredLanguage', '/dashboard/patients'],
  appointments: ['appointments', 'appointmentDate', 'patientId doctorId appointmentDate startsAt endsAt status', '/dashboard/appointments'],
  invoices: ['invoices', 'createdAt', 'patientId invoiceNumber feeType totalAmount paidAmount balanceAmount dueDate status', '/dashboard/invoices'],
  payments: ['payments', 'createdAt', 'patientId invoiceId sessionId amount paymentMethod createdAt', '/dashboard/invoices'],
  plans: ['treatmentPlans', 'createdAt', 'patientId doctorId title status totalFee toothNumbers', '/dashboard/care/plans'],
  sessions: ['careSessions', 'scheduledDate', 'patientId planId title status scheduledDate amountDue toothNumbers', '/dashboard/care/sessions'],
  labs: ['labCases', 'dueDate', 'patientId title labName dueDate status cost', '/dashboard/care/labs'],
  followups: ['follow-ups', 'dueDate', 'patientId dueDate status', '/dashboard/follow-ups'],
  doctors: ['doctors', 'createdAt', 'name specialization consultationFee active', '/dashboard/doctors'],
};
export const dataTool = { type:'function', function:{ name:'clinic_records', description:'Read live clinic records and exact database totals. All queries are clinic scoped. Date filters apply to dateField in result: payments/invoices/plans use creation date, appointments appointment date, sessions scheduled date, labs/followups due date. Omit dates for all-time. Outstanding invoice balances are current, not historical. Search patients/doctors/plans/labs by name/title; first resolve patient then use patientId. Lists are paginated; totals/count cover ALL matches. No financial profit data. Clinical notes, prescriptions, contact details and credentials are excluded.', parameters:{type:'object',additionalProperties:false,properties:{dataset:{type:'string',enum:Object.keys(datasets)},from:{type:'string',description:'Inclusive YYYY-MM-DD, optional'},to:{type:'string',description:'Inclusive YYYY-MM-DD, optional'},search:{type:'string',description:'Literal name/title search, optional'},patientId:{type:'string'},status:{type:'string',description:'Exact stored status, optional'},outstanding:{type:'boolean',description:'Invoices with balance > 0 only'},offset:{type:'integer',minimum:0,maximum:200}},required:['dataset']}}};
const validDate = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
export async function readClinicData(database, clinicId, args) {
  if (!args || typeof args!=='object' || Array.isArray(args) || !Object.hasOwn(datasets,args.dataset)) throw new Error('Unsupported dataset');
  if(Object.keys(args).some(k=>!['dataset','from','to','search','patientId','status','outstanding','offset'].includes(k)))throw new Error('Unsupported filter');
  for(const k of ['from','to'])if(args[k]!==undefined&&!validDate(args[k]))throw new Error('Use valid YYYY-MM-DD dates');
  if(args.from&&args.to&&args.from>args.to)throw new Error('Date range is reversed');
  if(args.status!==undefined&&(typeof args.status!=='string'||!/^\w{1,40}$/.test(args.status)))throw new Error('Invalid status');
  if(args.patientId!==undefined&&(typeof args.patientId!=='string'||!/^[a-f\d]{24}$/i.test(args.patientId)))throw new Error('Invalid patient ID');
  if(args.search!==undefined&&(typeof args.search!=='string'||args.search.length>80))throw new Error('Invalid search');
  if(args.outstanding!==undefined&&typeof args.outstanding!=='boolean')throw new Error('Invalid balance filter');
  if(args.outstanding&&args.dataset!=='invoices')throw new Error('Outstanding filter is for invoices only');
  const offset=args.offset??0;if(!Number.isInteger(offset)||offset<0||offset>200)throw new Error('Offset must be 0–200');
  const clinic=await database.collection('clinics').findOne({_id:new ObjectId(clinicId)},{projection:{timezone:1,currency:1}}),timezone=clinic?.timezone||'Asia/Karachi',currency=clinic?.currency||'PKR';
  const [collection,dateField,fields,path]=datasets[args.dataset],q={clinicId};
  if(args.from||args.to){q[dateField]={};if(dateField==='createdAt'){
    if(args.from)q[dateField].$gte=localInstant(args.from,'00:00',timezone);
    if(args.to)q[dateField].$lte=new Date(localInstant(args.to,'23:59:59',timezone).getTime()+999);
  }else{if(args.from)q[dateField].$gte=args.from;if(args.to)q[dateField].$lte=args.to}}
  if(args.status)q.status=args.status;
  if(args.patientId){if(args.dataset==='patients')q._id=new ObjectId(args.patientId);else q.patientId=args.patientId}
  if(args.outstanding)q.balanceAmount={$gt:0};
  if(args.search){if(!['patients','doctors','plans','labs'].includes(args.dataset))throw new Error('Resolve patient name with patients dataset first');q[['patients','doctors'].includes(args.dataset)?'name':'title']={$regex:args.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}}
  const projection=Object.fromEntries(fields.split(' ').map(f=>[f,1]));
  const sums=args.dataset==='invoices'?['totalAmount','paidAmount','balanceAmount']:args.dataset==='payments'?['amount']:[];
  const group={_id:null,count:{$sum:1}};for(const field of sums)group[field]={$sum:{$ifNull:['$'+field,0]}};
  const [summary,rows]=await Promise.all([database.collection(collection).aggregate([{$match:q},{$group:group}],{maxTimeMS:5000}).toArray(),database.collection(collection).find(q,{projection,maxTimeMS:5000}).sort({[dateField]:-1,_id:-1}).skip(offset).limit(20).toArray()]);
  const totals=summary[0]||{count:0};delete totals._id;for(const field of sums)totals[field]=Math.round((totals[field]||0)*100)/100;
  const patientIds=[...new Set(rows.map(r=>r.patientId).filter(x=>typeof x==='string'&&ObjectId.isValid(x)))];
  const patients=patientIds.length?await database.collection('patients').find({clinicId,_id:{$in:patientIds.map(id=>new ObjectId(id))}},{projection:{name:1}}).toArray():[];
  const records=rows.map(r=>({...r,_id:String(r._id),...(r.patientId?{patientName:patients.find(p=>String(p._id)===r.patientId)?.name||'Patient unavailable'}:{}),url:args.dataset==='patients'?`${path}/${r._id}`:path}));
  return {dataset:args.dataset,filters:args,dateField,timezone,currency,totals,offset,shown:records.length,hasMore:offset+records.length<totals.count,records,url:path,checkedAt:new Date().toISOString()};
}

