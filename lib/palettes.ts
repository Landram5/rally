// Colorways. colors are only the preview swatches in the picker (brand, action); the real values live in theme.css.
// Colorways. Each id other than "forest" matches a [data-palette] block in app/theme.css.
export const PALETTES=[
  {id:'forest',label:'Forest',colors:['#1c352d','#d9ed64']},
  {id:'ink',label:'Ink',colors:['#14181d','#f2f5f7']},
  {id:'ocean',label:'Ocean',colors:['#0d2a47','#7cd6e6']},
  {id:'plum',label:'Plum',colors:['#2e1a33','#f1c27d']},
] as const;
export type PaletteId=(typeof PALETTES)[number]['id'];
export const PALETTE_STORAGE_KEY='rally-palette';
export const isPalette=(value:string|null|undefined):value is PaletteId=>PALETTES.some(p=>p.id===value);

// Runs before first paint so the chosen colorway never flashes the default.
export const PALETTE_INIT_SCRIPT=`try{var p=localStorage.getItem('${PALETTE_STORAGE_KEY}');if(p&&p!=='forest'&&${JSON.stringify(PALETTES.map(x=>x.id))}.indexOf(p)>-1)document.documentElement.dataset.palette=p}catch(e){}`;