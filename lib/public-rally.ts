import {profilePhotoUrl} from './profile-photo';
import type {Draw} from './tournament-engine';
import {loadRatingChanges,loadRatingMatches} from './match-changes';
import {ESTABLISHED_MATCHES,ratingChangesByMatch,ratingHistory} from './seeding';
import {playerHighlights,type PlayerHighlights} from './player-highlights';
import type {H2HMeeting} from './head-to-head';

export type PublicPlayerMatch={
 id:string;clubId:string;clubName:string;opponentId:string;opponentName:string;
 games:[number,number][];bestOf:number;playedOn:string;tournamentId:string|null;
 playerSide:0|1;ratingChange?:number;
};

export type PublicPlayer={
 id:string;name:string;isGuest:boolean;photoUrl:string|null;bio:string;
 clubs:{id:string;name:string;location:string}[];
 matches:PublicPlayerMatch[];highlights?:PlayerHighlights;rating?:{value:number;ratedMatches:number;established:boolean};
};

export type PublicTournament={estimatedEndsAt?:string|null;allowVisitors?:boolean;waitlistCount?:number;
 id:string;name:string;date:string;format:string;capacity:number;
 registrationClosesAt?:string|null;startsAt?:string|null;fixturePlans?:{fixture_id:string;court:string;starts_at:string|null;ends_at?:string|null;called_at?:string|null}[];status:'registration'|'active'|'completed';bestOf:number;revision:number;
 club:{id:string;name:string;location:string};
 teamSize?:number;entrants:{id:string;name:string;isGuest:boolean;isTeam?:boolean;members?:{id:string;name:string}[]}[];ratingChanges?:Record<string,number>;
 state:Draw|null;
};

const validId=(value:string)=>/^[a-zA-Z0-9_-]{1,80}$/.test(value);

export type PublicDirectory={tournaments:{id:string;name:string;date:string;format:string;status:string;clubName:string;entrants:number}[];players:{id:string;name:string;photoUrl:string|null;played:number}[];matches:{id:string;a:string;b:string;aName:string;bName:string;clubName:string;playedOn:string;games:[number,number][];tournamentId:string|null}[];hasMore:boolean};
export async function getPublicDirectory(db:D1Database,view:'tournaments'|'players'|'matches',search='',page=1):Promise<PublicDirectory>{
 const result:PublicDirectory={tournaments:[],players:[],matches:[],hasMore:false};
 const term='%'+search.trim().slice(0,80).replace(/[\\%_]/g,'\\$&')+'%',offset=(Math.max(1,Math.min(1000,Math.floor(page)||1))-1)*24;
 if(view==='tournaments'){
  const rows=(await db.prepare("SELECT t.id,t.name,t.date,t.format,t.status,c.name AS clubName,((SELECT count(*) FROM entries e WHERE e.tournament_id=t.id)+(SELECT count(*) FROM doubles_teams d WHERE d.tournament_id=t.id)) AS entrants FROM tournaments t JOIN clubs c ON c.id=t.club_id WHERE t.deleted_at IS NULL AND c.approval_status='approved' AND (t.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\') ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'registration' THEN 1 ELSE 2 END,t.date DESC,t.id LIMIT 25 OFFSET ?").bind(term,term,offset).all<PublicDirectory['tournaments'][number]>()).results;
  result.hasMore=rows.length>24;result.tournaments=rows.slice(0,24);
 }else if(view==='players'){
  const rows=(await db.prepare("SELECT p.id,p.name,ph.updated_at AS photo_version,(SELECT count(*) FROM matches m JOIN clubs c ON c.id=m.club_id WHERE m.status='confirmed' AND c.approval_status='approved' AND (m.a=p.id OR m.b=p.id)) AS played FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.deleted_at IS NULL AND p.name LIKE ? ESCAPE '\\' AND (EXISTS (SELECT 1 FROM memberships ms JOIN clubs c ON c.id=ms.club_id WHERE ms.player_id=p.id AND ms.status='active' AND c.approval_status='approved') OR EXISTS (SELECT 1 FROM entries e JOIN tournaments t ON t.id=e.tournament_id JOIN clubs c ON c.id=t.club_id WHERE e.player_id=p.id AND t.deleted_at IS NULL AND c.approval_status='approved') OR EXISTS (SELECT 1 FROM matches m JOIN clubs c ON c.id=m.club_id WHERE (m.a=p.id OR m.b=p.id) AND m.status='confirmed' AND c.approval_status='approved')) ORDER BY p.name COLLATE NOCASE,p.id LIMIT 25 OFFSET ?").bind(term,offset).all<{id:string;name:string;photo_version:string|null;played:number}>()).results;
  result.hasMore=rows.length>24;result.players=rows.slice(0,24).map(p=>({id:p.id,name:p.name,photoUrl:profilePhotoUrl(p.id,p.photo_version),played:p.played}));
 }else{
  const rows=(await db.prepare("SELECT m.id,m.a,m.b,pa.name AS aName,pb.name AS bName,c.name AS clubName,m.played_on AS playedOn,m.games,m.tournament_id AS tournamentId FROM matches m JOIN clubs c ON c.id=m.club_id JOIN profiles pa ON pa.id=m.a JOIN profiles pb ON pb.id=m.b WHERE m.status='confirmed' AND c.approval_status='approved' AND (pa.name LIKE ? ESCAPE '\\' OR pb.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\') ORDER BY m.played_on DESC,m.created_at DESC,m.id LIMIT 25 OFFSET ?").bind(term,term,term,offset).all<Omit<PublicDirectory['matches'][number],'games'>&{games:string}>()).results;
  result.hasMore=rows.length>24;result.matches=rows.slice(0,24).map(m=>({...m,games:JSON.parse(m.games)}));
 }
 return result;
}

export async function getPublicPlayer(db:D1Database,playerId:string):Promise<PublicPlayer|null>{
 if(!validId(playerId)||playerId==='rally-unaffiliated-system')return null;const alias=await db.prepare('SELECT merged_into FROM profiles WHERE id=?').bind(playerId).first<{merged_into:string|null}>();if(alias?.merged_into)return getPublicPlayer(db,alias.merged_into);
 const profile=await db.prepare('SELECT p.id,p.name,p.bio,p.auth_id IS NULL AS is_guest,ph.updated_at AS photo_version FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.id=? AND p.deleted_at IS NULL').bind(playerId).first<{id:string;name:string;is_guest:number;bio:string;photo_version:string|null}>();
 if(!profile)return null;
 const clubs=(await db.prepare("SELECT c.id,c.name,c.location FROM clubs c JOIN memberships m ON m.club_id=c.id WHERE m.player_id=? AND m.status='active' AND c.approval_status='approved' ORDER BY c.name").bind(playerId).all<{id:string;name:string;location:string}>()).results;
 const rows=(await db.prepare("SELECT m.id,m.club_id,c.name AS club_name,m.a,m.b,pa.name AS a_name,pb.name AS b_name,m.games,m.best_of,m.played_on,m.tournament_id FROM matches m JOIN clubs c ON c.id=m.club_id JOIN profiles pa ON pa.id=m.a JOIN profiles pb ON pb.id=m.b WHERE m.status='confirmed' AND c.approval_status='approved' AND (m.a=? OR m.b=?) ORDER BY m.played_on DESC,m.created_at DESC").bind(playerId,playerId).all<{id:string;club_id:string;club_name:string;a:string;b:string;a_name:string;b_name:string;games:string;best_of:number;played_on:string;tournament_id:string|null}>()).results;
 const rated=await loadRatingMatches(db),changes=ratingChangesByMatch(rated),names=new Map(rows.flatMap(m=>[[m.a,m.a_name],[m.b,m.b_name]] as [string,string][])),history=ratingHistory(rated,playerId),highlights=playerHighlights(history.changes);if(highlights.biggestUpset)highlights.biggestUpset.opponentName=names.get(highlights.biggestUpset.opponentId);
 return {rating:history.changes.length?{value:Math.round(history.rating),ratedMatches:history.played,established:history.played>=ESTABLISHED_MATCHES}:undefined,highlights,id:profile.id,name:profile.name,isGuest:!!profile.is_guest,photoUrl:profilePhotoUrl(profile.id,profile.photo_version),bio:profile.bio,clubs,matches:rows.map(m=>({ratingChange:changes[m.id]?.[playerId],id:m.id,clubId:m.club_id,clubName:m.club_name,opponentId:m.a===playerId?m.b:m.a,opponentName:m.a===playerId?m.b_name:m.a_name,games:JSON.parse(m.games),bestOf:m.best_of,playedOn:m.played_on,tournamentId:m.tournament_id,playerSide:m.a===playerId?0:1}))};
}

export async function getPublicTournament(db:D1Database,tournamentId:string):Promise<PublicTournament|null>{
 if(!validId(tournamentId))return null;
 const event=await db.prepare("SELECT t.*,c.name AS club_name,c.location AS club_location FROM tournaments t JOIN clubs c ON c.id=t.club_id WHERE t.id=? AND t.deleted_at IS NULL AND c.approval_status='approved'").bind(tournamentId).first<{id:string;name:string;club_id:string;date:string;format:string;capacity:number;status:'registration'|'active'|'completed';best_of:number;revision:number;state_json:string|null;registration_closes_at:string|null;starts_at:string|null;estimated_ends_at:string|null;allow_visitors:number;team_size:number;club_name:string;club_location:string}>();
 if(!event)return null;
 // A doubles tournament lists teams. A team's id is what the draw uses, and its name is its two players.
 const teamRows=event.team_size===2?(await db.prepare('SELECT d.id,a.id AS a_id,a.name AS a_name,b.id AS b_id,b.name AS b_name FROM doubles_teams d JOIN profiles a ON a.id=d.p1 JOIN profiles b ON b.id=d.p2 WHERE d.tournament_id=? ORDER BY d.created_at,d.id').bind(tournamentId).all<{id:string;a_id:string;a_name:string;b_id:string;b_name:string}>()).results:[];
 const entrants:{id:string;name:string;is_guest:number;isTeam?:boolean;members?:{id:string;name:string}[]}[]=event.team_size===2?teamRows.map(t=>({id:t.id,name:`${t.a_name} & ${t.b_name}`,is_guest:0,isTeam:true,members:[{id:t.a_id,name:t.a_name},{id:t.b_id,name:t.b_name}]})):(await db.prepare('SELECT p.id,p.name,p.auth_id IS NULL AS is_guest FROM entries e JOIN profiles p ON p.id=e.player_id WHERE e.tournament_id=? ORDER BY e.created_at,e.id').bind(tournamentId).all<{id:string;name:string;is_guest:number}>()).results;
 const fixturePlans=(await db.prepare('SELECT fixture_id,court,starts_at,ends_at,called_at FROM tournament_fixture_plans WHERE tournament_id=?').bind(tournamentId).all<{fixture_id:string;court:string;starts_at:string|null;ends_at?:string|null;called_at?:string|null}>()).results;
 const waitlistCount=(await db.prepare('SELECT count(*) n FROM tournament_waitlist WHERE tournament_id=?').bind(tournamentId).first<{n:number}>())?.n??0;
 const eventMatchIds=(await db.prepare("SELECT id FROM matches WHERE tournament_id=? AND status='confirmed'").bind(tournamentId).all<{id:string}>()).results.map(m=>m.id),eventChanges=await loadRatingChanges(db,eventMatchIds),ratingChanges:Record<string,number>={};
 for(const byPlayer of Object.values(eventChanges))for(const [id,delta] of Object.entries(byPlayer))ratingChanges[id]=Math.round(((ratingChanges[id]??0)+delta)*10)/10;
 return {ratingChanges,estimatedEndsAt:event.estimated_ends_at,allowVisitors:!!event.allow_visitors,waitlistCount,fixturePlans,registrationClosesAt:event.registration_closes_at,startsAt:event.starts_at,id:event.id,name:event.name,date:event.date,format:event.format,capacity:event.capacity,status:event.status,bestOf:event.best_of,revision:event.revision,club:{id:event.club_id,name:event.club_name,location:event.club_location},teamSize:event.team_size,entrants:entrants.map(p=>({...p,isGuest:!!p.is_guest})),state:event.state_json?JSON.parse(event.state_json):null};
}

export type PublicHeadToHead={a:{id:string;name:string;photoUrl:string|null};b:{id:string;name:string;photoUrl:string|null};meetings:H2HMeeting[]};
export async function getPublicHeadToHead(db:D1Database,aId:string,bId:string):Promise<PublicHeadToHead|null>{
 if(!validId(aId)||!validId(bId)||aId===bId||aId==='rally-unaffiliated-system'||bId==='rally-unaffiliated-system')return null;
 const people=(await db.prepare('SELECT p.id,p.name,ph.updated_at AS photo_version FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.id IN (?,?) AND p.deleted_at IS NULL').bind(aId,bId).all<{id:string;name:string;photo_version:string|null}>()).results;
 const a=people.find(p=>p.id===aId),b=people.find(p=>p.id===bId);if(!a||!b)return null;
 const rows=(await db.prepare("SELECT m.id,m.a,m.games,m.played_on,m.tournament_id,c.name AS club_name FROM matches m JOIN clubs c ON c.id=m.club_id WHERE m.status='confirmed' AND c.approval_status='approved' AND ((m.a=? AND m.b=?) OR (m.a=? AND m.b=?)) ORDER BY m.played_on DESC,m.created_at DESC").bind(aId,bId,bId,aId).all<{id:string;a:string;games:string;played_on:string;tournament_id:string|null;club_name:string}>()).results;
 return {a:{id:a.id,name:a.name,photoUrl:profilePhotoUrl(a.id,a.photo_version)},b:{id:b.id,name:b.name,photoUrl:profilePhotoUrl(b.id,b.photo_version)},meetings:rows.map(m=>{const games=JSON.parse(m.games) as [number,number][];return {id:m.id,playedOn:m.played_on,clubName:m.club_name,tournamentId:m.tournament_id,games:m.a===aId?games:games.map(g=>[g[1],g[0]] as [number,number])};})};
}

export type PublicMatch={id:string;a:{id:string;name:string};b:{id:string;name:string};games:[number,number][];bestOf:number;playedOn:string;clubId:string;clubName:string;tournament:{id:string;name:string}|null;changes:{a?:number;b?:number}};
export async function getPublicMatch(db:D1Database,matchId:string):Promise<PublicMatch|null>{
 if(!validId(matchId))return null;
 const m=await db.prepare("SELECT m.id,m.a,m.b,pa.name AS a_name,pb.name AS b_name,m.games,m.best_of,m.played_on,m.club_id,c.name AS club_name,m.tournament_id,t.name AS tournament_name FROM matches m JOIN clubs c ON c.id=m.club_id JOIN profiles pa ON pa.id=m.a JOIN profiles pb ON pb.id=m.b LEFT JOIN tournaments t ON t.id=m.tournament_id AND t.deleted_at IS NULL WHERE m.id=? AND m.status='confirmed' AND c.approval_status='approved' AND pa.deleted_at IS NULL AND pb.deleted_at IS NULL AND (m.tournament_id IS NULL OR t.id IS NOT NULL)").bind(matchId).first<{id:string;a:string;b:string;a_name:string;b_name:string;games:string;best_of:number;played_on:string;club_id:string;club_name:string;tournament_id:string|null;tournament_name:string|null}>();
 if(!m)return null;
 const change=(await loadRatingChanges(db,[m.id]))[m.id]??{};
 return {id:m.id,a:{id:m.a,name:m.a_name},b:{id:m.b,name:m.b_name},games:JSON.parse(m.games),bestOf:m.best_of,playedOn:m.played_on,clubId:m.club_id,clubName:m.club_name,tournament:m.tournament_id&&m.tournament_name?{id:m.tournament_id,name:m.tournament_name}:null,changes:{a:change[m.a],b:change[m.b]}};
}