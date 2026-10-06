'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
export default function TournamentLiveRefresh(){const router=useRouter();useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')router.refresh();},timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[router]);return <div className="tournament-live-status"><span>Auto refresh · every 15 seconds</span><Button variant="outline" size="sm" onClick={()=>router.refresh()}>Refresh tournament</Button></div>;}
