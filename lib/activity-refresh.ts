export function startActivityRefresh(host:Pick<Window,'setInterval'|'clearInterval'|'addEventListener'|'removeEventListener'>,page:Pick<Document,'visibilityState'|'addEventListener'|'removeEventListener'>,refresh:()=>void){
 const update=()=>{if(page.visibilityState==='visible')refresh();};
 const timer=host.setInterval(update,30000);
 host.addEventListener('focus',update);page.addEventListener('visibilitychange',update);
 return()=>{host.clearInterval(timer);host.removeEventListener('focus',update);page.removeEventListener('visibilitychange',update);};
}
