'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
// TV helpers: clock, full-screen toggle, quiet auto-refresh, and hiding site chrome while the display is open.
export default function VenueControls({refreshSeconds=10}:{refreshSeconds?:number}){
 const router=useRouter(),[now,setNow]=useState(''),[full,setFull]=useState(false);
 useEffect(()=>{document.body.classList.add('venue-mode');return()=>document.body.classList.remove('venue-mode');},[]);
 useEffect(()=>{const tick=()=>setNow(new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));tick();const clock=setInterval(tick,5000),refresh=setInterval(()=>router.refresh(),refreshSeconds*1000);return()=>{clearInterval(clock);clearInterval(refresh);};},[router,refreshSeconds]);
 useEffect(()=>{const change=()=>setFull(!!document.fullscreenElement);document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change);},[]);
 const toggle=()=>{try{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen?.();}catch{/* Full screen can be unavailable on some TVs; the page still works. */}};
 return <div className="venue-controls"><span className="venue-clock" aria-label="Current time">{now}</span><button type="button" onClick={toggle} aria-pressed={full}>{full?'Exit full screen':'Full screen'}</button></div>;
}
