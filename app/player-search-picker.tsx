'use client';
import {useId,useState} from 'react';
import {Check,ChevronsUpDown,Search} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {Command,CommandInput,CommandList,CommandEmpty,CommandGroup,CommandItem} from '@/components/ui/command';
export default function PlayerSearchPicker({value,onChange,options,label}:{value:string;onChange:(id:string)=>void;options:{id:string;name:string}[];label:string}){
 const [open,setOpen]=useState(false);const listId=useId(),selected=options.find(p=>p.id===value);
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className="player-search-trigger" role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId}><Search size={16}/><span>{selected?.name??'Choose player'}</span><ChevronsUpDown size={14}/></button></PopoverTrigger><PopoverContent className="player-search-popover" align="start"><Command><CommandInput aria-label={`Search ${label.toLowerCase()}`} placeholder="Search players..."/><CommandList id={listId}><CommandEmpty>No players found.</CommandEmpty><CommandGroup>{options.map(player=><CommandItem key={player.id} value={player.id} keywords={[player.name]} onSelect={()=>{onChange(player.id);setOpen(false);}}><span>{player.name}</span>{value===player.id&&<Check size={16}/>}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
