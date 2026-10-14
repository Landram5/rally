// Registers Rally's slash commands with Discord. Run once, and again whenever the commands change.
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/discord-register-commands.mjs
// The token stays in your terminal; it is never written to a file.
const app=process.env.DISCORD_APP_ID,token=process.env.DISCORD_BOT_TOKEN;
if(!app||!token){console.error('Set DISCORD_APP_ID and DISCORD_BOT_TOKEN first.');process.exit(1);}
const commands=[{
 name:'rally',description:'Connect this channel to a Rally club chat',
 // Only people who can manage the server see and can use it (Rally checks again on every call).
 default_member_permissions:'32',dm_permission:false,
 options:[
  {type:1,name:'link',description:'Link this channel to a Rally club using the code from Rally',options:[{type:3,name:'code',description:'The 6 character code from Rally (club > Manage > Discord)',required:true,min_length:6,max_length:8}]},
  {type:1,name:'unlink',description:'Stop sharing messages between this channel and Rally'},
  {type:1,name:'status',description:'Show which Rally club this channel is linked to'},
 ],
},{
 name:'club',description:'Rally club info',dm_permission:false,
 options:[
  {type:1,name:'leaderboard',description:'Top rated players in the club linked to this channel'},
  {type:1,name:'next',description:'Upcoming sessions and tournaments for the club linked to this channel'},
  {type:1,name:'player',description:'Look up a Rally player',options:[{type:3,name:'name',description:'Player name',required:true,max_length:60}]},
  {type:1,name:'connect',description:'Connect your Discord account to your Rally player',options:[{type:3,name:'code',description:'The 6 character code from Rally (Account > Discord)',required:true,min_length:6,max_length:8}]},
 ],
}];
const res=await fetch(`https://discord.com/api/v10/applications/${app}/commands`,{method:'PUT',headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify(commands)});
if(!res.ok){console.error('Discord refused the commands:',res.status,await res.text());process.exit(1);}
console.log('Registered',(await res.json()).map(c=>'/'+c.name).join(', '));
