import type {MetadataRoute} from 'next';
import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';
const base='https://rallytt.net';

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const pages=['','/clubs','/help','/ratings','/install'].map(path=>({url:base+path}));
 if(!env.DB)return pages;
 const clubs=(await env.DB.prepare("SELECT id FROM clubs WHERE approval_status='approved' ORDER BY name").all<{id:string}>()).results;
 const events=(await env.DB.prepare("SELECT t.id FROM tournaments t JOIN clubs c ON c.id=t.club_id WHERE t.deleted_at IS NULL AND c.approval_status='approved' ORDER BY t.date DESC").all<{id:string}>()).results;
 return [...pages,...clubs.map(c=>({url:`${base}/clubs/${encodeURIComponent(c.id)}`})),...events.map(t=>({url:`${base}/tournaments/${encodeURIComponent(t.id)}`}))];
}
