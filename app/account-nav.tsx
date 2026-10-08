'use client';
import {useEffect,useState} from 'react';
const ITEMS=[['profile','Edit profile'],['sign-in','Sign-in'],['notifications','Notifications'],['clubs','Club ownership'],['appearance','Appearance'],['delete','Delete account']] as const;
// Section list that stays beside the settings on wide screens and scrolls with the page on phones.
export default function AccountNav({hideClubs=false}:{hideClubs?:boolean}){
 const items=ITEMS.filter(([id])=>!(hideClubs&&id==='clubs')),[active,setActive]=useState('profile');
 useEffect(()=>{const els=items.map(([id])=>document.getElementById(id)).filter(Boolean) as HTMLElement[];if(!els.length||!('IntersectionObserver' in window))return;
  const io=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(visible)setActive(visible.target.id)},{rootMargin:'-20% 0px -65% 0px'});
  els.forEach(el=>io.observe(el));return()=>io.disconnect()},[items.length]); // eslint-disable-line react-hooks/exhaustive-deps
 return <nav className="account-nav" aria-label="Account sections"><p className="account-nav-title">Settings</p><ul>{items.map(([id,label])=><li key={id}><a href={`#${id}`} aria-current={active===id?'true':undefined} onClick={()=>setActive(id)}>{label}</a></li>)}</ul></nav>;
}