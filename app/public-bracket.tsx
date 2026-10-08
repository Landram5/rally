'use client';
import BracketView from './bracket-view';
import type {Draw} from '@/lib/tournament-engine';
// Server pages cannot pass functions to client components, so the bracket receives plain data
// (a name lookup) and builds its own name function here.
export default function PublicBracket({draw,names}:{draw:Draw;names:Record<string,string>}){
 return <BracketView draw={draw} name={id=>id?names[id]??'Unknown player':'Awaiting player'}/>;
}
