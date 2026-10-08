// Colorways. Each id other than "forest" matches a [data-palette] block in app/theme.css.
export const PALETTES=[
  {id:'forest',label:'Forest'},
  {id:'ink',label:'Ink'},
  {id:'ocean',label:'Ocean'},
  {id:'plum',label:'Plum'},
] as const;
export type PaletteId=(typeof PALETTES)[number]['id'];
export const PALETTE_STORAGE_KEY='rally-palette';
export const isPalette=(value:string|null|undefined):value is PaletteId=>PALETTES.some(p=>p.id===value);

// Runs before first paint so the chosen colorway never flashes the default.
export const PALETTE_INIT_SCRIPT=`try{var p=localStorage.getItem('${PALETTE_STORAGE_KEY}');if(p&&p!=='forest'&&${JSON.stringify(PALETTES.map(x=>x.id))}.indexOf(p)>-1)document.documentElement.dataset.palette=p}catch(e){}`;