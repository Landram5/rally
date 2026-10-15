'use client';
import {useEffect} from 'react';
// Gives the page's main landmark an id and offers a "skip to content" link for keyboard users.
export default function SkipLink(){
 // The clubhouse swaps its <main> after loading, so keep the target id on whichever <main> is current.
 useEffect(()=>{
  const mark=()=>{const main=document.querySelector('main');if(main&&!main.id)main.id='main-content';};
  mark();const watch=new MutationObserver(mark);watch.observe(document.body,{childList:true,subtree:true});return()=>watch.disconnect();
 },[]);
 return <a className="skip-link" href="#main-content" onClick={e=>{const main=document.querySelector('main');if(main){e.preventDefault();main.setAttribute('tabindex','-1');main.focus();main.scrollIntoView();}}}>Skip to content</a>;
}
