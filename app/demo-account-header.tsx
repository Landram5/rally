'use client';
/* eslint-disable @next/next/no-location-assign-relative-destination */
import {useEffect,useState} from 'react';
import AccountMenu from './account-menu';
import {createDemoData} from '@/lib/demo-state';
export default function DemoAccountHeader(){
 const [person,setPerson]=useState({id:'alex',name:'Alex Morgan'});
 useEffect(()=>{const read=()=>{try{const data=JSON.parse(sessionStorage.getItem('rally-demo-preview')??'null')??createDemoData();if(data.me)setPerson(data.me);}catch{/* Keep the sample identity if browser storage is unavailable. */}};read();window.addEventListener('rally-demo-changed',read);return()=>window.removeEventListener('rally-demo-changed',read);},[]);
 return <AccountMenu demo name={person.name} profileHref={'/demo/players/'+person.id} onReset={()=>{sessionStorage.setItem('rally-demo-preview',JSON.stringify(createDemoData()));window.location.assign('/demo');}}/>;
}
