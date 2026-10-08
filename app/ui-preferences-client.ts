// Fire-and-forget save of interface preferences to the signed-in account (no-ops in the sample demo and when signed out).
export function saveUiPreference(partial:{palette?:string;appearance?:string;onboardingHidden?:boolean}){
 try{
  if(typeof fetch!=='function'||location.pathname==='/demo'||location.pathname.startsWith('/demo/'))return;
  void fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_ui_preferences',...partial})}).catch(()=>{});
 }catch{/* preferences still apply on this device */}
}