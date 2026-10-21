export const clinicFields={name:150,slug:100,currency:3,timezone:100,bio:1500,phone:40,email:150,address:500,city:100,country:100,postalCode:30,whatsappNumber:40,website:300,openingHours:500,emergencyNotice:1000};
export function cleanClinicProfile(body){
 const data={};for(const [key,max] of Object.entries(clinicFields))if(key in body){if(typeof body[key]!=='string'||body[key].trim().length>max)throw new Error(`${key}: maximum ${max} characters`);data[key]=body[key].trim()}
 if(data.currency&&!['PKR','USD','EUR','GBP','AED','SAR','CAD','AUD'].includes(data.currency))throw new Error('Invalid currency');
 if(data.timezone){try{new Intl.DateTimeFormat('en',{timeZone:data.timezone}).format()}catch{throw new Error('Invalid timezone')}}
 if('slug'in data&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug))throw new Error('Clinic URL must use lowercase letters, numbers and hyphens');
 if('name'in data&&!data.name)throw new Error('Clinic name is required');
 if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw new Error('Enter a valid clinic email');
 for(const key of ['phone','whatsappNumber'])if(data[key]&&!/^\+?[\d\s().-]{7,40}$/.test(data[key]))throw new Error('Enter a valid phone number');
 if(data.website){let url;try{url=new URL(data.website)}catch{throw new Error('Website must be a full https:// URL')}if(url.protocol!=='https:'||url.username||url.password)throw new Error('Website must use HTTPS without credentials')}
 return data;
}
export function brandingUrls(clinic){const id=String(clinic._id);return {logoUrl:clinic.logoVersion?`/api/clinic-brand/${id}/logo?v=${clinic.logoVersion}`:null,faviconUrl:clinic.faviconVersion?`/api/clinic-brand/${id}/favicon?v=${clinic.faviconVersion}`:null}}
export function publicProfile(clinic){return {...Object.fromEntries(Object.keys(clinicFields).map(k=>[k,clinic[k]||''])),slug:clinic.slug,...brandingUrls(clinic)}}
