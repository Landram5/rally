import {CircleDot} from 'lucide-react';
/* eslint-disable @next/next/no-html-link-for-pages */

export default function PublicHeader(){
 return <header className="topbar public-topbar"><a className="brand" href="/"><span className="brand-mark"><CircleDot size={24}/></span>rally<span className="brand-period">.</span></a><nav aria-label="Public navigation"><a href="/">Home</a><a className="public-demo" href="/demo">Sample demo</a><a className="public-feedback" href="/feedback">Feedback</a><a className="public-signin" href="/login">Sign in</a></nav></header>
}
