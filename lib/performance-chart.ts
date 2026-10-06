export function ratingChartBounds(values:number[]){
 const finite=values.filter(Number.isFinite);
 if(!finite.length)return {low:350,high:450};
 const minimum=Math.min(...finite),maximum=Math.max(...finite),padding=Math.max(20,(maximum-minimum)*.12);
 return {low:Math.max(0,Math.floor((minimum-padding)/25)*25),high:Math.ceil((maximum+padding)/25)*25};
}
