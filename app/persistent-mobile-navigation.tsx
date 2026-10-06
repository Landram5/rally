'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {createPortal} from 'react-dom';
import {LayoutDashboard,Users,CircleDot,Globe2,Trophy,Bell} from 'lucide-react';

export default function PersistentMobileNavigation(){
 const pathname=usePathname()??'/',demo=pathname==='/demo'||pathname.startsWith('/demo/');
 const [mobile,setMobile]=useState(false),[signedIn,setSignedIn]=useState(false);
 useEffect(()=>{const query=window.matchMedia('(max-width:700px)'),update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 useEffect(()=>{
  const controller=new AbortController();let current=true,version=0;
  const refresh=()=>{const request=++version;fetch('/api/auth/session',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)return;const body=await r.json() as {user:unknown};if(current&&request===version)setSignedIn(!!body.user)}).catch(()=>{/* Retain a known session during network errors. */})};
  const resume=()=>{if(document.visibilityState==='visible')refresh()};refresh();window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{current=false;controller.abort();window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)};
 },[pathname]);
 // The clubhouse already renders its interactive tab bar, including unread counts.
 const visible=mobile&&(demo||signedIn)&&pathname!=='/clubhouse'&&pathname!=='/demo'&&!pathname.startsWith('/login')&&!pathname.startsWith('/auth/');
 useEffect(()=>{if(!visible)return;document.body.classList.add('has-persistent-navigation');return()=>document.body.classList.remove('has-persistent-navigation')},[visible]);
 if(!visible)return null;
 const base=demo?'/demo':'/clubhouse';
 const items=[{id:'overview',label:'Overview',Icon:LayoutDashboard},{id:'players',label:'Players',Icon:Users},{id:'matches',label:'Matches',Icon:CircleDot},{id:'clubs',label:'Clubs',Icon:Globe2},{id:'tournaments',label:'Tournaments',Icon:Trophy},{id:'notifications',label:'Inbox',Icon:Bell}];
 const active=pathname.includes('/players/')?'players':pathname.includes('/tournaments/')?'tournaments':pathname==='/clubs'||pathname.includes('/clubs/')?'clubs':pathname==='/announcements'?'notifications':null;
 return createPortal(<nav className="nav-wrap persistent-mobile-navigation" aria-label="Member clubhouse navigation"><div className="main-nav">{items.map(({id,label,Icon})=><a href={`${base}?tab=${id}`} key={id} aria-current={active===id?'page':undefined}><Icon size={19}/><span>{label}</span></a>)}</div></nav>,document.body);
}
