'use client';

const emptyMedicine = () => ({ name: '', strength: '', dose: '', frequency: '', duration: '', instructions: '' });
const fields = [['name', 'Medicine / دوا'], ['strength', 'Strength / طاقت'], ['dose', 'Dose / خوراک'], ['frequency', 'Frequency / اوقات'], ['duration', 'Duration / مدت'], ['instructions', 'Directions / ہدایات']];

export { emptyMedicine };

export default function VisitPrescriptionEditor({ value, onChange, printUrl, locked }) {
  const update = (key, entry) => onChange({ ...value, [key]: entry });
  return <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="m-0 text-sm font-semibold text-emerald-950">Prescription pad · نسخہ</h3><p className="m-0 mt-1 text-xs text-slate-600">English and Urdu medicines, directions and A4 print.</p></div>{printUrl && <a className="btn secondary" href={printUrl} target="_blank" rel="noreferrer">A4 preview / print</a>}</div>
    {locked ? <p className="m-0 rounded-lg bg-white p-3 text-xs text-amber-800">This prescription has been issued. Create an editable revision in the prescription workspace.</p> : <>
      <label className="block text-xs font-medium">Print language<select value={value.language} onChange={event => update('language', event.target.value)}><option value="bilingual">English + اردو</option><option value="english">English</option><option value="urdu">اردو</option></select></label>
      {value.medications.map((medicine, index) => <div key={index} className="rounded-xl border border-emerald-100 bg-white p-3"><div className="mb-3 flex items-center justify-between"><strong className="text-xs text-emerald-900">Medicine {index + 1}</strong><button className="secondary" type="button" onClick={() => update('medications', value.medications.filter((_, n) => n !== index))}>Remove</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([key, label]) => <label key={key} className="text-xs">{label}<input dir="auto" value={medicine[key] || ''} onChange={event => update('medications', value.medications.map((row, n) => n === index ? { ...row, [key]: event.target.value } : row))}/></label>)}</div></div>)}
      <button className="secondary" type="button" onClick={() => update('medications', [...value.medications, emptyMedicine()])}>Add medicine</button>
      <div className="grid gap-3 md:grid-cols-2"><label className="text-xs">Instructions in English<textarea dir="auto" rows={3} value={value.instructionsEn} onChange={event => update('instructionsEn', event.target.value)}/></label><label className="text-xs">اردو ہدایات<textarea dir="rtl" className="urdu" rows={3} value={value.instructionsUr} onChange={event => update('instructionsUr', event.target.value)}/></label></div>
      <label className="block text-xs">Next review date<input type="date" value={value.reviewDate} onChange={event => update('reviewDate', event.target.value)}/></label>
      <p className="m-0 text-xs text-slate-500">Medicines save as an editable draft with this visit. Review and issue it before sending to the patient.</p>
    </>}
  </div>;
}
