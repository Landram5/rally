import type {Data} from '../app/rally-app';
import {clubs,players,initialMatches} from './rally';
import {scoreError} from './match-rules';
import {createDraw,recordFixture,resetFixture,withdrawPlayer,outcome,type Draw} from './tournament-engine';
import {suggestSeeds} from './seeding';

// Sample actions stay in memory and never call the production API.
function finish(draw:Draw){let d=draw;while(d.fixtures.some(f=>f.status==='ready')){const f=d.fixtures.find(f=>f.status==='ready')!;d=recordFixture(d,f.id,Array.from({length:Math.floor(d.bestOf/2)+1},()=>[11,7]));}return d;}
function derive(data:Data){
 for(const c of data.clubs)c.activeMemberCount=data.memberships.filter(m=>m.club_id===c.id&&m.status==='active').length;
 for(const t of data.tournaments){
  if(t.state){t.status=outcome(t.state).status==='completed'?'completed':'active';data.matches=data.matches.filter(m=>m.tournament_id!==t.id);
   for(const f of t.state.fixtures.filter(f=>f.status==='played'))data.matches.push({id:`${t.id}-${f.id}`,club_id:t.club_id,a:f.a!,b:f.b!,games:f.games,best_of:t.state.bestOf,played_on:t.date,status:'confirmed',submitted_by:'alex',confirmed_by:'alex',canConfirm:false,canVoid:false,tournament_id:t.id});}
 }
 for(const t of data.tournaments)t.seedStats=suggestSeeds(data.entries.filter(e=>e.tournament_id===t.id).map(e=>e.player_id),data.matches.filter(m=>m.club_id===t.club_id));
 data.matches.sort((a,b)=>b.played_on.localeCompare(a.played_on));return data;
}
export function createDemoData():Data{
 const data:Data={me:{id:'alex',name:'Alex Morgan'},account:{email:'alex@example.test',displayName:'Alex Morgan',emailVerified:true},signedIn:true,isSiteAdmin:true,
 players:players.map(p=>({id:p.id,name:p.name,is_guest:p.id==='riley'?1:0,bio:'',rally_id:'RLY-DEMO-'+p.id.toUpperCase()})),
 clubs:[...clubs.map(c=>({id:c.id,name:c.name,location:c.location,canManage:true,canAssignRoles:c.id==='harbor',approvalStatus:'approved' as const,activeMemberCount:0})),{id:'campus',name:'Campus Table Tennis',location:'Towson, MD',canManage:false,approvalStatus:'pending',activeMemberCount:1}],
 memberships:players.map(p=>({club_id:p.club,player_id:p.id,role:p.id==='alex'?'owner':'member',status:'active'})),
 matches:initialMatches.map(m=>({id:m.id,club_id:m.club,a:m.a,b:m.b,games:m.games,best_of:3,played_on:m.date,status:m.status,submitted_by:m.a,confirmed_by:m.status==='confirmed'?'alex':null,canConfirm:m.status==='pending',canVoid:m.status==='confirmed',tournament_id:null})),tournaments:[],entries:[]};
 data.memberships.push({club_id:'metro',player_id:'alex',role:'admin',status:'active'},{club_id:'harbor',player_id:'casey',role:'member',status:'pending'},{club_id:'campus',player_id:'jamie',role:'owner',status:'active'});
 data.matches.unshift({id:'pending-sample',club_id:'harbor',a:'sam',b:'jordan',games:[[11,8],[11,9]],best_of:3,played_on:'2026-10-04',status:'pending',submitted_by:'sam',confirmed_by:null,canConfirm:true,canVoid:false,tournament_id:null});
 const samples=[
 {id:'autumn',name:'Autumn Singles',date:'2026-10-10',club:'harbor',format:'Single elimination',state:null},
 {id:'live',name:'Harbor Open',date:'2026-10-05',club:'harbor',format:'Single elimination',state:createDraw(['alex','jordan','sam','riley'],'Single elimination',3,true)},
 {id:'summer',name:'Summer Singles Final',date:'2026-09-20',club:'harbor',format:'Single elimination',state:finish(createDraw(['alex','jordan','sam','riley'],'Single elimination',3,true))},
 {id:'league',name:'September Round Robin',date:'2026-09-13',club:'metro',format:'Round robin',state:finish(createDraw(['casey','taylor','morgan','jamie'],'Round robin',3))},
 {id:'double',name:'Metro Double Elimination',date:'2026-08-30',club:'metro',format:'Double elimination',state:finish(createDraw(['casey','taylor','morgan','jamie'],'Double elimination',3))}];
 for(const t of samples){data.tournaments.push({id:t.id,name:t.name,club_id:t.club,date:t.date,format:t.format,capacity:16,status:t.state?'active':'registration',best_of:3,revision:0,state:t.state,seedStats:[]});for(const id of t.state?.seeds??['alex','jordan','sam'])data.entries.push({tournament_id:t.id,player_id:id});}
 return derive(data);
}
export function applyDemoAction(current:Data,p:Record<string,unknown>):Data{
 const d=structuredClone(current),id=String(p.id??crypto.randomUUID()),clubId=String(p.clubId??''),playerId=String(p.playerId??''),action=String(p.action),text=(key:string)=>String(p[key]??'').trim();
 const addGuest=()=>{if(!text('name'))throw new Error('Enter a player name.');const guestId=crypto.randomUUID();d.players.push({id:guestId,name:text('name'),is_guest:1});d.memberships.push({club_id:clubId||d.tournaments.find(t=>t.id===id)!.club_id,player_id:guestId,role:'member',status:'active'});return guestId;};
 if(action==='save_profile'){if(!text('name'))throw new Error('Enter a display name.');d.me!.name=text('name');d.players.find(x=>x.id===d.me!.id)!.name=text('name');if(p.bio!==undefined){if(typeof p.bio!=='string'||p.bio.trim().length>500)throw new Error('Bio must be text with at most 500 characters.');d.players.find(x=>x.id===d.me!.id)!.bio=p.bio.trim();}if(p.photo!==undefined)d.players.find(x=>x.id===d.me!.id)!.photo_url=p.photo===null?null:String(p.photo);}
 else if(action==='set_club_media'){const c=d.clubs.find(c=>c.id===clubId);if(!c?.canManage)throw new Error('Only club leaders can update images.');if(p.kind!=='photo'&&p.kind!=='banner')throw new Error('Choose a photo or banner.');c[p.kind==='photo'?'photo_url':'banner_url']=p.image===null?null:String(p.image);}
 else if(action==='submit_feedback'){
  if(!text('title')||text('title').length>120||!text('description')||text('description').length>3000||!['bug','feature'].includes(text('type')))throw new Error('Enter a title, details, and feedback type.');
  if(text('page').length>200||(text('page')&&(!text('page').startsWith('/')||text('page').startsWith('//')||/[?#\\]/.test(text('page')))))throw new Error('Enter a page path without a query or link.');
  d.feedback??=[];if(d.feedback.some(f=>f.id===id))return derive(d);
  if(d.feedback.filter(f=>f.submitted_by===d.me!.id&&Date.parse(f.created_at)>Date.now()-86400000).length>=5)throw new Error('You can send up to five reports or requests per day.');
  d.feedback.unshift({id,submitted_by:d.me!.id,type:text('type') as 'bug'|'feature',title:text('title'),description:text('description'),page:text('page'),status:'open',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
 }
 else if(action==='set_feedback_status'){const report=d.feedback?.find(f=>f.id===id);if(!d.isSiteAdmin||!report)throw new Error('Only site administrators can review feedback.');if(!['open','planned','in_progress','completed','closed'].includes(text('status')))throw new Error('Choose a valid status.');report.status=text('status');}
 else if(action==='set_member_role'){if(!d.clubs.find(c=>c.id===clubId)?.canAssignRoles)throw new Error('Only the club owner can appoint leaders.');const target=d.memberships.find(m=>m.club_id===clubId&&m.player_id===playerId&&m.status==='active');if(!target||target.role==='owner'||d.players.find(p=>p.id===playerId)?.is_guest||!['member','admin','board'].includes(text('role')))throw new Error('Choose an active member and role.');target.role=text('role');}
 else if(action==='create_club'){if(!text('name')||!text('location'))throw new Error('Enter a club name and location.');if(d.memberships.some(m=>m.player_id===d.me!.id&&m.role==='owner'))throw new Error('You already own a club.');d.clubs.push({id,name:text('name'),location:text('location'),canManage:true,canAssignRoles:true,approvalStatus:'pending',activeMemberCount:1});d.memberships.push({club_id:id,player_id:d.me!.id,role:'owner',status:'active'});}
 else if(action==='add_guest')addGuest();
 else if(action==='approve_club'||action==='decline_club')d.clubs.find(c=>c.id===clubId)!.approvalStatus=action==='approve_club'?'approved':'rejected';
 else if(action==='request_join')d.memberships.push({club_id:clubId,player_id:d.me!.id,role:'member',status:'pending'});
 else if(action==='approve_member'||action==='decline_member')d.memberships.find(m=>m.club_id===clubId&&m.player_id===playerId)!.status=action==='approve_member'?'active':'declined';
 else if(action==='record_match'){
  const error=scoreError(text('a'),text('b'),p.games,p.bestOf);if(error)throw new Error(error);
  const eligible=(pid:string)=>d.memberships.some(m=>m.club_id===clubId&&m.player_id===pid&&m.status==='active');if(!eligible(text('a'))||!eligible(text('b')))throw new Error('Choose two active club players.');
  d.matches.unshift({id,club_id:clubId,a:text('a'),b:text('b'),games:p.games as [number,number][],best_of:Number(p.bestOf),played_on:text('date'),status:'confirmed',submitted_by:d.me!.id,confirmed_by:d.me!.id,canConfirm:false,canVoid:true,tournament_id:null});
 }else if(action==='confirm_match'||action==='void_match'){const m=d.matches.find(m=>m.id===id)!;m.status=action==='confirm_match'?'confirmed':'voided';m.canConfirm=false;m.canVoid=m.status==='confirmed';m.confirmed_by=d.me!.id;}
 else if(action==='create_tournament'){if(!text('name'))throw new Error('Enter a tournament name.');if(!Number.isInteger(p.capacity)||Number(p.capacity)<2)throw new Error('Use a player limit of at least two.');d.tournaments.unshift({id,name:text('name'),club_id:clubId,date:text('date'),format:text('format'),capacity:Number(p.capacity),status:'registration',best_of:3,revision:0,state:null,seedStats:[]});}
 else{
  const t=d.tournaments.find(t=>t.id===id);if(!t)throw new Error('This sample event is unavailable.');if(p.revision!==undefined&&Number(p.revision)!==t.revision)throw new Error('The draw changed. Close and reopen it before trying again.');const entries=d.entries.filter(e=>e.tournament_id===id);
  if(action==='enter_tournament'||action==='add_tournament_guest'){if(t.status!=='registration'||entries.length>=t.capacity)throw new Error('Registration is closed or full.');const entrant=action==='add_tournament_guest'?addGuest():playerId;if(entries.some(e=>e.player_id===entrant))throw new Error('Player is already registered.');d.entries.push({tournament_id:id,player_id:entrant});}
  else if(action==='remove_entry'){if(t.status!=='registration')throw new Error('The draw is locked.');d.entries=d.entries.filter(e=>e.tournament_id!==id||e.player_id!==playerId);}
  else if(action==='set_capacity'){if(!Number.isInteger(p.capacity)||Number(p.capacity)<Math.max(2,entries.length))throw new Error('The limit must fit the registered players.');t.capacity=Number(p.capacity);}
  else if(action==='start_tournament'){t.state=createDraw(p.seeds as string[],t.format,Number(p.bestOf),Boolean(p.thirdPlace));t.best_of=Number(p.bestOf);}
  else if(action==='score_fixture')t.state=recordFixture(t.state!,text('fixtureId'),p.games,p.forfeitWinner as string|undefined);
  else if(action==='reset_fixture')t.state=resetFixture(t.state!,text('fixtureId'));
  else if(action==='withdraw_player')t.state=withdrawPlayer(t.state!,playerId);
  else throw new Error('This sample action is unavailable.');t.revision++;
 }
 return derive(d);
}

