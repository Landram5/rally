// The scheduled job starts (or restarts) the Discord gateway connection when the bot is configured and a club is linked.
export async function ensureDiscordGateway(env:{DB:D1Database;DISCORD_BOT_TOKEN?:string;DISCORD_GATEWAY?:DurableObjectNamespace}){
 if(!env.DISCORD_BOT_TOKEN?.trim()||!env.DISCORD_GATEWAY)return;
 if(!await env.DB.prepare('SELECT 1 x FROM discord_links LIMIT 1').first())return;
 await env.DISCORD_GATEWAY.get(env.DISCORD_GATEWAY.idFromName('main')).fetch('https://gateway/ensure');
}
