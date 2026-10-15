// What a new club still needs before it is easy for strangers to understand and join. Worked out from the club's own data, so there
// is nothing to save and a step that is done stays done.
export type SetupStep={id:'logo'|'about'|'where'|'join'|'address'|'members';title:string;detail:string;done:boolean};
type ClubFields={photo_url?:string|null;bio?:string|null;venue?:string|null;meeting_schedule?:string|null;contact?:string|null;joining_info?:string|null;slug?:string|null};
const filled=(v?:string|null)=>!!v&&v.trim().length>0;
export function setupSteps(club:ClubFields,activeMembers:number):SetupStep[]{
 return [
  {id:'logo',title:'Add a logo',detail:'A picture makes your club easy to spot in lists and chat.',done:!!club.photo_url},
  {id:'about',title:'Describe your club',detail:'A sentence or two on who you are and who can play.',done:filled(club.bio)},
  {id:'where',title:'Say where and when you play',detail:'The venue and your usual meeting times.',done:filled(club.venue)&&filled(club.meeting_schedule)},
  {id:'join',title:'Explain how to join',detail:'What a new person should know or bring, and how to reach you.',done:filled(club.joining_info)||filled(club.contact)},
  {id:'address',title:'Check your web address',detail:'A short link you can print or post, like rallytt.net/c/your-club.',done:filled(club.slug)},
  {id:'members',title:'Invite your first members',detail:'Share your invite link or QR code so people can join.',done:activeMembers>1},
 ];
}
export const setupProgress=(steps:SetupStep[])=>({done:steps.filter(s=>s.done).length,total:steps.length,complete:steps.every(s=>s.done)});
