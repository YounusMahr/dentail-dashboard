import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { related } from '@/lib/care';
import { fail } from '@/lib/http';
import { prescriptionHtml } from '@/lib/prescription-print';
import { ObjectId } from 'mongodb';
export async function GET(request,{params}){
  const user=await currentUser();if(!['clinic_admin','dentist'].includes(user?.role))return fail('Unauthorized',403);
  try{const database=await db(),record=await related(database,'prescriptions',(await params).recordId,user.clinicId);
    if(user.role==='dentist'&&record.doctorId!==user.doctorId)return fail('Unauthorized',403);
    const [patient,doctor,clinic]=await Promise.all([related(database,'patients',record.patientId,user.clinicId),related(database,'doctors',record.doctorId,user.clinicId),database.collection('clinics').findOne({_id:new ObjectId(user.clinicId)})]);
    return new Response(prescriptionHtml(record,patient,doctor,clinic,{notifyOnPrint:record.status==='issued'}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  }catch(e){return fail(e.message,404)}
}
