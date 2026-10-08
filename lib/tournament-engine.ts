import {scoreError} from './match-rules';

export type FixtureSource={fixtureId:string;result:'winner'|'loser'};
export type Fixture={
 id:string;round:number;slot:number;a:string|null;b:string|null;
 status:'waiting'|'ready'|'played'|'forfeit'|'bye'|'empty';winner:string|null;games:[number,number][];
 manualForfeit?:boolean;bracket?:'winners'|'losers'|'final';bracketRound?:number;group?:number;
 sourceA?:FixtureSource;sourceB?:FixtureSource;conditionFixtureId?:string;
};
export type Draw={format:string;bestOf:number;seeds:string[];withdrawn:string[];fixtures:Fixture[];thirdPlace?:boolean;groups?:string[][];swissRounds?:number};
export const FORMATS=['Single elimination','Double elimination','Round robin','Round robin groups','Swiss'] as const;
// Formats decided by standings rather than a bracket.
export const isLeagueFormat=(format:string)=>['Round robin','Round robin groups','Swiss'].includes(format);
export const groupLabel=(index:number)=>String.fromCharCode(65+index%26)+(index>=26?String(Math.floor(index/26)+1):'');
export const defaultSwissRounds=(players:number)=>Math.max(1,Math.min(players-1,Math.max(3,Math.ceil(Math.log2(Math.max(players,2))))));
export const defaultGroupCount=(players:number)=>Math.max(2,Math.min(Math.floor(players/3),Math.round(players/4.5)));
export const TIE_RULES='Wins, then wins among players tied on total wins, then game difference, then point difference. Still tied: shared placing. Forfeits count as wins/losses but add no game or point scores. Withdrawn players are unranked; earlier played results remain.';
export const resolved=(f:Fixture)=>!['waiting','ready'].includes(f.status);
export const SWISS_RULES='Swiss: every player plays every round. Each round pairs players on similar records and avoids rematches; later rounds appear when the current round is finished. With an odd field the lowest-ranked player without a bye sits out and receives a win. Places use wins, then wins among players tied on total wins, then game difference, then point difference.';
export const GROUP_RULES='Round-robin groups: players are dealt into groups by rating, with the strongest players alternating between groups so each group has a similar strength. Everyone plays everyone in their group. Places in each group use wins, then wins among players tied on total wins, then game difference, then point difference. Withdrawn players are unranked.';
export const leagueRules=(format:string)=>format==='Swiss'?SWISS_RULES:format==='Round robin groups'?GROUP_RULES:TIE_RULES;
// Fixtures grouped for display: one section per group or Swiss round (newest round first), a single section otherwise.
export function fixtureSections(draw:Draw):{title:string;fixtures:Fixture[]}[]{
 if(draw.format==='Round robin groups')return (draw.groups??[]).map((_,g)=>({title:`Group ${groupLabel(g)}`,fixtures:draw.fixtures.filter(f=>f.group===g)}));
 if(draw.format==='Swiss'){const last=draw.fixtures.reduce((m,f)=>Math.max(m,f.round),0);return Array.from({length:last},(_,i)=>last-i).map(round=>({title:`Round ${round} of ${draw.swissRounds??last}`,fixtures:draw.fixtures.filter(f=>f.round===round)}))}
 return [{title:'',fixtures:draw.fixtures}];
}

function seedOrder(size:number){let order=[1,2];for(let n=4;n<=size;n*=2)order=order.flatMap(s=>[s,n+1-s]);return order}
function loser(f:Fixture){if(!f.winner)return null;return f.winner===f.a?f.b:f.a}
function participant(fixtures:Map<string,Fixture>,source?:FixtureSource){
 if(!source)return {player:null,pending:false};
 const fixture=fixtures.get(source.fixtureId);
 if(!fixture||!resolved(fixture))return {player:null,pending:true};
 return {player:source.result==='winner'?fixture.winner:loser(fixture),pending:false};
}

export function recompute(draw:Draw):Draw{
 const d=structuredClone(draw),byId=new Map(d.fixtures.map(f=>[f.id,f])),byPosition=new Map(d.fixtures.map(f=>[`${f.round}:${f.slot}`,f]));
 for(const f of d.fixtures){
  let a=f.a,b=f.b,pending=false;
  if(f.sourceA||f.sourceB){
   const left=participant(byId,f.sourceA),right=participant(byId,f.sourceB);
   a=left.player;b=right.player;pending=left.pending||right.pending;
  }else if(d.format==='Single elimination'&&f.round>1){
   const left=byPosition.get(`${f.round-1}:${f.slot*2}`)!,right=byPosition.get(`${f.round-1}:${f.slot*2+1}`)!;
   a=left.winner;b=right.winner;pending=!resolved(left)||!resolved(right);
  }
  const condition=f.conditionFixtureId?byId.get(f.conditionFixtureId):null;
  if(condition&&!resolved(condition))pending=true;
  const keep=f.a===a&&f.b===b&&(f.status==='played'||(f.status==='forfeit'&&f.manualForfeit));
  f.a=a;f.b=b;
  if(keep&&!pending)continue;
  f.games=[];f.winner=null;f.manualForfeit=false;
  if(pending){f.status='waiting';continue}
  if(condition){
   const winnersChampion=participant(byId,f.sourceA).player;
   if(condition.winner===winnersChampion){f.status='bye';f.winner=condition.winner;continue}
  }
  const activeA=a&&!d.withdrawn.includes(a),activeB=b&&!d.withdrawn.includes(b);
  if(!activeA&&!activeB){f.status='empty';continue}
  if(!a||!b){f.status='bye';f.winner=activeA?a:b;continue}
  if(!activeA||!activeB){f.status='forfeit';f.winner=activeA?a:b;continue}
  f.status='ready';
 }
 if(advanceSwiss(d))return recompute(d);
 return d;
}

function doubleEliminationFixtures(seeds:string[]){
 const size=2**Math.ceil(Math.log2(seeds.length)),winnerRounds=Math.log2(size),order=seedOrder(size),fixtures:Fixture[]=[];
 const add=(fixture:Fixture)=>fixtures.push(fixture);
 for(let round=1,n=size/2;n>=1;round++,n/=2){
  for(let slot=0;slot<n;slot++)add({id:`w${round}m${slot+1}`,round,slot,a:round===1?seeds[order[slot*2]-1]??null:null,b:round===1?seeds[order[slot*2+1]-1]??null:null,status:'waiting',winner:null,games:[],bracket:'winners',bracketRound:round,...(round>1?{sourceA:{fixtureId:`w${round-1}m${slot*2+1}`,result:'winner' as const},sourceB:{fixtureId:`w${round-1}m${slot*2+2}`,result:'winner' as const}}:{})});
 }
 const loserRounds=winnerRounds*2-2;
 for(let round=1;round<=loserRounds;round++){
  const count=size/2**(Math.floor((round+1)/2)+1);
  for(let slot=0;slot<count;slot++){
   let sourceA:FixtureSource,sourceB:FixtureSource;
   if(round===1){sourceA={fixtureId:`w1m${slot*2+1}`,result:'loser'};sourceB={fixtureId:`w1m${slot*2+2}`,result:'loser'}}
   else if(round%2===1){sourceA={fixtureId:`l${round-1}m${slot*2+1}`,result:'winner'};sourceB={fixtureId:`l${round-1}m${slot*2+2}`,result:'winner'}}
   else{const winnersRound=round/2+1,dropSlot=count===1?0:slot^1;sourceA={fixtureId:`l${round-1}m${slot+1}`,result:'winner'};sourceB={fixtureId:`w${winnersRound}m${dropSlot+1}`,result:'loser'}}
   add({id:`l${round}m${slot+1}`,round:winnerRounds+round,slot,a:null,b:null,status:'waiting',winner:null,games:[],bracket:'losers',bracketRound:round,sourceA,sourceB});
  }
 }
 const winnersFinal=`w${winnerRounds}m1`,losersSource:FixtureSource=loserRounds?{fixtureId:`l${loserRounds}m1`,result:'winner'}:{fixtureId:winnersFinal,result:'loser'};
 add({id:'gf1',round:winnerRounds+loserRounds+1,slot:0,a:null,b:null,status:'waiting',winner:null,games:[],bracket:'final',bracketRound:1,sourceA:{fixtureId:winnersFinal,result:'winner'},sourceB:losersSource});
 add({id:'gf2',round:winnerRounds+loserRounds+2,slot:0,a:null,b:null,status:'waiting',winner:null,games:[],bracket:'final',bracketRound:2,sourceA:{fixtureId:winnersFinal,result:'winner'},sourceB:losersSource,conditionFixtureId:'gf1'});
 return fixtures;
}

// Strongest seeds are dealt back and forth across the groups so every group has a similar total strength.
function snakeGroups(seeds:string[],count:number){const groups:string[][]=Array.from({length:count},()=>[]);seeds.forEach((id,i)=>{const row=Math.floor(i/count),col=i%count;groups[row%2===0?col:count-1-col].push(id)});return groups}
function groupFixtures(groups:string[][]){const fixtures:Fixture[]=[];groups.forEach((members,group)=>{let slot=0;members.forEach((a,i)=>members.slice(i+1).forEach(b=>fixtures.push({id:`g${group+1}m${slot+1}`,round:1,slot:slot++,a,b,status:'ready',winner:null,games:[],group})))});return fixtures}
const swissRoundOf=(draw:Draw)=>draw.fixtures.reduce((max,f)=>Math.max(max,f.round),0);
const activeSwissPlayers=(draw:Draw)=>draw.seeds.filter(id=>!draw.withdrawn.includes(id));
export const swissComplete=(draw:Draw)=>draw.format!=='Swiss'||swissRoundOf(draw)>=(draw.swissRounds??0)||activeSwissPlayers(draw).length<2;
// Pairs players on similar records without rematches; the lowest-ranked player without a bye sits out when the field is odd.
function swissRound(draw:Draw,round:number):Fixture[]{
 const order=round===1?activeSwissPlayers(draw):standings(draw).filter(r=>!r.withdrawn).map(r=>r.id),key=(x:string,y:string)=>[x,y].sort().join('|');
 const met=new Set(draw.fixtures.filter(f=>f.a&&f.b).map(f=>key(f.a!,f.b!))),hadBye=new Set(draw.fixtures.filter(f=>f.a&&!f.b&&f.status==='bye').map(f=>f.a!));
 let pool=[...order],bye:string|null=null;
 if(pool.length%2){for(let i=pool.length-1;i>=0;i--)if(!hadBye.has(pool[i])){bye=pool[i];break}bye??=pool[pool.length-1];pool=pool.filter(id=>id!==bye)}
 let budget=20000;
 const pairUp=(list:string[],rematches:boolean):[string,string][]|null=>{if(!list.length)return [];if(--budget<0)return null;const [first,...rest]=list;for(let i=0;i<rest.length;i++){if(!rematches&&met.has(key(first,rest[i])))continue;const tail=pairUp(rest.filter((_,j)=>j!==i),rematches);if(tail)return [[first,rest[i]],...tail]}return null};
 let pairs:[string,string][];
 if(round===1){const half=pool.length/2;pairs=pool.slice(0,half).map((id,i)=>[id,pool[i+half]] as [string,string])}
 else{pairs=pairUp(pool,false)??(budget=20000,pairUp(pool,true))??[];if(!pairs.length&&pool.length)pairs=pool.slice(0,pool.length/2).map((id,i)=>[id,pool[i+pool.length/2]] as [string,string])}
 const fixtures:Fixture[]=pairs.map(([a,b],slot)=>({id:`s${round}m${slot+1}`,round,slot,a,b,status:'ready',winner:null,games:[]}));
 if(bye)fixtures.push({id:`s${round}m${pairs.length+1}`,round,slot:pairs.length,a:bye,b:null,status:'bye',winner:bye,games:[]});
 return fixtures;
}
// Adds the next round once every match of the current round is resolved; returns whether it changed the draw.
function advanceSwiss(draw:Draw):boolean{
 const round=swissRoundOf(draw);if(draw.format!=='Swiss'||!round||round>=(draw.swissRounds??0)||activeSwissPlayers(draw).length<2)return false;
 if(!draw.fixtures.filter(f=>f.round===round).every(resolved))return false;
 draw.fixtures.push(...swissRound(draw,round+1));return true;
}
export function createDraw(seeds:string[],format:string,bestOf:number,thirdPlace=false,options:{groupCount?:number;swissRounds?:number}={}):Draw{
 if(seeds.length<2||new Set(seeds).size!==seeds.length)throw new Error('A draw needs at least two unique players.');
 if(!(FORMATS as readonly string[]).includes(format)||![3,5,7].includes(bestOf))throw new Error('Choose a valid format.');
 if(format==='Swiss'&&seeds.length<4)throw new Error('A Swiss event needs at least four players.');
 if(format==='Round robin groups'&&seeds.length<6)throw new Error('Round-robin groups need at least six players (two groups of three).');
 if(thirdPlace&&(format!=='Single elimination'||seeds.length<4))throw new Error('A third-place playoff requires a single-elimination field of at least four players.');
 const size=2**Math.ceil(Math.log2(seeds.length)),swissRounds=format==='Swiss'?(options.swissRounds??defaultSwissRounds(seeds.length)):undefined,groupCount=format==='Round robin groups'?(options.groupCount??defaultGroupCount(seeds.length)):0;
 if(swissRounds!==undefined&&(!Number.isInteger(swissRounds)||swissRounds<2||swissRounds>seeds.length-1))throw new Error('Choose between 2 rounds and one fewer than the number of players.');
 if(format==='Round robin groups'&&(!Number.isInteger(groupCount)||groupCount<2||groupCount>Math.floor(seeds.length/3)))throw new Error('Choose at least two groups with at least three players in each.');
 const groups=format==='Round robin groups'?snakeGroups(seeds,groupCount):undefined;
 const fixtureCount=(format==='Swiss'?swissRounds!*Math.ceil(seeds.length/2):groups?groups.reduce((n,g)=>n+g.length*(g.length-1)/2,0):format==='Round robin'?seeds.length*(seeds.length-1)/2:format==='Double elimination'?size*2-1:size-1)+(thirdPlace?1:0);
 if(fixtureCount>4095)throw new Error('This field exceeds the current 4,095-fixture event limit. Split it into divisions or use single elimination for a large field.');
 const fixtures:Fixture[]=[];
 const add=(round:number,slot:number,a:string|null,b:string|null)=>fixtures.push({id:`r${round}m${slot+1}`,round,slot,a,b,status:'ready',winner:null,games:[]});
 if(format==='Swiss'){const draft:Draw={format,bestOf,seeds:[...seeds],withdrawn:[],fixtures:[],swissRounds};fixtures.push(...swissRound(draft,1))}
 else if(groups)fixtures.push(...groupFixtures(groups))
 else if(format==='Round robin'){let slot=0;seeds.forEach((a,i)=>seeds.slice(i+1).forEach(b=>add(1,slot++,a,b)))}
 else if(format==='Double elimination')fixtures.push(...doubleEliminationFixtures(seeds));
 else{const order=seedOrder(size),rounds=Math.log2(size);for(let round=1,n=size/2;n>=1;round++,n/=2)for(let slot=0;slot<n;slot++)add(round,slot,round===1?seeds[order[slot*2]-1]??null:null,round===1?seeds[order[slot*2+1]-1]??null:null);if(thirdPlace)fixtures.push({id:'third',round:rounds+1,slot:0,a:null,b:null,status:'waiting',winner:null,games:[],bracket:'final',bracketRound:2,sourceA:{fixtureId:`r${rounds-1}m1`,result:'loser'},sourceB:{fixtureId:`r${rounds-1}m2`,result:'loser'}})}
 return recompute({format,bestOf,seeds:[...seeds],withdrawn:[],fixtures,thirdPlace,...(groups?{groups}:{}),...(swissRounds!==undefined?{swissRounds}:{})});
}

export function recordFixture(draw:Draw,id:string,games:unknown,forfeitWinner?:string):Draw{
 const d=structuredClone(draw),f=d.fixtures.find(f=>f.id===id);if(!f||f.status!=='ready'||!f.a||!f.b)throw new Error('This fixture is not ready. Refresh the draw or reset its existing result.');
 if(forfeitWinner){if(![f.a,f.b].includes(forfeitWinner))throw new Error('Choose one of the two players as the winner.');f.status='forfeit';f.winner=forfeitWinner;f.manualForfeit=true;f.games=[]}
 else{const error=scoreError(f.a,f.b,games,d.bestOf);if(error)throw new Error(error);f.games=games as [number,number][];f.status='played';const wins=f.games.filter(g=>g[0]>g[1]).length;f.winner=wins>f.games.length-wins?f.a:f.b}
 return recompute(d);
}

export function affectedFixtures(draw:Draw,id:string):string[]{
 if(draw.format==='Swiss'){const f=draw.fixtures.find(f=>f.id===id);return f?draw.fixtures.filter(x=>x.round>=f.round).map(x=>x.id):[]}
 const affected=new Set([id]);
 if(draw.format==='Single elimination'){
  const f=draw.fixtures.find(f=>f.id===id);if(!f)return [];
  let round=f.round+1,slot=Math.floor(f.slot/2);for(;;){const next=draw.fixtures.find(x=>x.round===round&&x.slot===slot);if(!next)break;affected.add(next.id);round++;slot=Math.floor(slot/2)}
 }
 let changed=true;while(changed){changed=false;for(const fixture of draw.fixtures){if(affected.has(fixture.id))continue;if([fixture.sourceA?.fixtureId,fixture.sourceB?.fixtureId,fixture.conditionFixtureId].some(source=>source&&affected.has(source))){affected.add(fixture.id);changed=true}}}
 return [...affected];
}
export function resetFixture(draw:Draw,id:string):Draw{
 const d=structuredClone(draw),f=d.fixtures.find(x=>x.id===id);if(!f||!(f.status==='played'||f.manualForfeit))throw new Error('Only a recorded result can be reset. Automatic byes and withdrawal results cannot be reset.');
 if(d.format==='Swiss'){if(d.fixtures.some(x=>x.round>f.round&&(x.status==='played'||x.manualForfeit)))throw new Error('Reset the results of the later Swiss rounds first. Pairings depend on earlier results.');d.fixtures=d.fixtures.filter(x=>x.round<=f.round);f.status='ready';f.winner=null;f.games=[];f.manualForfeit=false;return recompute(d)}
 const ids=affectedFixtures(d,id);d.fixtures.forEach(f=>{if(ids.includes(f.id)){f.status='ready';f.winner=null;f.games=[];f.manualForfeit=false}});return recompute(d);
}
export function withdrawPlayer(draw:Draw,id:string):Draw{if(!draw.seeds.includes(id)||draw.withdrawn.includes(id))throw new Error('This player is not active in the tournament.');const d=structuredClone(draw);d.withdrawn.push(id);return recompute(d)}
export function standings(draw:Draw):ReturnType<typeof leagueStandings>{return draw.format==='Round robin groups'&&draw.groups?groupStandings(draw).flatMap(g=>g.rows):leagueStandings(draw)}
// One table per group, each ranked with the usual round-robin tie rules.
export function groupStandings(draw:Draw){return (draw.groups??[]).map((members,group)=>({group,label:groupLabel(group),rows:leagueStandings({...draw,format:'Round robin',seeds:members,withdrawn:draw.withdrawn.filter(id=>members.includes(id)),fixtures:draw.fixtures.filter(f=>f.group===group)})}))}
function leagueStandings(draw:Draw){
 const rows=draw.seeds.map(id=>({id,withdrawn:draw.withdrawn.includes(id),played:0,wins:0,losses:0,gamesFor:0,gamesAgainst:0,pointsFor:0,pointsAgainst:0,headWins:0,rank:null as number|null}));
 for(const f of draw.fixtures){if(draw.format==='Swiss'&&f.status==='bye'&&f.a&&!f.b&&f.winner){const r=rows.find(r=>r.id===f.a);if(r){r.played++;r.wins++}continue}if(!['played','forfeit'].includes(f.status)||!f.winner||!f.a||!f.b)continue;for(const p of [f.a,f.b]){const r=rows.find(r=>r.id===p)!;r.played++;if(p===f.winner)r.wins++;else r.losses++;for(const g of f.games){const side=p===f.a?0:1;r.gamesFor+=Number(g[side]>g[1-side]);r.gamesAgainst+=Number(g[side]<g[1-side]);r.pointsFor+=g[side];r.pointsAgainst+=g[1-side]}}}
 for(const r of rows){const group=rows.filter(x=>!x.withdrawn&&x.wins===r.wins).map(x=>x.id);r.headWins=draw.fixtures.filter(f=>['played','forfeit'].includes(f.status)&&f.winner===r.id&&f.a&&f.b&&group.includes(f.a)&&group.includes(f.b)).length}
 const key=(r:typeof rows[number])=>[r.wins,r.headWins,r.gamesFor-r.gamesAgainst,r.pointsFor-r.pointsAgainst];
 rows.sort((a,b)=>Number(a.withdrawn)-Number(b.withdrawn)||key(b).reduce((diff,v,i)=>diff||(v-key(a)[i]),0)||draw.seeds.indexOf(a.id)-draw.seeds.indexOf(b.id));
 rows.forEach((r,i)=>{if(!r.withdrawn)r.rank=i>0&&!rows[i-1].withdrawn&&key(r).every((v,j)=>v===key(rows[i-1])[j])?rows[i-1].rank:i+1});return rows;
}
export function outcome(draw:Draw){
 const completed=draw.fixtures.every(resolved)&&swissComplete(draw);let winners:string[]=[],groupWinners:string[]=[];
 if(draw.format==='Round robin groups'){if(completed)groupWinners=groupStandings(draw).flatMap(g=>g.rows.filter(r=>r.rank===1).map(r=>r.id))}
 else if(draw.format==='Round robin'||draw.format==='Swiss'){if(completed)winners=standings(draw).filter(r=>r.rank===1).map(r=>r.id)}else{const final=draw.format==='Single elimination'?draw.fixtures.filter(f=>f.id!=='third').at(-1):draw.fixtures.at(-1),winner=final?.winner;if(final&&resolved(final)&&winner&&!draw.withdrawn.includes(winner))winners=[winner]}
 const thirdPlaceWinner=draw.fixtures.find(f=>f.id==='third')?.winner??null;
 return {status:completed?'completed':'active',winners,groupWinners,thirdPlaceWinner};
}