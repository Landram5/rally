'use client';
/* eslint-disable @next/next/no-img-element */
import {useState} from 'react';
export default function PlayerAvatar({name,photoUrl,large=false,publicProfile=false}:{name:string;photoUrl?:string|null;large?:boolean;publicProfile?:boolean}){
 const [failed,setFailed]=useState<string|null>(null);
 return <span className={publicProfile?'public-avatar':'avatar '+(large?'large':'')} aria-hidden="true">{photoUrl&&failed!==photoUrl?<img src={photoUrl} alt="" onError={()=>setFailed(photoUrl)}/>:name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span>;
}
