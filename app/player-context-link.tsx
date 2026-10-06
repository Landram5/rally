'use client';
// The origin is available only after hydration; reserve a safe public back link during SSR.
/* eslint-disable react-hooks/set-state-in-effect */
import {useEffect,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
export default function PlayerContextLink({demo=false}:{demo?:boolean}){
 const [back,setBack]=useState(demo?'/demo?tab=players':'/explore?view=players');
 useEffect(()=>{const from=new URLSearchParams(window.location.search).get('from');if(from&&from.length<1500&&/^\/(?:clubhouse|demo|explore|(?:demo\/)?clubs\/[a-zA-Z0-9_-]+)(?:\?[^#]*)?$/.test(from))setBack(from);},[]);
 return <a className="club-back-link" href={back}><ArrowLeft size={20}/>Back to {back.includes('/clubs/')?'club':back.startsWith('/clubhouse')?'clubhouse':back.startsWith('/demo')?'demo':'players'}</a>;
}
