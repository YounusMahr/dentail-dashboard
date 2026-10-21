export const clinicDay = (timezone = 'Asia/Karachi', now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function localInstant(date, time = '00:00', timezone = 'Asia/Karachi') {
  const target = Date.parse(`${date}T${time.length===5?time+':00':time}Z`);
  if (!Number.isFinite(target)) return new Date(NaN);
  let result=target;
  for(let n=0;n<3;n++){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(result)).map(p=>[p.type,p.value]));
    const displayed=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    const delta=target-displayed;if(!delta)break;result+=delta;
  }
  return new Date(result);
}
