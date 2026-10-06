import type {ReactNode} from 'react';
import {CircleDot} from 'lucide-react';
import PublicAccount from './public-account';
/* eslint-disable @next/next/no-html-link-for-pages */

export default function PublicHeader({account}:{account?:ReactNode}={}){
 return <header className="topbar public-topbar"><a className="brand" href="/"><span className="brand-mark"><CircleDot size={24}/></span>rally<span className="brand-period">.</span></a><nav aria-label="Public navigation"><a href="/">Home</a><a className="public-clubs" href="/clubs">Clubs</a><a className="public-demo" href="/demo">Sample demo</a><a className="public-feedback" href="/feedback">Feedback</a>{account??<PublicAccount/>}</nav></header>
}
