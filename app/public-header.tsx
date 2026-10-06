import {CircleDot} from 'lucide-react';
import Link from 'next/link';

export default function PublicHeader(){
 return <header className="topbar public-topbar"><Link className="brand" href="/"><span className="brand-mark"><CircleDot size={24}/></span>rally<span className="brand-period">.</span></Link><nav aria-label="Public navigation"><Link href="/">Clubhouse</Link><Link className="public-demo" href="/demo">Sample demo</Link><Link className="public-feedback" href="/feedback">Feedback</Link><Link className="public-signin" href="/login">Sign in</Link></nav></header>
}
