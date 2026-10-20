export function money(value, label='Amount') {
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>100000000||Math.abs(n*100-Math.round(n*100))>0.000001)throw new Error(`${label} must be a positive amount with at most two decimals`);
  return Math.round(n*100)/100;
}
export function validDate(value) {
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
export const minutes=value=>Number(value?.slice(0,2))*60+Number(value?.slice(3,5));
export function matchesSlot(entry,slot,duration) {
  return entry.status==='waiting'&&entry.doctorId===slot.doctorId&&entry.earliestDate<=slot.appointmentDate&&entry.latestDate>=slot.appointmentDate&&minutes(entry.earliestTime)<=minutes(slot.startsAt)&&minutes(entry.latestTime)>=minutes(slot.startsAt)+duration&&Number(entry.durationMinutes)<=duration&&(!entry.serviceId||!slot.serviceId||entry.serviceId===slot.serviceId);
}
export function medications(input) {
  if(!Array.isArray(input)||input.length<1||input.length>30)throw new Error('Add 1–30 medicine rows');
  return input.map(row=>{
    const result=Object.fromEntries(['name','strength','dose','frequency','duration','instructions'].map(key=>[key,String(row[key]||'').trim().slice(0,250)]));
    if(!result.name||!result.dose||!result.frequency||!result.duration)throw new Error('Complete medicine, dose, frequency and duration');
    return result;
  });
}
