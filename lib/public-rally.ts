import {profilePhotoUrl} from './profile-photo';
import type {Draw} from './tournament-engine';

export type PublicPlayerMatch={
 id:string;clubId:string;clubName:string;opponentId:string;opponentName:string;
 games:[number,number][];bestOf:number;playedOn:string;tournamentId:string|null;
 playerSide:0|1;
};

export type PublicPlayer={
 id:string;name:string;isGuest:boolean;photoUrl:string|null;bio:string;
 clubs:{id:string;name:string;location:string}[];
 matches:PublicPlayerMatch[];
};

export type PublicTournament={
 id:string;name:string;date:string;format:string;capacity:number;
 status:'registration'|'active'|'completed';bestOf:number;revision:number;
 club:{id:string;name:string;location:string};
 entrants:{id:string;name:string;isGuest:boolean}[];
 state:Draw|null;
};

const validId=(value:string)=>/^[a-zA-Z0-9_-]{1,80}$/.test(value);

export async function getPublicPlayer(db:D1Database,playerId:string):Promise<PublicPlayer|null>{
 if(!validId(playerId))return null;
 const profile=await db.prepare('SELECT p.id,p.name,p.bio,p.auth_id IS NULL AS is_guest,ph.updated_at AS photo_version FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.id=? AND p.deleted_at IS NULL').bind(playerId).first<{id:string;name:string;is_guest:number;bio:string;photo_version:string|null}>();
 if(!profile)return null;
 const clubs=(await db.prepare("SELECT c.id,c.name,c.location FROM clubs c JOIN memberships m ON m.club_id=c.id WHERE m.player_id=? AND m.status='active' AND c.approval_status='approved' ORDER BY c.name").bind(playerId).all<{id:string;name:string;location:string}>()).results;
 const rows=(await db.prepare("SELECT m.id,m.club_id,c.name AS club_name,m.a,m.b,pa.name AS a_name,pb.name AS b_name,m.games,m.best_of,m.played_on,m.tournament_id FROM matches m JOIN clubs c ON c.id=m.club_id JOIN profiles pa ON pa.id=m.a JOIN profiles pb ON pb.id=m.b WHERE m.status='confirmed' AND c.approval_status='approved' AND (m.a=? OR m.b=?) ORDER BY m.played_on DESC,m.created_at DESC").bind(playerId,playerId).all<{id:string;club_id:string;club_name:string;a:string;b:string;a_name:string;b_name:string;games:string;best_of:number;played_on:string;tournament_id:string|null}>()).results;
 return {id:profile.id,name:profile.name,isGuest:!!profile.is_guest,photoUrl:profilePhotoUrl(profile.id,profile.photo_version),bio:profile.bio,clubs,matches:rows.map(m=>({id:m.id,clubId:m.club_id,clubName:m.club_name,opponentId:m.a===playerId?m.b:m.a,opponentName:m.a===playerId?m.b_name:m.a_name,games:JSON.parse(m.games),bestOf:m.best_of,playedOn:m.played_on,tournamentId:m.tournament_id,playerSide:m.a===playerId?0:1}))};
}

export async function getPublicTournament(db:D1Database,tournamentId:string):Promise<PublicTournament|null>{
 if(!validId(tournamentId))return null;
 const event=await db.prepare("SELECT t.*,c.name AS club_name,c.location AS club_location FROM tournaments t JOIN clubs c ON c.id=t.club_id WHERE t.id=? AND c.approval_status='approved'").bind(tournamentId).first<{id:string;name:string;club_id:string;date:string;format:string;capacity:number;status:'registration'|'active'|'completed';best_of:number;revision:number;state_json:string|null;club_name:string;club_location:string}>();
 if(!event)return null;
 const entrants=(await db.prepare('SELECT p.id,p.name,p.auth_id IS NULL AS is_guest FROM entries e JOIN profiles p ON p.id=e.player_id WHERE e.tournament_id=? ORDER BY e.created_at,e.id').bind(tournamentId).all<{id:string;name:string;is_guest:number}>()).results;
 return {id:event.id,name:event.name,date:event.date,format:event.format,capacity:event.capacity,status:event.status,bestOf:event.best_of,revision:event.revision,club:{id:event.club_id,name:event.club_name,location:event.club_location},entrants:entrants.map(p=>({...p,isGuest:!!p.is_guest})),state:event.state_json?JSON.parse(event.state_json):null};
}
