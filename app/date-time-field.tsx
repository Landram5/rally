'use client';
import {useState,useSyncExternalStore} from 'react';
// Apple devices get the native iOS/macOS picker; everything else gets a date input plus a 15-minute time list.
const none=()=>()=>{};
const useApple=()=>useSyncExternalStore(none,()=>/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent),()=>true);
const slots=()=>Array.from({length:96},(_,i)=>`${String(i>>2).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`);
const label=(t:string)=>`${+t.slice(0,2)%12||12}:${t.slice(3)} ${+t.slice(0,2)<12?'AM':'PM'}`;
export function TimeField({id,value,onChange,disabled,blank}:{id?:string;value:string;onChange:(v:string)=>void;disabled?:boolean;blank?:boolean}){
 const apple=useApple();
 if(apple)return <input id={id} type="time" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}/>;
 const options=slots();if(value&&!options.includes(value))options.push(value),options.sort();
 return <select id={id} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{blank&&<option value="">No time set</option>}{options.map(o=><option key={o} value={o}>{label(o)}</option>)}</select>;
}
// Submits `name` as local "YYYY-MM-DDTHH:mm" (or empty), like <input type="datetime-local">.
export function DateTimeField({id,name,defaultValue='',disabled}:{id?:string;name:string;defaultValue?:string;disabled?:boolean}){
 const apple=useApple(),[value,setValue]=useState(defaultValue),[day,time]=value.split('T');
 if(apple)return <input id={id} name={name} type="datetime-local" value={value} disabled={disabled} onChange={e=>setValue(e.target.value)}/>;
 return <span className="date-time-field"><input id={id} type="date" value={day} disabled={disabled} onChange={e=>setValue(e.target.value?`${e.target.value}T${time||'18:00'}`:'')}/><TimeField value={time??''} blank={!day} disabled={disabled||!day} onChange={t=>setValue(`${day}T${t}`)}/><input type="hidden" name={name} value={value}/></span>;
}
