'use client';
import {useEffect,useState,type CSSProperties} from 'react';
export function useVisibleViewport(){
 const [style,setStyle]=useState<CSSProperties>({});
 useEffect(()=>{
  const viewport=window.visualViewport;
  const update=()=>setStyle({'--visible-height':`${viewport?.height??window.innerHeight}px`,'--visible-top':`${viewport?.offsetTop??0}px`} as CSSProperties);
  update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
  return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[]);
 return style;
}
