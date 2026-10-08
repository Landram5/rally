import type {ReactNode} from 'react';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {fixtureSections,groupStandings,leagueRules,outcome,standings,type Draw,type Fixture} from '@/lib/tournament-engine';
type Row=ReturnType<typeof standings>[number];
function StandingsTable({rows,name,playerHref}:{rows:Row[];name:(id:string)=>string;playerHref?:(id:string)=>string}){
 return <Table><TableHeader><TableRow><TableHead>Place</TableHead><TableHead>Player</TableHead><TableHead>W{'\u2013'}L</TableHead><TableHead>Games</TableHead><TableHead>Point diff.</TableHead></TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell>{r.withdrawn?'\u2014':r.rank}</TableCell><TableCell>{playerHref?<a href={playerHref(r.id)}>{name(r.id)}</a>:name(r.id)}{r.withdrawn&&<small className="withdrawn-label">Withdrawn</small>}</TableCell><TableCell>{r.wins}{'\u2013'}{r.losses}</TableCell><TableCell>{r.gamesFor}{'\u2013'}{r.gamesAgainst}</TableCell><TableCell>{r.pointsFor-r.pointsAgainst}</TableCell></TableRow>)}</TableBody></Table>;
}
// Standings (one table per group for group play) followed by the fixtures in their sections.
export default function LeagueView({draw,name,renderFixture,playerHref,gridClassName='round-robin-grid'}:{draw:Draw;name:(id:string)=>string;renderFixture:(f:Fixture)=>ReactNode;playerHref?:(id:string)=>string;gridClassName?:string}){
 const groups=draw.format==='Round robin groups'?groupStandings(draw):null,sections=fixtureSections(draw),summary=outcome(draw);
 return <>
  {draw.format==='Swiss'&&<p className="footnote">{summary.status==='completed'?`All ${draw.swissRounds} rounds are finished.`:`Round ${Math.max(...draw.fixtures.map(f=>f.round))} of ${draw.swissRounds}. The next round is paired automatically when every match in this round is finished.`}</p>}
  {groups?groups.map(g=><div className="standings-wrap league-group" key={g.group}><h3>Group {g.label}</h3><StandingsTable rows={g.rows} name={name} playerHref={playerHref}/></div>):<div className="standings-wrap"><StandingsTable rows={standings(draw)} name={name} playerHref={playerHref}/></div>}
  {groups&&summary.status==='completed'&&summary.groupWinners.length>0&&<p className="footnote"><strong>Group winners:</strong> {summary.groupWinners.map(name).join(', ')}</p>}
  <p className="footnote">{leagueRules(draw.format)}</p>
  {sections.map(s=><section key={s.title||'all'} className="league-section">{s.title&&<h3>{s.title}</h3>}<div className={gridClassName}>{s.fixtures.map(f=>renderFixture(f))}</div></section>)}
 </>;
}
