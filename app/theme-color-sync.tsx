'use client';
import {useEffect} from 'react';
// Keeps the browser/OS chrome (Android status bar, installed-app title bar) in step with the page background
// whenever the user changes Mode (light/dark) or Color.
export default function ThemeColorSync(){
 useEffect(()=>{
  const apply=()=>{
   const color=getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim();if(!color)return;
   document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.remove());
   const meta=document.createElement('meta');meta.name='theme-color';meta.content=color;document.head.appendChild(meta);
  };
  apply();
  const observer=new MutationObserver(apply);observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-palette']});
  return()=>observer.disconnect();
 },[]);
 return null;
}