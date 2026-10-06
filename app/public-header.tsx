import type {ReactNode} from 'react';
import {CircleDot} from 'lucide-react';
import PublicAccount from './public-account';
import DemoAccountHeader from './demo-account-header';


export default function PublicHeader({account,demo=false}:{account?:ReactNode;demo?:boolean}={}){
 return <header className="topbar public-topbar"><a className="brand" href={demo?'/demo':'/'}><span className="brand-mark"><CircleDot size={24}/></span>rally<span className="brand-period">.</span></a><nav aria-label="Public navigation">{account??(demo?<DemoAccountHeader/>:<PublicAccount/>)}</nav></header>
}
