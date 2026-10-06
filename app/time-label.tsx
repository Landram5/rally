'use client';
import {useSyncExternalStore} from 'react';
const subscribe=()=>()=>{};
const zoneSnapshot=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone=()=>'UTC';
export function TimeLabel({value}:{value?:string|null}){const zone=useSyncExternalStore(subscribe,zoneSnapshot,serverZone);return value?<time dateTime={value}>{new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(new Date(value))} ({zone})</time>:null;}
export function localInput(value?:string|null){if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function utcInput(value:string){return value?new Date(value).toISOString():null;}
