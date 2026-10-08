/* eslint-disable @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import ShareLinkButton from '@/app/share-link-button';
import {getPublicDoublesBoard} from '@/lib/public-doubles';
import {shareMetadata} from '@/lib/share-meta';
import {ESTABLISHED_MATCHES} from '@/lib/seeding';

export const dynamic='force-dynamic';
export const metadata:Metadata=shareMetadata({title:'Doubles leaderboard · Rally',description:'Doubles ratings and partnerships from confirmed results at approved Rally clubs.',path:'/doubles',image:'/rally-share-v2.png'});

export default async function DoublesLeaderboardPage(){
 const board=env.DB?await getPublicDoublesBoard(env.DB):{players:[],pairs:[]};
 return <><PublicHeader/><main className="public-page"><div className="player-profile">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Rally</a><span>/</span><span>Doubles</span></nav>
  <section className="public-hero"><div><p className="eyebrow">DOUBLES</p><h1>Doubles leaderboard</h1><p>Doubles ratings are separate from singles. Only confirmed results from approved clubs count.</p></div></section>
  <section className="panel"><div className="profile-section-heading"><h2>Players</h2><ShareLinkButton title="Rally doubles leaderboard" label="Share this page"/></div>
   {board.players.length?<ol className="doubles-rank public-doubles-rank">{board.players.map((p,i)=><li key={p.id}><span className="rank">{i+1}</span><a href={`/players/${p.id}`}><b>{p.name}</b></a><span className="elo-cell">{Math.round(p.rating)}</span><small>{p.wins}{'–'}{p.played-p.wins}{p.established?'':` · ${p.played}/${ESTABLISHED_MATCHES}`}</small></li>)}</ol>:<p className="doubles-empty">No confirmed doubles results yet.</p>}
  </section>
  {board.pairs.length>0&&<section className="panel"><div className="profile-section-heading"><h2>Best partnerships</h2><p>Pairs with at least two matches together</p></div><ul className="doubles-partners">{board.pairs.map(p=><li key={p.ids.join('|')}><span><a href={`/pairs/${p.ids[0]}/${p.ids[1]}`}>{p.names.join(' & ')}</a></span><span>{p.wins}{'–'}{p.played-p.wins}</span></li>)}</ul></section>}
  <p className="public-note">Provisional ratings (fewer than {ESTABLISHED_MATCHES} matches) are shown with their progress. Separate from USATT ratings. <a href="/ratings">How ratings work</a></p>
 </div></main></>;
}
