import {ratingChangesByMatch,type SeedMatch} from './seeding';
// Display only: replays confirmed results in approved clubs with the unchanged rating model.
export async function loadRatingMatches(db:D1Database){
 return (await db.prepare("SELECT m.*,t.rating_weight AS tournament_weight,pa.initial_rating AS a_initial_rating,pb.initial_rating AS b_initial_rating FROM matches m JOIN clubs c ON c.id=m.club_id LEFT JOIN profiles pa ON pa.id=m.a LEFT JOIN profiles pb ON pb.id=m.b LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.status='confirmed' AND c.approval_status='approved' AND t.deleted_at IS NULL ORDER BY m.played_on DESC,m.created_at DESC").all<SeedMatch>()).results;
}
export async function loadRatingChanges(db:D1Database,matchIds?:string[]){
 if(matchIds&&!matchIds.length)return {};
 const all=ratingChangesByMatch(await loadRatingMatches(db));if(!matchIds)return all;
 return Object.fromEntries(matchIds.filter(id=>all[id]).map(id=>[id,all[id]]));
}
