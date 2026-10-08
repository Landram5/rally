'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useEffect,useState} from 'react';
import {matchStakes,type MatchStakes as Stakes} from '@/lib/match-stakes';
import {ratingEstimates,ESTABLISHED_MATCHES,type SeedMatch} from '@/lib/seeding';
import type {Data} from './rally-app';
import {RatingDelta} from './rating-delta';
// Pre-match "what's at stake": rating change for each possible result, computed by the unchanged rating model.
export default function MatchStakes({a,b,names,bestOf,clubId,date,demoData}:{a:string;b:string;names:[string,string];bestOf:number;clubId:string;date:string;demoData?:Data}){
 const [stakes,setStakes]=useState<Stakes|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{
  setError('');if(!a||!b||a===b||!date){setStakes(null);return;}
  if(demoData){setStakes(matchStakes(demoData.matches as unknown as SeedMatch[],a,b,{bestOf,clubId,playedOn:date},ratingEstimates(demoData.players)));return;}
  let current=true;const controller=new AbortController();setLoading(true);
  const timer=window.setTimeout(()=>{fetch('/api/rally?'+new URLSearchParams({view:'stakes',a,b,club:clubId,bestOf:String(bestOf),date}).toString(),{cache:'no-store',signal:controller.signal}).then(async r=>{const body=await r.json() as Stakes&{error?:string};if(!r.ok)throw new Error(body.error||'Could not estimate the rating change.');if(current)setStakes(body);}).catch(e=>{if(current&&!(e instanceof DOMException&&e.name==='AbortError')){setStakes(null);setError(e instanceof Error?e.message:'Could not estimate the rating change.');}}).finally(()=>{if(current)setLoading(false);});},250);
  return()=>{current=false;controller.abort();window.clearTimeout(timer);};
 },[a,b,bestOf,clubId,date,demoData]);
 if(!a||!b||a===b)return null;
 const first=(n:string)=>n.split(' ')[0],rating=(side:'a'|'b',n:string)=>stakes?`${first(n)} ${stakes.ratings[side]}${stakes.established[side]?'':` (provisional ${stakes.rated[side]}/${ESTABLISHED_MATCHES})`}`:'';
 return <section className="match-stakes" aria-live="polite" aria-label="What is at stake"><h3>What&rsquo;s at stake</h3>
  {error?<p className="footnote" role="status">{error}</p>:!stakes?<p className="footnote" role="status">{loading?'Working out the rating change\u2026':'Choose both players to see the rating change.'}</p>:<>
   <div className="stakes-grid">{([['a',a,names[0],stakes.aWins],['b',b,names[1],stakes.bWins]] as const).map(([,id,name,result])=><div key={id} className="stakes-card"><strong>If {first(name)} wins</strong><span>{first(names[0])} <RatingDelta value={result.a}/></span><span>{first(names[1])} <RatingDelta value={result.b}/></span></div>)}</div>
   <p className="footnote">{rating('a',names[0])} {'\u00b7'} {rating('b',names[1])}. {stakes.weight}. The final change is set when the result is confirmed and also reflects repeat meetings and rating aging. <a href="/ratings">How ratings work</a></p></>}
 </section>;
}
