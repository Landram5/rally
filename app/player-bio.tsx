'use client';
import {useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
const TOKEN=/(https?:\/\/[^\s<]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
// Turns plain-text bios into text with safe web and email links (nothing else is interpreted).
function linkify(text:string):ReactNode[]{
 return text.split(TOKEN).map((part,i)=>{
  if(i%2===0)return part;
  const href=part.includes('@')&&!part.startsWith('http')?`mailto:${part}`:part;
  return <a key={i} href={href} {...(href.startsWith('http')?{target:'_blank',rel:'noopener noreferrer nofollow'}:{})}>{part}</a>;
 });
}
export default function PlayerBio({text}:{text:string}){
 const clean=text.replace(/\r\n?/g,'\n').replace(/\n{2,}/g,'\n\n').trim(),long=clean.split('\n').length>3||clean.length>200,[open,setOpen]=useState(false);
 return <div className="player-bio-wrap"><p className={`player-bio${long&&!open?' is-clamped':''}`}>{linkify(clean)}</p>{long&&<button type="button" className="player-bio-toggle" aria-expanded={open} aria-label={open?'Show less of bio':'Show full bio'} title={open?'Show less':'Show more'} onClick={()=>setOpen(v=>!v)}><ChevronDown size={18}/></button>}</div>;
}