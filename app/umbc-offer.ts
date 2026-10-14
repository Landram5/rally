import {toast} from 'sonner';
import {applyPalette,currentPalette} from './ui-preferences-client';
// Shown after someone asks to join the UMBC club. Applying it offers a 5 second Revert; it can also be changed in Account settings.
export const isUmbcClub=(name:string)=>/UMBC/i.test(name);
export function offerUmbcColorway(){
 if(currentPalette()==='umbc')return;
 toast('Use the UMBC colors?',{description:'Switch Rally to UMBC black and gold. You can change it any time in Account settings.',duration:15000,action:{label:'Switch',onClick:()=>{
  const previous=currentPalette();applyPalette('umbc');
  toast.success('UMBC colors applied.',{duration:5000,action:{label:'Revert',onClick:()=>applyPalette(previous)}});
 }}});
}
