import type {RoomMember,RoomMessage} from '@/lib/rooms';
// Sample group chats for the demo. One shared store so the chat list and the open chat agree; nothing is sent anywhere.
export type RoomItem={id:string;name:string;description:string;role:'owner'|'member';members:number;lastMessage:string;lastAt:string;unread:number;notify:boolean;invitedBy:string|null};
export type RoomDetail={me:string;room:{id:string;name:string;archived:boolean;owner:boolean;notify:boolean};hasMore:boolean;messages:RoomMessage[];members:RoomMember[]};
const ago=(m:number)=>new Date(Date.now()-m*60000).toISOString();
export function createDemoGroups(){
 const members:RoomMember[]=[{id:'alex',name:'Alex Morgan',role:'owner',status:'active',photoVersion:null,clubs:['Harbor Table Tennis','Metro Table Tennis']},{id:'casey',name:'Casey Brooks',role:'member',status:'active',photoVersion:null,clubs:['Metro Table Tennis']},{id:'jamie',name:'Jamie Patel',role:'member',status:'active',photoVersion:null,clubs:['Campus Table Tennis']}];
 const m=(id:string,a:string,body:string,min:number):RoomMessage=>({id,roomId:'r1',authorId:a,authorName:members.find(x=>x.id===a)!.name,body,createdAt:ago(min),media:null,mine:a==='alex',canDelete:true});
 const msgs=[m('x1','casey','Can we align on league nights for November? Metro has Tuesdays free.',300),m('x2','jamie','Campus can do Wednesdays. Happy to host the first joint night.',240),m('x3','alex','Great. I will draft a schedule and share it here.',60)];
 const base={description:'',role:'owner' as const,notify:false,invitedBy:null};
 return {rooms:[{...base,id:'r1',name:'Maryland league leaders',description:'Scheduling and joint events',members:3,lastMessage:msgs[2].body,lastAt:msgs[2].createdAt,unread:1}] as RoomItem[],invitations:[{...base,id:'r2',name:'Tournament directors',role:'member' as const,members:5,lastMessage:'',lastAt:'',unread:0,invitedBy:'Taylor Park'}] as RoomItem[],
  details:{r1:{me:'alex',room:{id:'r1',name:'Maryland league leaders',archived:false,owner:true,notify:false},hasMore:false,messages:msgs,members}} as Record<string,RoomDetail>};
}
export const demoGroups=createDemoGroups();
