import {AppError} from './rally-errors';
import {PALETTES} from './palettes';
export type UiPreferences={palette:string;appearance:'light'|'dark'|'system';onboardingHidden:boolean};
const APPEARANCES=['light','dark','system'];
export const defaultUiPreferences:UiPreferences={palette:'forest',appearance:'light',onboardingHidden:false};
export async function readUiPreferences(db:D1Database,player:string):Promise<UiPreferences|null>{
 const row=await db.prepare('SELECT palette,appearance,onboarding_hidden FROM ui_preferences WHERE player_id=?').bind(player).first<{palette:string;appearance:UiPreferences['appearance'];onboarding_hidden:number}>();
 return row?{palette:row.palette,appearance:row.appearance,onboardingHidden:!!row.onboarding_hidden}:null;
}
// Saves only the fields that were sent, so changing the colour never resets the mode or a dismissed hint.
export async function saveUiPreferences(db:D1Database,player:string,body:Record<string,unknown>,now=new Date().toISOString()){
 const previous=await readUiPreferences(db,player)??defaultUiPreferences,next={...previous};
 if(body.palette!==undefined){if(typeof body.palette!=='string'||!PALETTES.some(p=>p.id===body.palette))throw new AppError(400,'Choose one of the available colors.');next.palette=body.palette}
 if(body.appearance!==undefined){if(typeof body.appearance!=='string'||!APPEARANCES.includes(body.appearance))throw new AppError(400,'Choose light, dark or device setting.');next.appearance=body.appearance as UiPreferences['appearance']}
 if(body.onboardingHidden!==undefined){if(typeof body.onboardingHidden!=='boolean')throw new AppError(400,'Invalid setting.');next.onboardingHidden=body.onboardingHidden}
 await db.prepare('INSERT INTO ui_preferences(player_id,palette,appearance,onboarding_hidden,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET palette=excluded.palette,appearance=excluded.appearance,onboarding_hidden=excluded.onboarding_hidden,updated_at=excluded.updated_at').bind(player,next.palette,next.appearance,next.onboardingHidden?1:0,now).run();
 return next;
}