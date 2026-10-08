'use client';
import {useEffect} from 'react';
// Gives the page's main landmark an id and offers a "skip to content" link for keyboard users.
export default function SkipLink(){
 useEffect(()=>{const main=document.querySelector('main');if(main&&!main.id)main.id='main-content';},[]);
 return <a className="skip-link" href="#main-content" onClick={e=>{const main=document.querySelector('main');if(main){e.preventDefault();main.setAttribute('tabindex','-1');main.focus();main.scrollIntoView();}}}>Skip to content</a>;
}
