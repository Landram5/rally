import {readSessions} from './club-sessions';
import {readOwnership,ownershipAction} from './record-ownership';
import {doublesAction} from './doubles';
import {dashboardsFor} from './dashboards';
import {cachedSummaries,summaryVersion} from './summary-cache';
import {readFeedback,updateFeedback} from './feedback-progress';
import {readPreferences,savePreferences} from './notification-preferences';
import {seasonAction} from './club-seasons';
import {optionalText} from './logistics';
import {notificationsFor} from './notifications';
import {readAnnouncements} from './announcements';
import {validateProfilePhoto,profilePhotoUrl} from './profile-photo';
import {suggestSeeds,tournamentWeight,ratingEstimates} from './seeding';
import {deletionPending} from './account-deletion';
import {guardAccountWrites} from './account-write-guard';
import {scoreError} from './match-rules';
export {scoreError} from './match-rules';
import {tournamentAction} from './tournament-service';
import {AppError} from './rally-errors';
export {AppError} from './rally-errors';
type Profile={id:string;name:string;auth_id:string|null};
type Membership={club_id:string;player_id:string;role:string;status:string};
type Access={clubId?:string;compact?:boolean;isSiteAdmin?:boolean;reviewerId?:string};
export type SavedMatch={id:string;club_id:string;a:string;b:string;games:string;best_of:number;played_on:string;status:string;submitted_by:string;confirmed_by:string|null;tournament_id:string|null;tournament_weight?:number};
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
  const self=authId?await me(authId):null,scope=access.clubId??'',version=access.compact?await summaryVersion(db):0;
  const [allProfiles,allClubs,allMatches,allTournaments,allEntries]=await Promise.all([all<{id:string;name:string;is_guest:number;is_deleted:number;bio:string;rally_id:string|null;photo_version:string|null;initial_rating:number|null;initial_rating_revision:number}>('SELECT p.id,p.name,p.bio,p.rally_id,p.initial_rating,p.initial_rating_revision,(p.auth_id IS NULL AND p.deleted_at IS NULL) AS is_guest,p.deleted_at IS NOT NULL AS is_deleted,ph.updated_at AS photo_version FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE (?=\'\' OR p.id IN (SELECT player_id FROM memberships WHERE club_id=?) OR p.id IN (SELECT player_id FROM entries WHERE tournament_id IN (SELECT id FROM tournaments WHERE club_id=?)) OR p.id IN (SELECT player_id FROM tournament_waitlist WHERE tournament_id IN (SELECT id FROM tournaments WHERE club_id=?))) ORDER BY p.name',scope,scope,scope,scope),all<{id:string;name:string;location:string;bio:string;venue:string;meeting_schedule:string;contact:string;joining_info:string;owner_id:string;approval_status:string;photo_version:string|null;banner_version:string|null}>("SELECT c.id,c.name,c.location,c.bio,c.venue,c.meeting_schedule,c.contact,c.joining_info,c.owner_id,c.approval_status,(SELECT updated_at FROM club_media WHERE club_id=c.id AND kind='photo') AS photo_version,(SELECT updated_at FROM club_media WHERE club_id=c.id AND kind='banner') AS banner_version FROM clubs c WHERE (?='' OR c.id=?) ORDER BY c.name",scope,scope),all<SavedMatch>('SELECT m.*,t.rating_weight AS tournament_weight,pa.initial_rating AS a_initial_rating,pb.initial_rating AS b_initial_rating FROM matches m LEFT JOIN profiles pa ON pa.id=m.a LEFT JOIN profiles pb ON pb.id=m.b LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE t.deleted_at IS NULL AND (?=\'\' OR m.club_id=?) ORDER BY m.played_on DESC,m.created_at DESC',scope,scope),all<{waitlist?:{player_id:string;position:number}[];id:string;club_id:string;state_json:string|null;[key:string]:unknown}>('SELECT * FROM tournaments WHERE deleted_at IS NULL AND (?=\'\' OR club_id=?) ORDER BY date',scope,scope),all<{tournament_id:string;player_id:string;checked_in_at:string|null}>('SELECT tournament_id,player_id,checked_in_at FROM entries WHERE (?=\'\' OR tournament_id IN (SELECT id FROM tournaments WHERE club_id=?)) ORDER BY created_at,id',scope,scope)]);
  const memberships=await all<Membership>('SELECT club_id,player_id,role,status FROM memberships WHERE (?=\'\' OR club_id=?)',scope,scope);
  const visibleClubIds=new Set(allClubs.filter(c=>c.approval_status==='approved'||access.isSiteAdmin||(self&&memberships.some(m=>m.club_id===c.id&&m.player_id===self.id))).map(c=>c.id));
  const cs=allClubs.filter(c=>c.id!=='unaffiliated'&&visibleClubIds.has(c.id)),ms=allMatches.filter(m=>visibleClubIds.has(m.club_id)),ts=allTournaments.filter(t=>visibleClubIds.has(t.club_id));
  const tournamentIds=new Set(ts.map(t=>t.id as string)),es=allEntries.filter(e=>tournamentIds.has(e.tournament_id));
  const visiblePlayerIds=new Set(memberships.filter(m=>m.status==='active'&&visibleClubIds.has(m.club_id)).map(m=>m.player_id));if(self)visiblePlayerIds.add(self.id);
  for(const e of es)visiblePlayerIds.add(e.player_id);
  for(const m of ms)if(self||m.status==='confirmed'){visiblePlayerIds.add(m.a);visiblePlayerIds.add(m.b);}
  if(self&&!scope)for(const p of allProfiles)if(!p.is_guest&&!p.is_deleted)visiblePlayerIds.add(p.id);
  const waiting=await all<{id:string;tournament_id:string;player_id:string;created_at:string;claim_expires_at:string|null}>("SELECT w.* FROM tournament_waitlist w JOIN tournaments t ON t.id=w.tournament_id WHERE t.deleted_at IS NULL AND (?='' OR t.club_id=?) ORDER BY w.created_at,w.rowid",scope,scope);
  for(const w of waiting)if(tournamentIds.has(w.tournament_id)&&(w.player_id===self?.id||memberships.some(m=>m.player_id===self?.id&&m.club_id===ts.find(t=>t.id===w.tournament_id)?.club_id&&m.status==='active'&&['owner','admin','board'].includes(m.role))))visiblePlayerIds.add(w.player_id);
  const adminIds=self?memberships.filter(m=>m.player_id===self.id&&m.status==='active'&&['owner','admin','board'].includes(m.role)).map(m=>m.club_id):[];
  for(const m of memberships)if(m.status==='pending'&&adminIds.includes(m.club_id)&&visibleClubIds.has(m.club_id))visiblePlayerIds.add(m.player_id);
  const ps=allProfiles.filter(p=>!p.is_deleted&&visiblePlayerIds.has(p.id)).map(({photo_version,...p})=>({...p,photo_url:profilePhotoUrl(p.id,photo_version)}));
  const visibleMatches=self?ms:ms.filter(m=>m.status==='confirmed');
  const result={me:self?{id:self.id,name:self.name,profileComplete:ps.some(p=>p.id===self.id&&!!p.photo_url&&!!p.bio?.trim())}:null,signedIn:!!authId,players:ps,deletedPlayers:allProfiles.filter(p=>p.is_deleted&&(ms.some(m=>m.a===p.id||m.b===p.id)||es.some(e=>e.player_id===p.id))).map(p=>({id:p.id,name:p.name})),feedback:self?await readFeedback(db,self.id,!!access.isSiteAdmin):[],clubs:cs.map(({owner_id,approval_status,photo_version,banner_version,...c})=>({...c,photo_url:photo_version?`/api/clubs/${c.id}/media/photo?v=${encodeURIComponent(photo_version)}`:null,banner_url:banner_version?`/api/clubs/${c.id}/media/banner?v=${encodeURIComponent(banner_version)}`:null,approvalStatus:approval_status,activeMemberCount:memberships.filter(m=>m.club_id===c.id&&m.status==='active').length,canAssignRoles:!!self&&owner_id===self.id,canManage:adminIds.includes(c.id)})),memberships:memberships.filter(m=>visibleClubIds.has(m.club_id)&&(m.status==='active'||(self&&(m.player_id===self.id||adminIds.includes(m.club_id))))),matches:visibleMatches.map(m=>({...m,games:JSON.parse(m.games),canConfirm:!!self&&canConfirm(m,self.id,adminIds.includes(m.club_id)),canReview:!!self&&(m.a===self.id||m.b===self.id||adminIds.includes(m.club_id)),canVoid:!m.tournament_id&&!!self&&m.status!=='voided'&&(adminIds.includes(m.club_id)||(m.status==='pending'&&m.submitted_by===self.id))})),tournaments:ts.map(({state_json,...t})=>({...t,canDelete:!!self&&memberships.some(m=>m.club_id===t.club_id&&m.player_id===self.id&&m.status==='active')&&(t.created_by?t.created_by===self.id:allClubs.some(c=>c.id===t.club_id&&c.owner_id===self.id)),rating_weight:state_json?t.rating_weight:tournamentWeight(es.filter(e=>e.tournament_id===t.id).map(e=>e.player_id),memberships,allClubs.filter(c=>c.approval_status==='approved').map(c=>c.id)),state:state_json?JSON.parse(state_json):null,seedStats:access.compact?[]:suggestSeeds(es.filter(e=>e.tournament_id===t.id).map(e=>e.player_id),visibleMatches.filter(m=>m.club_id===t.club_id),undefined,ratingEstimates(ps))})),entries:es};
  const plans=await all<{tournament_id:string;fixture_id:string;court:string;starts_at:string|null;ends_at:string|null;called_at:string|null}>('SELECT * FROM tournament_fixture_plans WHERE (?=\'\' OR tournament_id IN (SELECT id FROM tournaments WHERE club_id=?))',scope,scope);for(const t of result.tournaments){Object.assign(t,{fixturePlans:plans.filter(p=>p.tournament_id===t.id),checkedIn:es.filter(e=>e.tournament_id===t.id&&e.checked_in_at).map(e=>e.player_id)});}
  for(const t of result.tournaments){const queue=waiting.filter(w=>w.tournament_id===t.id);Object.assign(t,{waitlist_count:queue.length,waitlist:queue.map((w,i)=>({player_id:w.player_id,position:i+1,claim_expires_at:w.claim_expires_at})).filter(w=>adminIds.includes(t.club_id as string)||w.player_id===self?.id)});}
  const scorekeepers=await all<{tournament_id:string;player_id:string}>("SELECT sk.* FROM tournament_scorekeepers sk JOIN tournaments t ON t.id=sk.tournament_id JOIN memberships m ON m.club_id=t.club_id AND m.player_id=sk.player_id JOIN profiles p ON p.id=sk.player_id WHERE m.status='active' AND p.deleted_at IS NULL AND (?='' OR t.club_id=?)",scope,scope);
  for(const t of result.tournaments)Object.assign(t,{canScore:!!self&&(adminIds.includes(t.club_id as string)||scorekeepers.some(sk=>sk.tournament_id===t.id&&sk.player_id===self.id)),scorekeepers:adminIds.includes(t.club_id as string)?scorekeepers.filter(sk=>sk.tournament_id===t.id).map(sk=>sk.player_id):[]});
  const ownership=self?await readOwnership(db,self.id):{claims:[],reviews:[]};
  const readIds=self?(await all<{notification_id:string}>('SELECT notification_id FROM notification_reads WHERE player_id=?',self.id)).map(r=>r.notification_id):[];
  const dashboards=dashboardsFor(result as unknown as Parameters<typeof dashboardsFor>[0]);
  const preferences=self?await readPreferences(db,self.id):undefined;
  const sessions=self?await readSessions(db,self.id,scope||undefined):[];
  const announcements=self?await readAnnouncements(db,self.id):[];
  const notifications=notificationsFor({...result,ownership,preferences,announcements,sessions} as unknown as Parameters<typeof notificationsFor>[0],readIds);
  if(access.compact){const summaries=await cachedSummaries(db,visibleMatches as unknown as Parameters<typeof cachedSummaries>[1],cs.map(c=>c.id),version,self?'authenticated':'public');const visibleMemberships=scope?result.memberships.filter(m=>m.player_id===self?.id||m.status==='pending'):result.memberships;const visiblePeople=new Set(visibleMemberships.map(m=>m.player_id));if(self)visiblePeople.add(self.id);
   return {...result,memberships:visibleMemberships,players:(scope?result.players.filter(p=>visiblePeople.has(p.id)):result.players).map(p=>({id:p.id,name:p.name,is_guest:p.is_guest,is_deleted:p.is_deleted,photo_url:p.photo_url,initial_rating:p.initial_rating,initial_rating_revision:p.initial_rating_revision})),summaries,eventCounts:Object.fromEntries(['all',...cs.map(c=>c.id)].map(id=>[id,id==='all'?ts.length:ts.filter(t=>t.club_id===id).length])),matches:result.matches.slice(0,20),tournaments:result.tournaments.slice(0,20).map(t=>({...t,entry_count:es.filter(e=>e.tournament_id===t.id).length,state:null,seedStats:[],fixturePlans:[]})),entries:result.entries.filter(e=>e.player_id===self?.id),notifications,dashboards,ownership,preferences,sessions};}
  return {...result,notifications,dashboards,ownership,preferences,sessions};
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
   if(photo===null){statements.push(q('DELETE FROM profile_photos WHERE player_id IN (SELECT id FROM profiles WHERE auth_id=?)',authId));statements.push(q('DELETE FROM profile_photo_originals WHERE player_id IN (SELECT id FROM profiles WHERE auth_id=?)',authId));}
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
  if(action==='set_initial_rating'){
   const clubId=id(body.clubId),playerId=id(body.playerId),operationId=id(body.operationId),note=str(body.note,'Estimate reason',300),rating=body.rating,payload=JSON.stringify(body);
   if(!Number.isInteger(rating)||Number(rating)<200||Number(rating)>4000)fail(400,'Use a whole-number initial estimate from 200 to 4000.');
   const prior=await q('SELECT actor_id,payload FROM rating_estimate_history WHERE id=?',operationId).first<{actor_id:string;payload:string}>();if(prior){if(prior.actor_id!==user.id||prior.payload!==payload)fail(409,'This action ID was already used.');return {ok:true};}
   if(!access.isSiteAdmin)await admin(clubId,user.id);
   const target=await q("SELECT p.initial_rating,p.initial_rating_revision FROM profiles p JOIN memberships m ON m.player_id=p.id JOIN clubs c ON c.id=m.club_id WHERE p.id=? AND p.deleted_at IS NULL AND m.club_id=? AND m.status='active' AND c.approval_status='approved'",playerId,clubId).first<{initial_rating:number|null;initial_rating_revision:number}>();if(!target)fail(404,'Choose an active player in an approved club.');
   if(target!.initial_rating!==null&&!access.isSiteAdmin)fail(403,'Only a Rally site administrator can correct an existing initial estimate.');
   if(body.revision!==target!.initial_rating_revision)fail(409,'The initial estimate changed. Refresh and try again.');
   const results=await db.batch([q("UPDATE profiles SET initial_rating=?,initial_rating_revision=initial_rating_revision+1,initial_rating_operation=? WHERE id=? AND deleted_at IS NULL AND initial_rating_revision=? AND (?=1 OR initial_rating IS NULL) AND NOT EXISTS(SELECT 1 FROM rating_estimate_history WHERE id=?) AND EXISTS(SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.player_id=profiles.id AND m.club_id=? AND m.status='active' AND c.approval_status='approved') AND (?=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND m.role IN ('owner','admin','board')))",rating,operationId,playerId,body.revision,access.isSiteAdmin?1:0,operationId,clubId,access.isSiteAdmin?1:0,clubId,user.id),q('INSERT INTO rating_estimate_history(id,player_id,club_id,actor_id,before_rating,after_rating,note,revision,created_at,payload) SELECT ?,?,?,?,?,?,?,initial_rating_revision,?,? FROM profiles WHERE id=? AND initial_rating_operation=? ON CONFLICT(id) DO NOTHING',operationId,playerId,clubId,user.id,target!.initial_rating,rating,note,now,payload,playerId,operationId)]);
   if(results[0].meta.changes!==1){const applied=await q('SELECT actor_id,payload FROM rating_estimate_history WHERE id=?',operationId).first<{actor_id:string;payload:string}>();if(applied?.actor_id!==user.id||applied?.payload!==payload)fail(409,'The player, estimate, or your access changed. Refresh and try again.');}return {ok:true};
  }
  if(action==='mark_notification_read'||action==='mark_notifications_read'){
   const data=await makeService(database).read(authId),notifications=data.notifications;
   const selected=action==='mark_notifications_read'?notifications.filter(n=>!n.read):notifications.filter(n=>n.id===body.id);
   if(action==='mark_notification_read'&&!selected.length)fail(404,'Notification not found.');
   if(selected.length)await db.batch(selected.map(n=>q('INSERT INTO notification_reads (player_id,notification_id,read_at) VALUES (?,?,?) ON CONFLICT(player_id,notification_id) DO NOTHING',user.id,n.id,now)));
   return {ok:true};
  }
  if(action==='update_club'){
   const clubId=id(body.clubId),name=str(body.name,'Club name',80),location=str(body.location,'Location',100);
   if(typeof body.bio!=='string'||body.bio.trim().length>1200)fail(400,'Club bio must be at most 1200 characters.');
   const details=['venue','meeting_schedule','contact','joining_info'].map((key,i)=>body[key]===undefined?null:optionalText(body[key],['Venue/address','Meeting schedule','Contact details','Joining instructions'][i],[300,500,300,800][i]));
   const result=await q("UPDATE clubs SET name=?,location=?,bio=?,venue=COALESCE(?,venue),meeting_schedule=COALESCE(?,meeting_schedule),contact=COALESCE(?,contact),joining_info=COALESCE(?,joining_info) WHERE id=? AND owner_id=? AND EXISTS (SELECT 1 FROM memberships WHERE club_id=clubs.id AND player_id=? AND role='owner' AND status='active')",name,location,(body.bio as string).trim(),...details,clubId,user.id,user.id).run();
   if(result.meta.changes!==1)fail(403,'Only the club owner can edit club information.');return {ok:true};
  }
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
  if(action==='save_notification_preferences')return savePreferences(db,user.id,body);
  if(['create_season','join_season','withdraw_season','close_season'].includes(action))return seasonAction(db,user.id,body);
  if(action==='set_feedback_status'){
   if(!access.isSiteAdmin)fail(403,'Only a Rally site administrator can review feedback.');
   return updateFeedback(db,body);
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
   if(body.clubId==='unaffiliated')fail(400,'Unaffiliated play does not require club membership.');
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
   const membership=await member(clubId,user.id);if(clubId!=='unaffiliated'&&!membership)fail(403,'Join this club before recording a result.');
   const isAdmin=!!membership&&['owner','admin','board'].includes(membership.role);
   if(!isAdmin&&a!==user.id&&b!==user.id)fail(403,'You can only submit your own matches.');
   if(clubId==='unaffiliated'){
    for(const player of [a,b])if(!await q('SELECT id FROM profiles WHERE id=? AND auth_id IS NOT NULL AND deleted_at IS NULL',player).first())fail(400,'Choose two registered players for an unaffiliated match.');
   }else if(!await member(clubId,a)||!await member(clubId,b))fail(400,'Both players must be active members of this club.');
   const existing=await q('SELECT * FROM matches WHERE id=?',matchId).first<SavedMatch>();
   if(existing){if(existing.submitted_by!==user.id||existing.a!==a||existing.b!==b||existing.games!==JSON.stringify(body.games)||existing.club_id!==clubId||existing.best_of!==bestOf||existing.played_on!==playedOn)fail(409,'Submission ID already used.');return {ok:true,id:matchId};}
   const status=isAdmin?'confirmed':'pending';
   await db.batch([q('INSERT INTO matches (id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',matchId,clubId,a,b,JSON.stringify(body.games),bestOf,playedOn,status,user.id,isAdmin?user.id:null,now),q('INSERT INTO audit (id,match_id,actor_id,action,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),matchId,user.id,isAdmin?'recorded_and_verified':'submitted',now)]);return {ok:true,id:matchId,status};
  }
  if(action==='confirm_match'||action==='void_match'){
   const matchId=id(body.id),m=await q('SELECT * FROM matches WHERE id=?',matchId).first<SavedMatch>();if(!m)fail(404,'Match not found.');
   if(m!.tournament_id)fail(409,'Manage tournament results from the tournament draw.');
   const membership=await member(m!.club_id,user.id),isAdmin=!!membership&&['owner','admin','board'].includes(membership.role);
   if(action==='confirm_match'){
    if(!canConfirm(m!,user.id,isAdmin))fail(403,'Only the opponent or a club administrator can confirm a pending result.');
    await db.batch([q("INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'confirmed',? FROM matches WHERE id=? AND status='pending'",crypto.randomUUID(),user.id,now,matchId),q("UPDATE matches SET status='confirmed',confirmed_by=?,revision=revision+1 WHERE id=? AND status='pending'",user.id,matchId)]);
   }else{
    if(!isAdmin&&!(m!.submitted_by===user.id&&m!.status==='pending'))fail(403,'Only an administrator can void a confirmed result.');
    await db.batch([q("INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'voided',? FROM matches WHERE id=? AND status!='voided'",crypto.randomUUID(),user.id,now,matchId),q("UPDATE matches SET status='voided',revision=revision+1 WHERE id=? AND status!='voided'",matchId)]);
   }return {ok:true};
  }
  if(action==='create_tournament'){
   const clubId=id(body.clubId),eventId=id(body.id),name=str(body.name,'Tournament name',80),eventDate=date(body.date),format=str(body.format,'Format',30),capacity=body.capacity;await admin(clubId,user.id);
   if(!['Round robin','Single elimination','Double elimination','Round robin groups','Swiss'].includes(format)||!Number.isSafeInteger(capacity)||(capacity as number)<2)fail(400,'Choose a valid format and a whole-number player limit of at least 2.');
   await q('INSERT INTO tournaments (id,name,club_id,date,format,capacity,created_at,created_by) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',eventId,name,clubId,eventDate,format,capacity,now,user.id).run();return {ok:true};
  }
  if(['record_doubles_match','confirm_doubles_match','void_doubles_match'].includes(action))return doublesAction(db,user,body);
 if(['request_guest_claim','preview_guest_merge','review_guest_claim','request_match_review','resolve_match_review','correct_match'].includes(action))return ownershipAction(db,user,body);
  if(['set_scorekeeper','schedule_tournament','claim_waitlist_place','set_registration_policy','join_waitlist','leave_waitlist','set_event_logistics','set_check_in','set_fixture_plan','delete_tournament','enter_tournament','add_tournament_guest','set_capacity','remove_entry','start_tournament','score_fixture','reset_fixture','withdraw_player'].includes(action))return tournamentAction(db,user,body);
  fail(400,'Unknown action.');
 }
 }
}
