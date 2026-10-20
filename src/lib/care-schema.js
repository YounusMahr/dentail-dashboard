export const careSections = {
  plans: { title:'Treatment plans', subtitle:'One connected journey from first consultation to the final smile.', fields:[
    ['patientId','Patient','patient',true],['doctorId','Treating dentist','doctor',true],['title','Treatment name','text',true],
    ['toothNumbers','FDI tooth numbers','teeth'],['totalFee','Agreed fee (PKR)','number',true],['nextReviewDate','Next review date','date'],
    ['summary','Patient-friendly treatment explanation','textarea'],['aftercare','Doctor-approved aftercare','textarea']
  ]},
  sessions:{title:'Treatment sessions',subtitle:'Plan each visit. Track completion and payments separately.',fields:[
    ['planId','Treatment plan','plan',true],['title','Session / procedure','text',true],['scheduledDate','Planned date','date',true],
    ['amountDue','Session fee allocation (PKR)','number',true],['appointmentId','Linked appointment (optional)','appointment'],
    ['notes','Session notes','textarea']
  ]},
  prescriptions:{title:'Prescriptions',subtitle:'Editable drafts. Doctor-approved English and Urdu A4 prescriptions.',clinical:true,fields:[
    ['patientId','Patient','patient',true],['doctorId','Prescribing dentist','doctor',true],['language','Print language','select:english,urdu,bilingual',true],
    ['diagnosis','Diagnosis / reason for visit','textarea'],['instructionsEn','Instructions in English','textarea'],
    ['instructionsUr','اردو ہدایات','urdu'],['reviewDate','Review date','date']
  ]},
  labs:{title:'Dental lab cases',subtitle:'Keep crowns, dentures and aligners ready for the right appointment.',fields:[
    ['patientId','Patient','patient',true],['planId','Treatment plan','plan'],['sessionId','Treatment session','session'],
    ['title','Lab work / appliance','text',true],['labName','Laboratory','text',true],['toothNumbers','FDI tooth numbers','teeth'],
    ['dueDate','Expected delivery','date',true],['cost','Lab cost (PKR)','number',true],['notes','Shade, material and lab instructions','textarea']
  ]},
  waitlist:{title:'Smart waiting list',subtitle:'Match open chair time with patients waiting for a visit.',fields:[
    ['patientId','Patient','patient',true],['doctorId','Preferred dentist','doctor',true],['serviceId','Service','service'],
    ['earliestDate','Available from','date',true],['latestDate','Available until','date',true],
    ['earliestTime','Earliest time','time',true],['latestTime','Latest time','time',true],['durationMinutes','Required chair time (minutes)','number',true],
    ['notes','Availability notes','textarea']
  ]},
  website:{title:'Clinic website',subtitle:'Create, preview and publish your own clinic pages.',admin:true,fields:[
    ['title','Page title','text',true],['slug','Page address (e.g. about-us)','text',true],
    ['description','Search / social description','textarea'],['content','Page content (plain text, paragraph breaks supported)','textarea'],
    ['imageUrl','Hero image URL (HTTPS)','url'],['imageAlt','Image description','text'],['sortOrder','Navigation order','number']
  ]},
};
export const careCollections={plans:'treatmentPlans',sessions:'careSessions',prescriptions:'prescriptions',labs:'labCases',waitlist:'waitingList',website:'clinicPages'};
export const clinicalRoles=['clinic_admin','dentist'];
export const teamRoles=['clinic_admin','dentist','receptionist'];
