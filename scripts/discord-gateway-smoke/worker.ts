// Local harness for the Discord gateway connection. Run through scripts/discord-gateway-smoke.mjs.
export {DiscordGateway} from '../../lib/discord-gateway';
export default {async fetch(request:Request,env:{DISCORD_GATEWAY:DurableObjectNamespace}){
 const url=new URL(request.url);
 return env.DISCORD_GATEWAY.get(env.DISCORD_GATEWAY.idFromName('main')).fetch('https://gateway'+url.pathname);
}};
