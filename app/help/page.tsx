import Link from 'next/link';
import PublicHeader from '../public-header';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Help · Rally',description:'Short guides for Rally players and club organizers.'};
type Guide={id:string;title:string;steps:string[];link?:[string,string]};
// Short task guides. Keep each step one action, named the way it appears on screen.
const PLAYERS:Guide[]=[
 {id:'profile',title:'Set up your profile',steps:['Open the menu and choose Account settings.','Add a clear photo of your face so people at your club recognize you.','Check your name and add a short bio. Both show on your public player page.'],link:['/account','Account settings']},
 {id:'join',title:'Find and join a club',steps:['Open Clubs and search by club name or town.','Open the club and tap Request to join.','An organizer approves you. The club then appears under Clubs in your clubhouse.','If your club shared an invite link or QR code, opening it takes you straight to the club.'],link:['/clubs','Find a club']},
 {id:'record',title:'Record a match',steps:['Tap Record match.','Choose your club and your opponent.','Enter each game score, or use Live points to score as you play. Games go to 11, win by 2.','Save. Your opponent or an organizer confirms it, then it counts toward ratings.'],link:['/clubhouse?tab=matches','Matches']},
 {id:'confirm',title:'Confirm a match someone recorded',steps:['Open Inbox and look under Action needed, or open Matches and tap Needs confirming.','Check the score and confirm it.','If the score is wrong, open Match actions and report a problem instead.'],link:['/clubhouse?tab=notifications','Inbox']},
 {id:'rating',title:'How your rating works',steps:['Win to go up, lose to go down.','Beating a stronger player moves you more than beating a weaker one.','Your first 5 confirmed matches show as New. After that your rating is Established.','Tournament matches count extra, and older results slowly count less.'],link:['/ratings','Full ratings guide']},
 {id:'sessions',title:'Club sessions and open play',steps:['Open your club and go to Sessions.','RSVP to let organizers know you are coming, and see who else is going.','At the club? Tap “I’m here and want a game” so other members know you are free to play.'],link:['/clubhouse?tab=clubs','My clubs']},
 {id:'tournament',title:'Enter a tournament',steps:['Open Tournaments and choose an event.','Tap Register. If it is full you join the waitlist and move up automatically.','On the day, check in when the organizer opens check-in.','Follow the draw on the tournament page. Spectators can use the public link or QR code.'],link:['/clubhouse?tab=tournaments','Tournaments']},
 {id:'chat',title:'Chat and messages',steps:['Club chat: open your club and tap Chat. Every active member can read it.','Direct messages: open Messages and tap the pencil to message someone who shares a club with you.','Group chats: from the pencil, choose New group chat, name it and invite people.','You can send photos and short videos in all of them.'],link:['/clubhouse?tab=messages','Messages']},
 {id:'safety',title:'Block or report someone',steps:['In a conversation, open the ⋯ menu.','Block stops that person from messaging you. You can undo it under Messages ⋯ Blocked people.','Report sends the message and a little context to Rally’s administrators. Reports in a club chat go to that club’s organizers.']},
 {id:'doubles',title:'Doubles',steps:['Open Matches, scroll to Doubles and tap Record doubles.','Pick both pairs and enter the scores.','Doubles have their own rating and never change your singles rating.'],link:['/doubles','Doubles leaderboard']},
 {id:'alerts',title:'Notifications and phone alerts',steps:['Open Account settings, then Notifications, and switch on what you want.','To get alerts by email or on your phone, switch on Email or Phone alerts.','For phone alerts, tap Turn on alerts on this device on each phone you use. On iPhone, add Rally to your Home Screen first.'],link:['/account#notifications','Notification settings']},
 {id:'install',title:'Put Rally on your phone',steps:['iPhone: open rallytt.net in Safari, tap Share, then Add to Home Screen.','Android: open it in Chrome, open the ⋮ menu, then Install app.'],link:['/install','Step-by-step install guide']},
 {id:'claim',title:'Claim results you played as a guest',steps:['If an organizer entered your matches before you had an account, open Records & requests.','Ask to claim the guest record. An organizer confirms it is you and joins the results to your account.'],link:['/records','Records & requests']},
];
const ORGANIZERS:Guide[]=[
 {id:'start',title:'Start a club',steps:['Open your clubhouse and go to Clubs.','Tap Create club and enter its name and town.','Your club works right away: invite members, chat, schedule sessions and record matches. It shows up in Rally’s public club list once Rally has verified it.'],link:['/clubhouse?tab=clubs','My clubs']},
 {id:'profile-club',title:'Fill in your club page',steps:['Open your club and tap Manage.','Under Club details, tap Edit club information and add a bio, venue, meeting times, contact and how to join.','Tap Edit club images to add a logo and banner. A complete page helps new players decide to join.']},
 {id:'invite',title:'Invite members',steps:['On your club page, tap Share club / invite members to copy the link or show a QR code.','People who open it can request to join.','Approve them in Manage, under Requests.']},
 {id:'roles',title:'Give people roles',steps:['In Manage, open Members & roles and tap Edit next to a member.','Administrators and board members can create tournaments and confirm results.','Only the owner can change roles. You can hand the club to someone else in Account settings, under Club ownership.']},
 {id:'guests',title:'Add guest players',steps:['For someone without an account, open Manage, then Club details, then Guest players.','Enter their name. You can record matches for them right away.','If they join later, they can claim those results.']},
 {id:'sessions-org',title:'Schedule sessions',steps:['Open your club and go to Sessions.','Tap Create session, set the time and an optional player limit, and choose whether it repeats weekly.','Members RSVP, and you can see who is coming.']},
 {id:'announce',title:'Post an announcement',steps:['Open Manage, then Announcements.','Write a title and message, preview it and publish.','Active members see it once as a pop-up, and it stays in their inbox.']},
 {id:'tournament-org',title:'Run a tournament',steps:['Open Tournaments and tap Create tournament. Choose the format, number of players and match length.','Open registration. You can allow visiting players from other clubs.','On the day, open check-in, then start the draw.','Enter results as matches finish, or add scorekeepers to do it. Put the Venue display on a TV for players to follow along.'],link:['/clubhouse?tab=tournaments','Tournaments']},
 {id:'seasons',title:'Run a club ladder or season',steps:['Open your club and go to Competition.','Tap Create season and set the dates.','The season standings use only matches played during those dates.']},
 {id:'verify',title:'Confirm results',steps:['Open Matches and tap Needs confirming.','Confirm results that look right, or fix the score through Match actions.','Results you record as an organizer count right away.']},
 {id:'discord',title:'Connect your Discord server',steps:['Open Manage, then Discord, and tap Link a Discord channel.','Invite the Rally bot to your server, then run /rally link with the code in the channel you want.','Club chat now appears in both places. Choose where announcements and match results are posted.']},
 {id:'export',title:'Export your club’s data',steps:['Open Manage, then Club details.','Download the roster, results or ratings as a spreadsheet (CSV).']},
];
function Section({id,title,intro,guides}:{id:string;title:string;intro:string;guides:Guide[]}){
 return <section id={id} className="help-section"><h2>{title}</h2><p>{intro}</p>
  {guides.map(g=><details key={g.id} id={g.id} className="help-guide"><summary>{g.title}</summary><ol>{g.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>{g.link&&<Link href={g.link[0]}>{g.link[1]}</Link>}</details>)}
 </section>;
}
export default function Help(){return <><PublicHeader/><main className="legal-page help-page">
 <h1>Help</h1>
 <p className="help-lede">Short guides for the things people do most. Tap a topic to open it.</p>
 <nav className="club-jump" aria-label="Help sections"><a href="#players">For players</a><a href="#organizers">For organizers</a><a href="#contact">Get in touch</a></nav>
 <Section id="players" title="For players" intro="Joining a club, recording matches, and keeping up with your club." guides={PLAYERS}/>
 <Section id="organizers" title="For organizers" intro="Setting up a club and running it, from members to tournaments." guides={ORGANIZERS}/>
 <section id="contact" className="help-section"><h2>Still stuck, or something looks wrong?</h2><p>Send a bug report or a feature request. Say which page you were on, what you did and what you expected.</p><Link href="/feedback">Contact / feedback</Link></section>
</main></>}
