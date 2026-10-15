import Link from 'next/link';
import {Link2, Rocket, ShieldCheck} from 'lucide-react';
// For organizers who find Rally cold: what starting a club involves, in plain words.
export default function StartAClub({signedIn}:{signedIn:boolean}){
 const href=signedIn?'/clubhouse?tab=clubs':'/login?mode=signup&next='+encodeURIComponent('/clubhouse?tab=clubs');
 return <section className="start-club" aria-labelledby="start-club-title">
  <div><p className="eyebrow">RUN A CLUB?</p><h2 id="start-club-title">Bring your club to Rally</h2><p>Free for clubs and players. Set up in a few minutes, then invite everyone with one link.</p></div>
  <ul>
   <li><Rocket size={20} aria-hidden="true"/><span><b>Works right away</b><small>Create your club and start inviting. Chat, sessions, results and tournaments are ready.</small></span></li>
   <li><Link2 size={20} aria-hidden="true"/><span><b>Join with one link</b><small>Share an invite link or QR code. People join without waiting for approval.</small></span></li>
   <li><ShieldCheck size={20} aria-hidden="true"/><span><b>Listed after a quick check</b><small>Rally verifies each club before it appears in the public club list.</small></span></li>
  </ul>
  <div className="start-club-actions"><Link className="primary-action" href={href}>Start a club</Link><Link href="/help#start">How it works</Link></div>
 </section>;
}
