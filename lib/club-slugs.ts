import {AppError} from './rally-errors';
// Short club addresses (rallytt.net/c/umbc). One current address per club; earlier ones keep pointing at the club.
export const MAX_OLD_SLUGS=5;
// Words that name a page or could be mistaken for the site itself.
const RESERVED=new Set(['admin','administrator','api','auth','account','announcements','about','c','clubhouse','clubs','demo','doubles','explore','feedback','head-to-head','help','install','join','login','logout','matches','new','offline','pairs','players','privacy','ratings','rally','rallytt','records','settings','signup','static','support','terms','tournaments','unaffiliated','welcome','www','_next']);
const PATTERN=/^[a-z0-9]+(-[a-z0-9]+)*$/;
// "UMBC Table Tennis!" -> "umbc-table-tennis". Accents are dropped, and the result is cut to 30 characters on a word boundary.
export function slugify(text:string){
 const base=text.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 if(base.length<=30)return base;
 const cut=base.slice(0,30),at=cut.lastIndexOf('-');return (at>=3?cut.slice(0,at):cut).replace(/-+$/,'');
}
export function checkSlug(raw:unknown){
 const slug=typeof raw==='string'?raw.trim().toLowerCase():'';
 if(slug.length<3||slug.length>30)throw new AppError(400,'Use 3 to 30 characters.');
 if(!PATTERN.test(slug))throw new AppError(400,'Use only letters, numbers and single hyphens, and start and end with a letter or number.');
 if(RESERVED.has(slug))throw new AppError(400,'That address is reserved. Try another.');
 return slug;
}
export const currentSlug=async(db:D1Database,clubId:string)=>(await db.prepare('SELECT slug FROM club_slugs WHERE club_id=? AND is_current=1').bind(clubId).first<{slug:string}>())?.slug??null;
// The club behind an address, current or old. The page decides what to show for clubs that are not live.
export async function resolveSlug(db:D1Database,raw:string){
 const slug=raw.trim().toLowerCase();if(!PATTERN.test(slug)||slug.length<3||slug.length>30)return null;
 return await db.prepare('SELECT s.club_id AS clubId,s.is_current AS isCurrent,c.approval_status AS status FROM club_slugs s JOIN clubs c ON c.id=s.club_id WHERE s.slug=?').bind(slug).first<{clubId:string;isCurrent:number;status:string}>();
}
// Picks or changes a club's address. Free addresses and the club's own old ones can be used; another club's cannot.
export async function setClubSlug(db:D1Database,clubId:string,raw:unknown,now=new Date().toISOString()){
 const slug=checkSlug(raw);
 const club=await db.prepare("SELECT approval_status FROM clubs WHERE id=?").bind(clubId).first<{approval_status:string}>();if(!club||club.approval_status==='rejected')throw new AppError(404,'Club not found.');
 const owner=await db.prepare('SELECT club_id FROM club_slugs WHERE slug=?').bind(slug).first<{club_id:string}>();
 if(owner&&owner.club_id!==clubId)throw new AppError(409,'That address is already taken. Try another.');
 const had=await db.prepare('SELECT slug,is_current FROM club_slugs WHERE club_id=?').bind(clubId).all<{slug:string;is_current:number}>();
 if(owner){if(had.results.find(r=>r.slug===slug)?.is_current)return {slug};
  await db.batch([db.prepare('UPDATE club_slugs SET is_current=0 WHERE club_id=? AND is_current=1').bind(clubId),db.prepare('UPDATE club_slugs SET is_current=1 WHERE slug=?').bind(slug)]);return {slug};}
 // A new address. Keep only the newest few old ones so addresses cannot be hoarded.
 const old=(await db.prepare('SELECT slug FROM club_slugs WHERE club_id=? AND is_current=0 ORDER BY created_at DESC,slug').bind(clubId).all<{slug:string}>()).results;
 const drop=old.slice(MAX_OLD_SLUGS-1).map(r=>r.slug);
 await db.batch([
  db.prepare('UPDATE club_slugs SET is_current=0 WHERE club_id=? AND is_current=1').bind(clubId),
  ...drop.map(s=>db.prepare('DELETE FROM club_slugs WHERE slug=? AND club_id=?').bind(s,clubId)),
  db.prepare('INSERT INTO club_slugs(slug,club_id,is_current,created_at) VALUES(?,?,1,?)').bind(slug,clubId,now),
 ]);
 return {slug};
}
// A new club gets an address from its name if one is free (best effort; never blocks creating the club).
export async function assignDefaultSlug(db:D1Database,clubId:string,name:string,location:string,now=new Date().toISOString()){
 const tries=[slugify(name),slugify(`${name} ${location.split(',')[0]}`)];
 for(let n=2;n<=5;n++)tries.push(`${slugify(name).slice(0,27)}-${n}`);
 for(const candidate of tries){
  try{checkSlug(candidate);}catch{continue;}
  try{await setClubSlug(db,clubId,candidate,now);return candidate;}catch(e){if(!(e instanceof AppError&&e.status===409))return null;}
 }
 return null;
}
