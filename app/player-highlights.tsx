import type {PlayerHighlights} from '@/lib/player-highlights';

const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
// Quiet, factual highlights. Each badge appears only when it says something meaningful.
export default function PlayerHighlightBadges({highlights:h,name}:{highlights?:PlayerHighlights|null;name:(id:string)=>string}){
 if(!h)return null;const items:string[]=[];
 if(h.bestRating&&h.ratedMatches>=3)items.push(`Best rating ${h.bestRating.value} · ${dateLabel(h.bestRating.date)}`);
 if(h.longestWinStreak>=3)items.push(`Longest win streak ${h.longestWinStreak}${h.currentWinStreak===h.longestWinStreak?' · current':''}`);
 if(h.biggestUpset)items.push(`Biggest upset: beat ${h.biggestUpset.opponentName??name(h.biggestUpset.opponentId)} (rated ${h.biggestUpset.gap}+ higher) · ${dateLabel(h.biggestUpset.date)}`);
 if(!items.length)return null;
 return <ul className="highlight-badges" aria-label="Player highlights">{items.map(text=><li key={text}>{text}</li>)}</ul>;
}
