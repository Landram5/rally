import {fixtureLabel} from './fixture-label';
import {outcome,type Fixture} from './tournament-engine';
import type {PublicTournament} from './public-rally';
// What a TV at the venue should show: matches in play, what is next, and the latest results.
export type VenueItem={id:string;label:string;a:string;b:string;court:string;startsAt:string|null;calledAt:string|null;score:string|null;winner:string|null};
export type VenueBoard={nowPlaying:VenueItem[];upNext:VenueItem[];recent:VenueItem[];winners:string[];groupWinners:string[];remaining:number};
export function venueBoard(t:Pick<PublicTournament,'format'|'state'|'fixturePlans'|'entrants'>):VenueBoard{
 const names=new Map(t.entrants.map(p=>[p.id,p.name])),name=(id:string|null)=>id?names.get(id)??'Unknown player':'To be decided',plans=new Map((t.fixturePlans??[]).map(p=>[p.fixture_id,p]));
 const fixtures=t.state?.fixtures??[];
 const item=(f:Fixture):VenueItem=>{const plan=plans.get(f.id),a=f.games.filter(g=>g[0]>g[1]).length,b=f.games.length-a;return {id:f.id,label:fixtureLabel(f,t.format),a:name(f.a),b:name(f.b),court:plan?.court??'',startsAt:plan?.starts_at??null,calledAt:plan?.called_at??null,score:f.status==='played'?`${a}\u2013${b}`:f.status==='forfeit'?'Forfeit':null,winner:f.winner?name(f.winner):null};};
 const ready=fixtures.filter(f=>f.status==='ready'&&f.a&&f.b);
 const byStart=(x:VenueItem,y:VenueItem)=>(x.startsAt??'9999').localeCompare(y.startsAt??'9999');
 const nowPlaying=ready.map(item).filter(i=>i.calledAt).sort((x,y)=>(x.calledAt??'').localeCompare(y.calledAt??'')||x.court.localeCompare(y.court,undefined,{numeric:true}));
 const upNext=ready.map(item).filter(i=>!i.calledAt).sort(byStart);
 const done=fixtures.filter(f=>f.status==='played'||f.status==='forfeit'),recent=[...done].reverse().slice(0,6).map(item);
 return {nowPlaying,upNext,recent,winners:t.state?outcome(t.state).winners.map(name):[],groupWinners:t.state?outcome(t.state).groupWinners.map(name):[],remaining:fixtures.filter(f=>['ready','waiting'].includes(f.status)).length};
}
