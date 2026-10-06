import {validateProfilePhoto,profilePhotoUrl} from './profile-photo';
import {suggestSeeds} from './seeding';
import {deletionPending} from './account-deletion';
import {guardAccountWrites} from './account-write-guard';
import {scoreError} from './match-rules';
export {scoreError} from './match-rules';
import {tournamentAction} from './tournament-service';
import {AppError} from './rally-errors';
export {AppError} from './rally-errors';
type Profile={id:string;name:string;auth_id:string|null};
type Membership={club_id:string;player_id:string;role:string;status:string};
type Access={isSiteAdmin?:boolean;reviewerId?:string};
export type SavedMatch={id:string;club_id:string;a:string;b:string;games:string;best_of:number;played_on:string;status:string;submitted_by:string;confirmed_by:string|null;tournament_id:string|null};
const fail=(status:number,message:string):never=>{throw new AppError(status,message)};
function str(value:unknown,label:string,max=100):string{if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(400,`${label} is required (maximum ${max} characters).`);return (value as string).trim()}
function id(value:unknown){const s=str(value,'ID',80);if(!/^[a-zA-Z0-9_-]+$/.test(s))fail(400,'Invalid ID.');return s}
function date(value:unknown){const s=str(value,'Date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)fail(400,'Choose a valid date.');return s}
export function canConfirm(m:SavedMatch,playerId:string,isAdmin:boolean){return m.status==='pending'&&(isAdmin||((m.a===playerId||m.b===playerId)&&m.submitted_by!==playerId))}
export function makeService(database:D1Database){
 const db=database;
 const q=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
 const all=async<T>(sql:string,...args:unknown[])=>(await q(sql,...args).all<T>()).results;
 const me=async(authId:string)=>q('SELECT * FROM profiles WHERE auth_id=?',authId).first<Profile>();
 const member=async(clubId:string,playerId:string)=>q('SELECT * FROM memberships WHERE club_id=? AND player_id=? AND status=?',clubId,playerId,'active').first<Membership>();
 const admin=async(clubId:string,playerId:string)=>{const m=await member(clubId,playerId);if(!m||!['owner','admin','board'].includes(m.role))fail(403,'Only club administrators can do that.');return m};
 return {
 async read(authId:string|null,access:Access={}){
  const self=authId?await me(authId):null;
  const [allProfiles,allClubs,allMatches,allTournaments,allEntries]=await Promise.all([all<{id:string;name:string;is_guest:number;is_deleted:number;bio:string;rally_id:string|null;photo_version:string|null}>('SELECT p.id,p.name,p.bio,p.rally_id,(p.auth_id IS NULL AND p.deleted_at IS NULL) AS is_guest,p.deleted_at IS NOT NULL AS is_deleted,ph.updated_at AS photo_version FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id ORDER BY p.name'),all<{id:string;name:string;location:string;owner_id:string;approval_status:string;photo_version:string|null;banner_version:string|null}>("SELECT c.id,c.name,c.location,c.owner_id,c.approval_status,(SELECT updated_at FROM club_media WHERE club_id=c.id AND kind='photo') AS photo_version,(SELECT updated_at FROM club_media WHERE club_id=c.id AND kind='banner') AS banner_version FROM clubs c ORDER BY c.name"),all<SavedMatch>('SELECT * FROM matches ORDER BY played_on DESC,created_at DESC'),all<{id:string;club_id:string;state_json:string|null;[key:string]:unknown}>('SELECT * FROM tournaments ORDER BY date'),all<{tournament_id:string;player_id:string}>('SELECT tournament_id,player_id FROM entries ORDER BY created_at,id')]);
  const memberships=await all<Membership>('SELECT club_id,player_id,role,status FROM memberships');
  const visibleClubIds=new Set(allClubs.filter(c=>c.approval_status==='approved'||access.isSiteAdmin||(self&&memberships.some(m=>m.club_id===c.id&&m.player_id===self.id))).map(c=>c.id));
  const cs=allClubs.filter(c=>visibleClubIds.has(c.id)),ms=allMatches.filter(m=>visibleClubIds.has(m.club_id)),ts=allTournaments.filter(t=>visibleClubIds.has(t.club_id));
  const tournamentIds=new Set(ts.map(t=>t.id as string)),es=allEntries.filter(e=>tournamentIds.has(e.tournament_id));
  const visiblePlayerIds=new Set(memberships.filter(m=>m.status==='active'&&visibleClubIds.has(m.club_id)).map(m=>m.player_id));if(self)visiblePlayerIds.add(self.id);
  const ps=allProfiles.filter(p=>visiblePlayerIds.has(p.id)).map(({photo_version,...p})=>({...p,photo_url:profilePhotoUrl(p.id,photo_version)}));
  const adminIds=self?memberships.filter(m=>m.player_id===self.id&&m.status==='active'&&['owner','admin','board'].includes(m.role)).map(m=>m.club_id):[];
  const visibleMatches=self?ms:ms.filter(m=>m.status==='confirmed');
  return {me:self?{id:self.id,name:self.name}:null,signedIn:!!authId,players:ps,deletedPlayers:allProfiles.filter(p=>p.is_deleted&&(ms.some(m=>m.a===p.id||m.b===p.id)||es.some(e=>e.player_id===p.id))).map(p=>({id:p.id,name:p.name})),feedback:self?await all("SELECT * FROM feedback WHERE (?=1 OR submitted_by=?) ORDER BY created_at DESC LIMIT 100",access.isSiteAdmin?1:0,self.id):[],clubs:cs.map(({owner_id,approval_status,photo_version,banner_version,...c})=>({...c,photo_url:photo_version?`/api/clubs/${c.id}/media/photo?v=${encodeURIComponent(photo_version)}`:null,banner_url:banner_version?`/api/clubs/${c.id}/media/banner?v=${encodeURIComponent(banner_version)}`:null,approvalStatus:approval_status,activeMemberCount:memberships.filter(m=>m.club_id===c.id&&m.status==='active').length,canAssignRoles:!!self&&owner_id===self.id,canManage:adminIds.includes(c.id)})),memberships:memberships.filter(m=>visibleClubIds.has(m.club_id)&&(m.status==='active'||(self&&(m.player_id===self.id||adminIds.includes(m.club_id))))),matches:visibleMatches.map(m=>({...m,games:JSON.parse(m.games),canConfirm:!!self&&canConfirm(m,self.id,adminIds.includes(m.club_id)),canVoid:!m.tournament_id&&!!self&&m.status!=='voided'&&(adminIds.includes(m.club_id)||(m.status==='pending'&&m.submitted_by===self.id))})),tournaments:ts.map(({state_json,...t})=>({...t,state:state_json?JSON.parse(state_json):null,seedStats:suggestSeeds(es.filter(e=>e.tournament_id===t.id).map(e=>e.player_id),visibleMatches.filter(m=>m.club_id===t.club_id))})),entries:es};
 },
 async act(authId:string,body:Record<string,unknown>,access:Access={}){
  const db=guardAccountWrites(database,authId);
  const q=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
  if(await deletionPending(db,authId))fail(403,'Account deletion is in progress.');
  const action=str(body.action,'Action',40),now=new Date().toISOString();
  if(action==='save_profile'){
   const name=str(body.name,'Username',60);
   if(body.bio!==undefined&&(typeof body.bio!=='string'||body.bio.trim().length>500))fail(400,'Bio must be text with at most 500 characters.');
   const bio=typeof body.bio==='string'?body.bio.trim():'',photo=body.photo===undefined?undefined:body.photo===null?null:validateProfilePhoto(body.photo);
   const statements=[q('INSERT INTO profiles (id,auth_id,name,created_at,bio) VALUES (?,?,?,?,?) ON CONFLICT(auth_id) DO UPDATE SET name=excluded.name,bio=CASE WHEN ? THEN excluded.bio ELSE profiles.bio END',crypto.randomUUID(),authId,name,now,bio,body.bio!==undefined?1:0)];
   if(photo===null)statements.push(q('DELETE FROM profile_photos WHERE player_id IN (SELECT id FROM profiles WHERE auth_id=?)',authId));
   else if(photo!==undefined)statements.push(q('INSERT INTO profile_photos (player_id,image_data,updated_at) SELECT id,?,? FROM profiles WHERE auth_id=? AND deleted_at IS NULL ON CONFLICT(player_id) DO UPDATE SET image_data=excluded.image_data,updated_at=excluded.updated_at',photo,now,authId));
   await db.batch(statements);return {ok:true};
  }
  if(action==='approve_club'||action==='decline_club'){
   if(!access.isSiteAdmin)fail(403,'Only a Rally app administrator can review clubs.');
   const clubId=id(body.clubId),status=action==='approve_club'?'approved':'rejected';
   const result=await q('UPDATE clubs SET approval_status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND approval_status=?',status,access.reviewerId??authId,now,clubId,'pending').run();
   if(!result.meta?.changes)fail(409,'This club is no longer awaiting review.');return {ok:true,status};
  }
  const self=await me(authId);if(!self)fail(409,'Create your player profile first.');const user=self!;
  if(action==='set_club_media'){
   const clubId=id(body.clubId),kind=body.kind;
   if(kind!=='photo'&&kind!=='banner')fail(400,'Choose a club photo or banner.');
   await admin(clubId,user.id);const image=body.image===null?null:validateProfilePhoto(body.image,kind==='banner'?1200:512);
   const permission="EXISTS (SELECT 1 FROM memberships m WHERE m.club_id=club_media.club_id AND m.player_id=? AND m.status='active' AND m.role IN ('owner','admin','board'))";
   if(image===null)await q(`DELETE FROM club_media WHERE club_id=? AND kind=? AND ${permission}`,clubId,kind,user.id).run();
   else{
    const result=await q(`INSERT INTO club_media (club_id,kind,image_data,updated_at) SELECT club_id,?,?,? FROM memberships WHERE club_id=? AND player_id=? AND status='active' AND role IN ('owner','admin','board') ON CONFLICT(club_id,kind) DO UPDATE SET image_data=excluded.image_data,updated_at=excluded.updated_at WHERE ${permission}`,kind,image,now,clubId,user.id,user.id).run();
    if(!result.meta?.changes)fail(403,'You no longer manage this club.');
   }
   return {ok:true};
  }
  if(action==='submit_feedback'){
   const feedbackId=id(body.id),type=body.type,title=str(body.title,'Title',120),description=str(body.description,'Details',3000);
   if(type!=='bug'&&type!=='feature')fail(400,'Choose Bug report or Feature request.');
   const page=body.page===undefined?'':typeof body.page==='string'?body.page.trim():null;
   if(page===null||page.length>200||(page!==''&&(!page.startsWith('/')||page.startsWith('//')||/[?#\\]/.test(page))))fail(400,'Use a page path such as /tournaments, without a query or link.');
   const existing=await q('SELECT * FROM feedback WHERE id=?',feedbackId).first<{submitted_by:string;type:string;title:string;description:string;page:string}>();
   if(existing){if(existing.submitted_by!==user.id||existing.type!==type||existing.title!==title||existing.description!==description||existing.page!==page)fail(409,'This submission ID is already used.');return {ok:true,id:feedbackId};}
   const since=new Date(Date.now()-86400000).toISOString();
   const result=await q("INSERT INTO feedback (id,submitted_by,type,title,description,page,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM feedback WHERE submitted_by=? AND created_at>=?)<5",feedbackId,user.id,type,title,description,page,now,now,user.id,since).run();
   if(!result.meta?.changes)fail(429,'You can send up to five reports or requests per day. Please try again later.');
   return {ok:true,id:feedbackId};
  }
  if(action==='set_feedback_status'){
   if(!access.isSiteAdmin)fail(403,'Only a Rally site administrator can review feedback.');
   const feedbackId=id(body.id),status=body.status;
   if(typeof status!=='string'||!['open','planned','in_progress','completed','closed'].includes(status))fail(400,'Choose a valid feedback status.');
   const result=await q('UPDATE feedback SET status=?,updated_at=? WHERE id=?',status,now,feedbackId).run();
   if(!result.meta?.changes)fail(404,'Feedback not found.');return {ok:true};
  }
  if(action==='set_member_role'){
   const clubId=id(body.clubId),playerId=id(body.playerId),role=body.role;
   if(typeof role!=='string'||!['member','admin','board'].includes(role))fail(400,'Choose Member, Administrator, or Board member.');
   const owned=await q('SELECT id FROM clubs WHERE id=? AND owner_id=?',clubId,user.id).first();
   if(!owned)fail(403,'Only the club owner can appoint or remove club leaders.');
   const target=await q('SELECT m.role,p.auth_id,p.deleted_at FROM memberships m JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status=?',clubId,playerId,'active').first<{role:string;auth_id:string|null;deleted_at:string|null}>();
   if(!target||!target.auth_id||target.deleted_at)fail(400,'Choose an active member with a Rally account.');
   if(target!.role==='owner'||playerId===user.id)fail(403,'Use ownership transfer to change the club owner.');
   const result=await q(`UPDATE memberships SET role=? WHERE club_id=? AND player_id=? AND status='active' AND role!='owner'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id=memberships.player_id AND p.auth_id IS NOT NULL AND p.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM account_deletions a WHERE a.auth_id=p.auth_id))
    AND EXISTS (SELECT 1 FROM clubs c JOIN memberships m ON m.club_id=c.id WHERE c.id=memberships.club_id AND c.owner_id=? AND m.player_id=? AND m.role='owner' AND m.status='active')`,role,clubId,playerId,user.id,user.id).run();
   if(!result.meta?.changes)fail(409,'Club ownership or membership changed. Refresh before trying again.');
   return {ok:true};
  }
  if(action==='create_club'){
   const clubId=id(body.id),name=str(body.name,'Club name',80),location=str(body.location,'Location',100);
   const owned=await q('SELECT id FROM clubs WHERE owner_id=? LIMIT 1',user.id).first<{id:string}>();
   if(owned&&owned.id!==clubId)fail(403,'Each account can create one club. You can still administer clubs that invite you.');
   const existing=await q('SELECT owner_id FROM clubs WHERE id=?',clubId).first<{owner_id:string}>();if(existing){if(existing.owner_id!==user.id)fail(409,'That club ID is already in use.');return {ok:true,id:clubId};}
   await db.batch([q("INSERT INTO clubs (id,name,location,owner_id,approval_status,created_at) VALUES (?,?,?,?,?,?)",clubId,name,location,user.id,'pending',now),q('INSERT INTO memberships (id,club_id,player_id,role,status,created_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),clubId,user.id,'owner','active',now)]);return {ok:true,id:clubId,status:'pending'};
  }
  if(action==='request_join'){
   const clubId=id(body.clubId),club=await q('SELECT approval_status FROM clubs WHERE id=?',clubId).first<{approval_status:string}>();if(!club)fail(404,'Club not found.');if(club!.approval_status!=='approved')fail(403,'This club is not open for membership yet.');
   await q('INSERT INTO memberships (id,club_id,player_id,role,status,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(club_id,player_id) DO NOTHING',crypto.randomUUID(),clubId,user.id,'member','pending',now).run();return {ok:true};
  }
  if(action==='approve_member'||action==='decline_member'){
   const clubId=id(body.clubId),playerId=id(body.playerId);await admin(clubId,user.id);
   if(action==='approve_member')await q("UPDATE memberships SET status='active' WHERE club_id=? AND player_id=? AND status='pending'",clubId,playerId).run();
   else await q("DELETE FROM memberships WHERE club_id=? AND player_id=? AND status='pending'",clubId,playerId).run();return {ok:true};
  }
  if(action==='add_guest'){
   const clubId=id(body.clubId),playerId=id(body.id),name=str(body.name,'Player name',60);await admin(clubId,user.id);
   const existing=await q('SELECT id FROM profiles WHERE id=?',playerId).first();if(existing){if(await member(clubId,playerId))return {ok:true};fail(409,'Player already exists.');}
   await db.batch([q('INSERT INTO profiles (id,name,created_at) VALUES (?,?,?)',playerId,name,now),q('INSERT INTO memberships (id,club_id,player_id,role,status,created_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),clubId,playerId,'guest','active',now)]);return {ok:true};
  }
  if(action==='record_match'){
   const matchId=id(body.id),clubId=id(body.clubId),a=id(body.a),b=id(body.b),playedOn=date(body.date),bestOf=body.bestOf;
   if(playedOn>now.slice(0,10))fail(400,'A result cannot be dated in the future.');
   const err=scoreError(a,b,body.games,bestOf);if(err)fail(400,err);
   const membership=await member(clubId,user.id);if(!membership)fail(403,'Join this club before recording a result.');
   const isAdmin=['owner','admin','board'].includes(membership!.role);
   if(!isAdmin&&a!==user.id&&b!==user.id)fail(403,'You can only submit your own matches.');
   if(!await member(clubId,a)||!await member(clubId,b))fail(400,'Both players must be active members of this club.');
   const existing=await q('SELECT * FROM matches WHERE id=?',matchId).first<SavedMatch>();
   if(existing){if(existing.submitted_by!==user.id||existing.a!==a||existing.b!==b||existing.games!==JSON.stringify(body.games))fail(409,'Submission ID already used.');return {ok:true,id:matchId};}
   const status=isAdmin?'confirmed':'pending';
   await db.batch([q('INSERT INTO matches (id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',matchId,clubId,a,b,JSON.stringify(body.games),bestOf,playedOn,status,user.id,isAdmin?user.id:null,now),q('INSERT INTO audit (id,match_id,actor_id,action,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),matchId,user.id,isAdmin?'recorded_and_verified':'submitted',now)]);return {ok:true,id:matchId,status};
  }
  if(action==='confirm_match'||action==='void_match'){
   const matchId=id(body.id),m=await q('SELECT * FROM matches WHERE id=?',matchId).first<SavedMatch>();if(!m)fail(404,'Match not found.');
   if(m!.tournament_id)fail(409,'Manage tournament results from the tournament draw.');
   const membership=await member(m!.club_id,user.id),isAdmin=!!membership&&['owner','admin','board'].includes(membership.role);
   if(action==='confirm_match'){
    if(!canConfirm(m!,user.id,isAdmin))fail(403,'Only the opponent or a club administrator can confirm a pending result.');
    await db.batch([q("INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'confirmed',? FROM matches WHERE id=? AND status='pending'",crypto.randomUUID(),user.id,now,matchId),q("UPDATE matches SET status='confirmed',confirmed_by=? WHERE id=? AND status='pending'",user.id,matchId)]);
   }else{
    if(!isAdmin&&!(m!.submitted_by===user.id&&m!.status==='pending'))fail(403,'Only an administrator can void a confirmed result.');
    await db.batch([q("INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'voided',? FROM matches WHERE id=? AND status!='voided'",crypto.randomUUID(),user.id,now,matchId),q("UPDATE matches SET status='voided' WHERE id=? AND status!='voided'",matchId)]);
   }return {ok:true};
  }
  if(action==='create_tournament'){
   const clubId=id(body.clubId),eventId=id(body.id),name=str(body.name,'Tournament name',80),eventDate=date(body.date),format=str(body.format,'Format',30),capacity=body.capacity;await admin(clubId,user.id);
   if(!['Round robin','Single elimination','Double elimination'].includes(format)||!Number.isSafeInteger(capacity)||(capacity as number)<2)fail(400,'Choose a valid format and a whole-number player limit of at least 2.');
   await q('INSERT INTO tournaments (id,name,club_id,date,format,capacity,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',eventId,name,clubId,eventDate,format,capacity,now).run();return {ok:true};
  }
  if(['enter_tournament','add_tournament_guest','set_capacity','remove_entry','start_tournament','score_fixture','reset_fixture','withdraw_player'].includes(action))return tournamentAction(db,user,body);
  fail(400,'Unknown action.');
 }
 }
}
