'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
// Keep the fixed iPhone navigation outside the flex tab container and its changing content height.
export default function ClubhouseNavigation({children}:{children:ReactNode}){
 const [mobile,setMobile]=useState(false);
 useEffect(()=>{const query=window.matchMedia('(max-width:700px)');const update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 // Let the browser anchor the bar. Safari's scroll/bounce viewport measurements
 // can disagree mid-gesture; translating a fixed bar from those values makes it jump.
 const navigation=<div className="nav-wrap">{children}</div>;
 return mobile?createPortal(navigation,document.body):navigation;
}
