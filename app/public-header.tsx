import {CircleDot} from 'lucide-react';
import Link from 'next/link';

export default function PublicHeader(){
 return <header className="topbar public-topbar"><Link className="brand" href="/"><span className="brand-mark"><CircleDot size={24}/></span>rally<span className="brand-period">.</span></Link><span className="brand-label">TABLE TENNIS, TOGETHER.</span><nav aria-label="Public navigation"><Link href="/">Clubhouse</Link><Link className="public-signin" href="/login">Sign in</Link></nav></header>
}
