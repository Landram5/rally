import {AppError} from './rally-errors';
export type MatchFilters={player?:string;tournament?:string;from?:string;to?:string;mine?:boolean};
export function matchFilters(input:MatchFilters):Required<MatchFilters>{
 const date=(value='')=>{if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw new AppError(400,'Choose a valid match date.');return value;};
 const from=date(input.from),to=date(input.to);
 if(from&&to&&from>to)throw new AppError(400,'The start date must be on or before the end date.');
 return {player:(input.player??'').slice(0,80),tournament:(input.tournament??'all').slice(0,80),from,to,mine:!!input.mine};
}
export function matchesFilters(match:{a:string;b:string;tournament_id:string|null;played_on:string},filters:Required<MatchFilters>,self:string|null){
 return (!filters.player||match.a===filters.player||match.b===filters.player)&&(!filters.mine||match.a===self||match.b===self)&&(!filters.from||match.played_on>=filters.from)&&(!filters.to||match.played_on<=filters.to)&&(filters.tournament==='all'||(filters.tournament==='none'?!match.tournament_id:filters.tournament==='any'?!!match.tournament_id:match.tournament_id===filters.tournament));
}
