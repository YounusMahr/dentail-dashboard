import { ObjectId } from 'mongodb';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id } from '@/lib/http';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export async function GET(request, { params }) {
  const user = await currentUser();
  const paymentId = (await params).paymentId;
  if (!user?.clinicId || !id(paymentId)) return fail('Unauthorized', 401);
  const database = await db();
  const payment = await database.collection('payments').findOne({ _id: new ObjectId(paymentId), clinicId: user.clinicId });
  if (!payment) return fail('Receipt not found', 404);
  const [clinic, patient, invoice] = await Promise.all([
    database.collection('clinics').findOne({ _id: new ObjectId(user.clinicId) }),
    database.collection('patients').findOne({ _id: new ObjectId(payment.patientId), clinicId: user.clinicId }),
    database.collection('invoices').findOne({ _id: new ObjectId(payment.invoiceId), clinicId: user.clinicId }),
  ]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payment receipt</title><style>body{font:16px Arial;max-width:650px;margin:45px auto;color:#17343d}h1{color:#087e86}table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #ddd}button{margin-top:30px;padding:10px;border:0;border-radius:8px;background:#0f987b;color:#fff;font-weight:600;cursor:pointer}#send-status{display:block;margin-top:10px;font-size:12px;color:#52616a}@media print{button,#send-status{display:none}}</style></head><body><h1>${escape(clinic?.name)}</h1><h2>Payment receipt</h2><table><tr><td>Receipt</td><td>${escape(payment._id)}</td></tr><tr><td>Invoice</td><td>${escape(invoice?.invoiceNumber)}</td></tr><tr><td>Patient</td><td>${escape(patient?.name)}</td></tr><tr><td>Date</td><td>${escape(payment.createdAt?.toISOString().slice(0, 10))}</td></tr><tr><td>Method</td><td>${escape(payment.paymentMethod)}</td></tr><tr><td>Amount</td><td>${escape(invoice?.currency || clinic?.currency || 'PKR')} ${escape(Number(payment.amount).toLocaleString('en-PK'))}</td></tr></table><button id="print-button" onclick="printReceipt()">Print receipt &amp; send</button><span id="send-status" role="status"></span><script>async function printReceipt(){const button=document.getElementById('print-button'),status=document.getElementById('send-status');button.disabled=true;try{const response=await fetch('/api/print-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'receipt',recordId:'${paymentId}'})});const result=await response.json();status.textContent=response.ok?(result.whatsappQueued||result.emailQueued?'Patient message queued.':'No new message queued; already sent or messaging is off.'):(result.error||'Message could not be queued.');}catch{status.textContent='Message could not be queued.'}finally{button.disabled=false;window.print()}}</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}
