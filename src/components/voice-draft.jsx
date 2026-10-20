'use client';
import { useState,useRef,useEffect } from 'react';
import { Mic,Square } from 'lucide-react';
export default function VoiceDraft({onText}){
 const [active,setActive]=useState(false),[language,setLanguage]=useState('en-PK'),[error,setError]=useState('');const recognition=useRef(null),callback=useRef(onText);callback.current=onText;
 useEffect(()=>()=>recognition.current?.abort(),[]);
 function start(){
  const API=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!API){setError('Voice dictation is not supported in this browser. You can type or paste your notes below.');return}
  setError('');const r=new API();r.lang=language;r.continuous=true;r.interimResults=false;
  r.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)text+=e.results[i][0].transcript+' ';if(text)callback.current(text.trim())};
  r.onerror=e=>{setError(`Dictation stopped (${e.error}). Typed notes are kept.`);setActive(false)};r.onend=()=>setActive(false);recognition.current=r;r.start();setActive(true);
 }
 return <div className="voice-draft"><div className="row"><Mic size={17}/><strong>Dictate a note</strong><select aria-label="Dictation language" value={language} onChange={e=>setLanguage(e.target.value)} disabled={active}><option value="en-PK">English</option><option value="ur-PK">اردو</option></select><button type="button" className="secondary" onClick={()=>active?recognition.current?.stop():start()}>{active?<><Square size={13}/>Stop recording</>:<><Mic size={13}/>Start dictation</>}</button></div><p>Your browser may process audio through its speech service. Dictation creates a draft only—review names, numbers and clinical details before saving.</p>{error&&<p role="status" className="text-amber-700">{error}</p>}</div>;
}
