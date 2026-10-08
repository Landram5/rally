// Shared 1200x630 layout for generated share images. Satori needs explicit flex on every container.
const GREEN='#1f2f27',LIME='#d9ed64',MUTED='#a9bcb0';
export const OG_SIZE={width:1200,height:630};
export const OG_HEADERS={'Cache-Control':'public, max-age=300, s-maxage=3600'};
const clip=(text:string,max:number)=>text.length>max?text.slice(0,max-1)+'\u2026':text;
export type OgStat={value:string;label:string};
export function OgCard({eyebrow,title,subtitle,stats}:{eyebrow:string;title:string;subtitle?:string;stats:OgStat[]}){
 const name=clip(title,52);
 return <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:'100%',height:'100%',padding:'52px 64px',background:GREEN,color:'#f4f7f2'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
   <div style={{display:'flex',alignItems:'center'}}><div style={{display:'flex',alignItems:'center',justifyContent:'center',width:54,height:54,borderRadius:14,background:LIME,marginRight:16}}><div style={{display:'flex',width:26,height:26,borderRadius:13,border:`6px solid ${GREEN}`}}/></div><div style={{display:'flex',fontSize:46,color:'#ffffff'}}>rally.</div></div>
   <div style={{display:'flex',fontSize:26,letterSpacing:4,color:LIME}}>{eyebrow}</div>
  </div>
  <div style={{display:'flex',flexDirection:'column'}}>
   <div style={{display:'flex',fontSize:name.length>28?64:name.length>18?76:92,lineHeight:1.05,color:'#ffffff'}}>{name}</div>
   {subtitle&&<div style={{display:'flex',fontSize:32,color:MUTED,marginTop:16}}>{clip(subtitle,80)}</div>}
  </div>
  <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
   <div style={{display:'flex'}}>{stats.slice(0,4).map((s,i)=><div key={i} style={{display:'flex',flexDirection:'column',marginRight:56}}><div style={{display:'flex',fontSize:s.value.length>7?52:70,color:LIME,lineHeight:1}}>{clip(s.value,14)}</div><div style={{display:'flex',fontSize:24,color:MUTED,marginTop:8}}>{s.label}</div></div>)}</div>
   <div style={{display:'flex',fontSize:28,color:MUTED}}>rallytt.net</div>
  </div>
 </div>;
}
export const signedDelta=(n:number|undefined)=>n===undefined?'\u2014':n===0?'\u00b10.0':`${n>0?'+':'\u2212'}${Math.abs(n).toFixed(1)}`;
