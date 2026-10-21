export const websitePages = [
  ['home', 'Home', '/'], ['about', 'About us', '/about-us'],
  ['services', 'Services', '/services'], ['contact', 'Contact us', '/contact-us'],
];

export const websiteSectionTypes = {
  hero: 'Hero', highlights: 'Contact highlights', introduction: 'Introduction',
  services: 'Featured services', stats: 'Clinic numbers', benefits: 'Why choose us',
  team: 'Dentists', faq: 'Questions & answers', testimonials: 'Patient stories',
  contact: 'Contact details', booking: 'Booking form', cta: 'Call to action',
};

export const defaultWebsite = {
  theme: 'emerald', accent: '#109b89',
  pages: {
    home: { title:'Care that keeps you smiling', description:'Personal dental care, thoughtfully delivered.', sections:[
      {type:'hero',enabled:true,eyebrow:'WELCOME TO YOUR DENTAL HOME',title:'A brighter smile begins with gentle care.',text:'Expert dentistry, clear advice and a team that makes every visit feel easier.',imageUrl:'/clinic/family-hero.webp',buttonText:'Book an appointment'},
      {type:'highlights',enabled:true},
      {type:'introduction',enabled:true,eyebrow:'GET TO KNOW US',title:'Modern dentistry with a personal touch.',text:'From your first visit to your next confident smile, our team takes time to understand what matters to you.',imageUrl:'/clinic/dentist-care.webp',buttonText:'Meet our clinic',items:[{title:'Clear, thoughtful advice'},{title:'Experienced dental team'}]},
      {type:'services',enabled:true,eyebrow:'OUR SERVICES',title:'Complete care for every smile.',text:'Explore the treatments available at our clinic.'},
      {type:'stats',enabled:false,title:'Care you can count on'},
      {type:'benefits',enabled:true,eyebrow:'WHY PATIENTS CHOOSE US',title:'Thoughtful care at every step.',text:'A welcoming space, experienced clinicians and a plan that makes sense for you.',items:[{title:'Care built around you',description:'We listen to your goals before suggesting a next step.'},{title:'A clear treatment path',description:'Understand your options, timing and fees.'},{title:'Easy to plan visits',description:'Choose from available dentist appointment times.'},{title:'Continuity of care',description:'Your clinic team can follow your dental journey.'}]},
      {type:'team',enabled:true,eyebrow:'OUR DENTISTS',title:'The people behind your care.',text:'Meet the professionals who look after your smile.'},
      {type:'faq',enabled:true,eyebrow:'GOOD TO KNOW',title:'Frequently asked questions',items:[{question:'How can I book an appointment?',answer:'Choose a dentist and an available time in the booking form below, or contact the clinic directly.'},{question:'Can I ask about a treatment before booking?',answer:'Yes. Call or email the clinic and the team can guide you through the options.'}]},
      {type:'testimonials',enabled:false,title:'Words from our patients',items:[]},
      {type:'cta',enabled:true,title:'Ready to take the next step?',text:'Choose a convenient time for your visit.',buttonText:'Book now'},
      {type:'booking',enabled:true,title:'Book an appointment',text:'Find a time that works for you.'},
    ]},
    about: {title:'A little more about our clinic',description:'Meet our team and learn how we care for every smile.',sections:[
      {type:'hero',enabled:true,eyebrow:'ABOUT OUR CLINIC',title:'A welcoming place for your smile.',text:'Our team combines thoughtful attention with modern dental care.',imageUrl:'/clinic/dentist-care.webp'},
      {type:'introduction',enabled:true,title:'Your comfort matters.',text:'We believe every patient deserves clear answers and care tailored to their needs.',imageUrl:'/clinic/family-hero.webp',items:[{title:'We listen to you'},{title:'A plan you understand'}]},
      {type:'benefits',enabled:true,title:'What guides our care',text:'We listen, explain your options and plan the next step together.',items:[{title:'We listen first',description:'Your concerns and goals guide the conversation.'},{title:'Clear options',description:'We explain the proposed care, timing and fees.'},{title:'Comfort at every step',description:'We make room for your questions and preferences.'}]},
      {type:'team',enabled:true,title:'Meet the team'},
      {type:'cta',enabled:true,title:'Come and get to know us',buttonText:'Book a visit'},
    ]},
    services: {title:'Care for every stage of your smile',description:'Explore available dental treatments and services.',sections:[
      {type:'hero',enabled:true,eyebrow:'WHAT WE DO',title:'Dental services designed around you.',text:'Find the care you need with guidance from our dental team.',imageUrl:'/clinic/dentist-care.webp'},
      {type:'services',enabled:true,title:'Our services',text:'Fees and durations shown are clinic estimates.'},
      {type:'faq',enabled:true,title:'Questions about treatment?',items:[{question:'Which service should I choose?',answer:'Choose a general consultation if you are unsure. The dentist will discuss suitable options during your visit.'}]},
      {type:'cta',enabled:true,title:'Let us help you choose',buttonText:'Book a consultation'},
    ]},
    contact: {title:'We would love to hear from you',description:'Contact, hours and appointment details.',sections:[
      {type:'hero',enabled:true,eyebrow:'GET IN TOUCH',title:'Let’s start a conversation.',text:'We are here to answer questions and help you plan your next visit.',imageUrl:'/clinic/family-hero.webp'},
      {type:'contact',enabled:true,title:'Visit or contact the clinic',imageUrl:'/clinic/dentist-care.webp'},
      {type:'booking',enabled:true,title:'Plan your visit'},
      {type:'faq',enabled:false,title:'Before your visit',items:[]},
    ]},
  },
};

const simple = (value,max=600) => String(value ?? '').trim().slice(0,max);
const image = value => {
  const url=simple(value,500);
  if(!url)return '';
  if(url.startsWith('/clinic/'))return ['/clinic/family-hero.webp','/clinic/dentist-care.webp'].includes(url)?url:'';
  try { const parsed=new URL(url); return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?url:''; } catch { return ''; }
};
export function cleanWebsite(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid website settings');
  const theme=['emerald','ocean','navy','rose','sand'].includes(input.theme)?input.theme:'emerald';
  const accent=/^#[0-9a-fA-F]{6}$/.test(input.accent||'')?input.accent:'#109b89';
  const pages={};
  for(const [key] of websitePages){
    const source=input.pages?.[key]||{},defaults=defaultWebsite.pages[key];
    if(!Array.isArray(source.sections)||source.sections.length>20)throw new Error(`${key}: sections are required (maximum 20)`);
    const sections=source.sections.map(raw=>{
      if(!raw||!websiteSectionTypes[raw.type])throw new Error('Unknown website section');
      const items=Array.isArray(raw.items)?raw.items.slice(0,8).map(item=>({question:simple(item.question,180),answer:simple(item.answer,650),name:simple(item.name,80),quote:simple(item.quote,650),title:simple(item.title,120),description:simple(item.description,350)})):[];
      return {type:raw.type,enabled:raw.enabled===true,eyebrow:simple(raw.eyebrow,80),title:simple(raw.title,180),text:simple(raw.text,1200),buttonText:simple(raw.buttonText,70),imageUrl:image(raw.imageUrl),items};
    });
    pages[key]={title:simple(source.title||defaults.title,180),description:simple(source.description||defaults.description,300),sections};
  }
  return {theme,accent,pages};
}
export function websiteFor(clinic,preview=false){return preview?(clinic.websiteDraft||clinic.websitePublished||defaultWebsite):(clinic.websitePublished||defaultWebsite)}
