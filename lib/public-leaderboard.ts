import {profilePhotoUrl} from './profile-photo';
import {loadRatingMatches} from './match-changes';
import {calculateRatings,compareRatedPlayers,initialRating,ESTABLISHED_MATCHES} from './seeding';
// Display only: public ranking built from confirmed results in approved clubs with the unchanged rating model.
export type LeaderboardSort='rating'|'name'|'matches'|'winrate';
export type LeaderboardRow={id:string;name:string;photoUrl:string|null;rank:number|null;rating:number|null;ratedMatches:number;played:number;wins:number;losses:number;established:boolean};
export type PublicLeaderboard={players:LeaderboardRow[];clubs:{id:string;name:string}[];club:string;sort:LeaderboardSort;established:boolean;total:number;hasMore:boolean};
const PAGE=24,SORTS:LeaderboardSort[]=['rating','name','matches','winrate'];
export async function getPublicLeaderboard(db:D1Database,options:{search?:string;club?:string;sort?:string;established?:boolean;page?:number}={}):Promise<PublicLeaderboard>{
 const term='%'+(options.search??'').trim().slice(0,80).replace(/[\\%_]/g,'\\$&')+'%',page=Math.max(1,Math.min(1000,Math.floor(options.page??1)||1)),sort=SORTS.includes(options.sort as LeaderboardSort)?options.sort as LeaderboardSort:'rating',established=!!options.established;
 const clubs=(await db.prepare("SELECT c.id,c.name FROM clubs c WHERE c.approval_status='approved' AND c.id!='unaffiliated' AND EXISTS (SELECT 1 FROM memberships m WHERE m.club_id=c.id AND m.status='active') ORDER BY c.name COLLATE NOCASE,c.id").all<{id:string;name:string}>()).results;
 const club=clubs.some(c=>c.id===options.club)?options.club!:'all';
 const people=(await db.prepare("SELECT p.id,p.name,ph.updated_at AS photo_version,p.initial_rating FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.deleted_at IS NULL AND p.id!='rally-unaffiliated-system' AND p.name LIKE ? ESCAPE '\\' AND (?='all' OR EXISTS (SELECT 1 FROM memberships ms WHERE ms.player_id=p.id AND ms.club_id=? AND ms.status='active')) AND (EXISTS (SELECT 1 FROM memberships ms JOIN clubs c ON c.id=ms.club_id WHERE ms.player_id=p.id AND ms.status='active' AND c.approval_status='approved') OR EXISTS (SELECT 1 FROM entries e JOIN tournaments t ON t.id=e.tournament_id JOIN clubs c ON c.id=t.club_id WHERE e.player_id=p.id AND t.deleted_at IS NULL AND c.approval_status='approved') OR EXISTS (SELECT 1 FROM matches m JOIN clubs c ON c.id=m.club_id WHERE (m.a=p.id OR m.b=p.id) AND m.status='confirmed' AND c.approval_status='approved')) ORDER BY p.name COLLATE NOCASE,p.id LIMIT 2000").bind(term,club,club).all<{id:string;name:string;photo_version:string|null;initial_rating:number|null}>()).results;
 const source=(await loadRatingMatches(db)).filter(m=>club==='all'||m.club_id===club),ratings=calculateRatings(source);
 const record=new Map<string,{wins:number;losses:number}>();
 for(const m of source){const games=(typeof m.games==='string'?JSON.parse(m.games):m.games) as [number,number][],a=games.filter(g=>g[0]>g[1]).length,b=games.length-a;for(const [id,won] of [[m.a,a>b],[m.b,b>a]] as [string,boolean][]){const r=record.get(id)??{wins:0,losses:0};if(won)r.wins++;else r.losses++;record.set(id,r);}}
 const rows:LeaderboardRow[]=people.map(p=>{const r=ratings.get(p.id),rec=record.get(p.id)??{wins:0,losses:0},rated=r?.played??0;return {id:p.id,name:p.name,photoUrl:profilePhotoUrl(p.id,p.photo_version),rank:null,rating:rated?Math.round(r?.rating??initialRating(p.initial_rating)):null,ratedMatches:rated,played:rec.wins+rec.losses,wins:rec.wins,losses:rec.losses,established:rated>=ESTABLISHED_MATCHES};}).filter(p=>!established||p.established);
 const ranked=rows.filter(p=>p.rating!==null).sort((a,b)=>compareRatedPlayers({rating:a.rating!,played:a.ratedMatches,wins:a.wins},{rating:b.rating!,played:b.ratedMatches,wins:b.wins})||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 ranked.forEach((p,i)=>{p.rank=i+1;});
 const byName=(a:LeaderboardRow,b:LeaderboardRow)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id),rate=(p:LeaderboardRow)=>p.played?p.wins/p.played:-1;
 const ordered=sort==='name'?[...rows].sort(byName):sort==='matches'?[...rows].sort((a,b)=>b.played-a.played||byName(a,b)):sort==='winrate'?[...rows].sort((a,b)=>rate(b)-rate(a)||b.played-a.played||byName(a,b)):[...ranked,...rows.filter(p=>p.rating===null).sort(byName)];
 const offset=(page-1)*PAGE;
 return {players:ordered.slice(offset,offset+PAGE),clubs,club,sort,established,total:ordered.length,hasMore:offset+PAGE<ordered.length};
}
