'use client';
import { useEffect,useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({title,children,onClose,wide=false}){
 const ref=useRef(null);
 const onCloseRef=useRef(onClose);
 useEffect(()=>{onCloseRef.current=onClose},[onClose]);
 useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';const controls=()=>[...(ref.current?.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')||[])];controls()[0]?.focus();function key(e){if(e.key==='Escape')onCloseRef.current();if(e.key==='Tab'){const items=controls();if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus()}}}document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus()}},[]);
 return <div className="modal-backdrop"><section className={`modal care-dialog ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}><div className="section-heading" style={{marginBottom:14,paddingBottom:10}}><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>{children}</section></div>;
}
