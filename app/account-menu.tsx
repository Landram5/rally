'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ChevronDown} from 'lucide-react';
import {toast} from 'sonner';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator} from '@/components/ui/dropdown-menu';
export default function AccountMenu({name,onProfile,demo=false,onReset,unreadCount=0}:{name:string;onProfile:()=>void;demo?:boolean;onReset?:()=>void;unreadCount?:number}){
 const [busy,setBusy]=useState(false);const router=useRouter();
 async function signOut(){setBusy(true);try{const r=await fetch('/api/auth/signout',{method:'POST'});if(!r.ok)throw new Error('Could not sign out. Try again.');router.push('/login');router.refresh();}catch(e){toast.error(e instanceof Error?e.message:'Could not sign out.');}finally{setBusy(false);}}
 return <div className="account-area"><button className="account-name" onClick={onProfile}>{name}</button><DropdownMenu><DropdownMenuTrigger className="account-menu-trigger" aria-label="Open account menu" disabled={busy}><ChevronDown size={18}/></DropdownMenuTrigger><DropdownMenuContent className="account-menu" align="end" sideOffset={8}><DropdownMenuItem onSelect={onProfile}>Edit player profile</DropdownMenuItem><DropdownMenuItem asChild><a href={demo?'/demo/account':'/account'}>Account settings</a></DropdownMenuItem><DropdownMenuItem asChild><a href={demo?'/demo/feedback':'/feedback'}>Request a feature / report a bug</a></DropdownMenuItem><DropdownMenuItem asChild><a href="/install">Add to Home Screen</a></DropdownMenuItem><DropdownMenuItem onSelect={()=>window.location.assign(demo?'/demo?tab=notifications':'/clubhouse?tab=notifications')}>Inbox{unreadCount?` (${unreadCount} unread)`:''}</DropdownMenuItem><DropdownMenuSeparator/>{demo?<><DropdownMenuItem onSelect={onReset}>Reset sample data</DropdownMenuItem><DropdownMenuItem asChild><a href="/login">Sign in to Rally</a></DropdownMenuItem></>:<DropdownMenuItem disabled={busy} onSelect={()=>void signOut()}>{busy?'Signing out…':'Sign out'}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div>;
}
