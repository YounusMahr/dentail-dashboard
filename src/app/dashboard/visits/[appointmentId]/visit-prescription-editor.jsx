'use client';

import { ChevronDown, Plus, Printer } from 'lucide-react';

const emptyMedicine = () => ({ name: '', strength: '', dose: '', frequency: '', duration: '', instructions: '' });
const fields = [['name', 'Medicine / دوا'], ['strength', 'Strength / طاقت'], ['dose', 'Dose / خوراک'], ['frequency', 'Frequency / اوقات'], ['duration', 'Duration / مدت'], ['instructions', 'Directions / ہدایات']];

export { emptyMedicine };

export default function VisitPrescriptionEditor({ value, onChange, printUrl, locked }) {
  const update = (key, entry) => onChange({ ...value, [key]: entry });
  const updateMedicine = (index, key, entry) => update('medications', value.medications.map((row, n) => n === index ? { ...row, [key]: entry } : row));
  return <div className="visit-rx-shell">
    <details className="visit-rx-disclosure">
      <summary><span className="visit-rx-summary-copy"><strong>Prescription pad · نسخہ</strong><small>{value.medications.length ? `${value.medications.length} medicine${value.medications.length === 1 ? '' : 's'} · English / Urdu` : 'Add medicines and directions when needed'}</small></span><ChevronDown size={17}/></summary>
      <div className="visit-rx-body">
        {locked ? <p className="m-0 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Issued prescription. Create an editable revision in Prescriptions.</p> : <>
          <div className="visit-rx-toolbar"><label>Print language<select value={value.language} onChange={event => update('language', event.target.value)}><option value="bilingual">English + اردو</option><option value="english">English</option><option value="urdu">اردو</option></select></label><button className="secondary" type="button" onClick={() => update('medications', [...value.medications, emptyMedicine()])}><Plus size={14}/>Add medicine</button></div>
          <div className="visit-rx-medicines">{value.medications.map((medicine, index) => <div key={index} className="visit-rx-medicine"><div className="visit-rx-medicine-heading"><strong>Medicine {index + 1}</strong><button className="secondary" type="button" onClick={() => update('medications', value.medications.filter((_, n) => n !== index))}>Remove</button></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([key, label]) => <label key={key}>{label}<input dir="auto" value={medicine[key] || ''} onChange={event => updateMedicine(index, key, event.target.value)}/></label>)}</div></div>)}</div>
          <div className="visit-rx-extra"><label>Instructions in English<textarea dir="auto" rows={2} value={value.instructionsEn} onChange={event => update('instructionsEn', event.target.value)}/></label><label>اردو ہدایات<textarea dir="rtl" className="urdu" rows={2} value={value.instructionsUr} onChange={event => update('instructionsUr', event.target.value)}/></label><label>Next review date<input type="date" value={value.reviewDate} onChange={event => update('reviewDate', event.target.value)}/></label></div>
          <p className="visit-rx-note">Prescription saves as an editable draft with this visit.</p>
        </>}
      </div>
    </details>
    {printUrl && <a className="btn secondary visit-rx-print" href={printUrl} target="_blank" rel="noreferrer"><Printer size={14}/>A4 print</a>}
  </div>;
}
