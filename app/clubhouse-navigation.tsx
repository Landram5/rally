'use client';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
// Keep the fixed iPhone navigation outside the flex tab container and its changing content height.
export default function ClubhouseNavigation({children}:{children:ReactNode}){
 const [mobile,setMobile]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const query=window.matchMedia('(max-width:700px)');const update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useLayoutEffect(()=>{
  if(!mobile||!ref.current)return;
  const nav=ref.current,viewport=window.visualViewport;
  let frame=0;
  const align=()=>{
   const previous=Number.parseFloat(nav.style.getPropertyValue('--rally-nav-offset'))||0;
   const baseBottom=nav.getBoundingClientRect().bottom-previous;
   // Safari can move its visual viewport when a shorter tab replaces a scrolled page.
   // Correct the actual gap rather than assuming its fixed-position viewport agrees.
   const visibleBottom=viewport&&viewport.scale===1?viewport.offsetTop+viewport.height:window.innerHeight;
   nav.style.setProperty('--rally-nav-offset',`${Math.round(visibleBottom-baseBottom)}px`);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(align);};
  align();schedule();
  const observer=new ResizeObserver(schedule);observer.observe(nav);
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true});
  viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);nav.style.removeProperty('--rally-nav-offset');};
 },[mobile,children]);
 const navigation=<div ref={ref} className="nav-wrap">{children}</div>;
 return mobile?createPortal(navigation,document.body):navigation;
}
