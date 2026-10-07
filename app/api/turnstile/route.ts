import {env} from 'cloudflare:workers';
export function GET(){return Response.json({siteKey:env.TURNSTILE_SITE_KEY?.trim()??''},{headers:{'Cache-Control':'no-store'}});}
