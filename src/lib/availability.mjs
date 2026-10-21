import {localInstant} from './clinic-time.mjs';
export const chairDays=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const minutes=value=>Number(value?.slice(0,2))*60+Number(value?.slice(3,5));
const clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
export function chairSlots(doctor,date,appointments,now=new Date(),timezone='Asia/Karachi'){
 if(!doctor?.active||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return [];
 const day=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)).toLowerCase();
 if(doctor.workingDays&&!doctor.workingDays.split(',').map(s=>s.trim()).includes(day))return [];
 const start=minutes(doctor.startTime||'10:00'),end=minutes(doctor.endTime||'20:00'),duration=Number(doctor.slotMinutes||30),breakStart=minutes(doctor.breakStart),breakEnd=minutes(doctor.breakEnd);
 if(!Number.isInteger(duration)||duration<10||duration>180||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
 const slots=[];for(let t=start;t+duration<=end;t+=duration){const time=clock(t);if(localInstant(date,time,timezone)<=now)continue;if(doctor.breakStart&&doctor.breakEnd&&t<breakEnd&&t+duration>breakStart)continue;
   if(appointments.some(a=>a.status!=='cancelled'&&a.status!=='rescheduled'&&t<minutes(a.endsAt||clock(minutes(a.startsAt)+30))&&t+duration>minutes(a.startsAt)))continue;
   slots.push(time)
 }return slots;
}
