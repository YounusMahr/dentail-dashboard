import {localInstant} from '@/lib/clinic-time.mjs';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';
export async function GET(request) {
 const user=await currentUser();if(user?.role!=='clinic_admin')return fail('Unauthorized',403);
 const query=new URL(request.url).searchParams,range=query.get('range')||'this_month',today=new Date().toLocaleDateString('en-CA',{timeZone:user.timezone||'Asia/Karachi'}),date=new Date(today+'T12:00:00Z');
 let from=today.slice(0,7)+'-01',to=today;
 if(range==='today')from=today;
 if(range==='this_week'){date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));from=date.toISOString().slice(0,10)}
 if(range==='last_month'){date.setUTCDate(0);to=date.toISOString().slice(0,10);from=to.slice(0,7)+'-01'}
 if(range==='this_year')from=today.slice(0,4)+'-01-01';
 if(range==='custom'){from=query.get('from');to=query.get('to')}
 const valid=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 if(!valid(from)||!valid(to)||from>to)return fail('Choose a valid report date range');
 const database=await db(),q={clinicId:user.clinicId},period={createdAt:{$gte:localInstant(from,'00:00',user.timezone),$lte:new Date(localInstant(to,'23:59:59',user.timezone).getTime()+999)}};
 const [invoices,payments,appointments,treatments,doctors,services,allInvoices,patients]=await Promise.all([
 database.collection('invoices').find({...q,...period,status:{$ne:'cancelled'}}).toArray(),database.collection('payments').find({...q,...period}).sort({createdAt:-1}).toArray(),database.collection('appointments').find({...q,deletedAt:{$exists:false},appointmentDate:{$gte:from,$lte:to}}).toArray(),database.collection('treatments').find({...q,...period},{projection:{doctorId:1}}).toArray(),database.collection('doctors').find(q,{projection:{name:1,specialization:1}}).toArray(),database.collection('services').find(q,{projection:{name:1,category:1}}).toArray(),database.collection('invoices').find(q,{projection:{doctorId:1,appointmentId:1,invoiceNumber:1,status:1,balanceAmount:1}}).toArray(),database.collection('patients').find(q,{projection:{name:1}}).toArray()]);
 const sum=(rows,key)=>Math.round(rows.reduce((n,x)=>n+Number(x[key]||0),0)*100)/100;
 const invoiceFor=id=>allInvoices.find(i=>String(i._id)===id),doctorFor=i=>i?.doctorId||appointments.find(a=>String(a._id)===i?.appointmentId)?.doctorId;
 const categories={},procedures={};for(const inv of invoices)for(const item of inv.items||[]){const category=services.find(s=>String(s._id)===item.serviceId)?.category||'General';for(const [map,key] of [[categories,category],[procedures,item.description]]){map[key]??={name:key,amount:0,count:0};map[key].amount+=Number(item.totalPrice||item.quantity*item.unitPrice||0);map[key].count+=Number(item.quantity||0)}}
 const totalBilled=sum(invoices,'totalAmount'),totalPaid=sum(payments,'amount');
 return ok({from,to,currency:user.currency,invoiceCount:invoices.length,totalBilled,totalPaid,discounts:sum(invoices,'discountAmount'),outstanding:sum(invoices,'balanceAmount'),allReceivables:sum(allInvoices.filter(i=>i.status!=='cancelled'),'balanceAmount'),collectionRate:totalBilled?Math.round(totalPaid/totalBilled*1000)/10:0,appointmentCount:appointments.length,completedAppointments:appointments.filter(a=>a.status==='completed').length,cancelledAppointments:appointments.filter(a=>['cancelled','no_show'].includes(a.status)).length,invoiceStatuses:['paid','partially_paid','unpaid'].map(status=>({status,count:invoices.filter(i=>i.status===status).length})),paymentMethods:Object.entries(payments.reduce((m,x)=>(m[x.paymentMethod]=(m[x.paymentMethod]||0)+Number(x.amount),m),{})),doctorPerformance:doctors.map(d=>({name:d.name,specialization:d.specialization,appointments:appointments.filter(a=>a.doctorId===String(d._id)).length,completed:appointments.filter(a=>a.doctorId===String(d._id)&&a.status==='completed').length,treatments:treatments.filter(t=>t.doctorId===String(d._id)).length,billed:sum(invoices.filter(i=>doctorFor(i)===String(d._id)),'totalAmount'),collected:sum(payments.filter(p=>doctorFor(invoiceFor(p.invoiceId))===String(d._id)),'amount')})).sort((a,b)=>b.collected-a.collected),categories:Object.values(categories).sort((a,b)=>b.amount-a.amount),procedures:Object.values(procedures).sort((a,b)=>b.amount-a.amount).slice(0,8),transactions:payments.slice(0,15).map(p=>({_id:p._id,amount:p.amount,method:p.paymentMethod,date:p.createdAt,patient:patients.find(x=>String(x._id)===p.patientId)?.name||'Patient',invoice:invoiceFor(p.invoiceId)?.invoiceNumber||'Invoice'}))});
}
