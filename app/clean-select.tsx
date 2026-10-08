'use client';
import {Children,isValidElement,type ChangeEvent,type ReactElement,type ReactNode} from 'react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';

type Option={value:string;label:ReactNode;colors?:string[];disabled?:boolean};
type OptionProps={value?:string|number;children?:ReactNode;disabled?:boolean;'data-colors'?:string};
const text=(node:ReactNode):string=>Children.toArray(node).map(n=>typeof n==='string'||typeof n==='number'?String(n):isValidElement(n)?text((n.props as {children?:ReactNode}).children):'').join('');

function collect(children:ReactNode,into:Option[]=[]){
 Children.forEach(children,child=>{
  if(!isValidElement(child))return;
  const el=child as ReactElement<OptionProps&{children?:ReactNode}>;
  if(el.type==='option')into.push({value:el.props.value!==undefined?String(el.props.value):text(el.props.children),label:el.props.children,disabled:el.props.disabled,colors:el.props['data-colors']?.split(',')});
  else collect(el.props.children,into);
 });
 return into;
}

export function Swatches({colors}:{colors?:string[]}){
 return colors?.length?<span className="swatches" aria-hidden="true">{colors.map(c=><i key={c} style={{background:c}}/>)}</span>:null;
}

// A drop-in replacement for a native <select> with <option> children: same value/onChange/name/required
// behaviour, but the closed control and the open list are styled by the site theme.
export default function CleanSelect({children,value,defaultValue,onChange,name,required,disabled,id,className,'aria-label':ariaLabel}:{
 children:ReactNode;value?:string|number;defaultValue?:string;onChange?:(event:ChangeEvent<HTMLSelectElement>)=>void;name?:string;required?:boolean;disabled?:boolean;id?:string;className?:string;'aria-label'?:string;
}){
 const options=collect(children),placeholder=options.find(o=>o.value==='')?.label,items=options.filter(o=>o.value!=='');
 const emit=(next:string)=>onChange?.({target:{value:next,name},currentTarget:{value:next,name}} as unknown as ChangeEvent<HTMLSelectElement>);
 return <Select value={value===undefined?undefined:String(value)} defaultValue={defaultValue} onValueChange={emit} name={name} required={required} disabled={disabled}>
  <SelectTrigger id={id} aria-label={ariaLabel} className={`clean-select${className?' '+className:''}`}><SelectValue placeholder={placeholder}/></SelectTrigger>
  <SelectContent position="popper" sideOffset={6} className="clean-select-menu">
   {items.map(o=><SelectItem key={o.value} value={o.value} disabled={o.disabled}><Swatches colors={o.colors}/>{o.label}</SelectItem>)}
  </SelectContent>
 </Select>;
}