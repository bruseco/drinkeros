export type FunnelRange='today'|'7d'|'30d'|'all'|'custom';
export type FunnelDates={from:string;to:string};
export const EMPTY_FUNNEL_DATES:FunnelDates={from:'',to:''};
export const isFunnelRange=(value:string|null):value is FunnelRange=>['today','7d','30d','all','custom'].includes(value??'');
function localDate(value:string):Date|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);
 return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null;
}
export function customFunnelBounds(dates:FunnelDates){
 const start=localDate(dates.from),end=localDate(dates.to);
 if(!start||!end||start>end)return null;
 end.setDate(end.getDate()+1);
 return {since:start.toISOString(),until:end.toISOString()};
}
export function sinceFromRange(range:FunnelRange):string|null{
 const now=new Date();
 if(range==='today'){now.setHours(0,0,0,0);return now.toISOString()}
 if(range==='7d'||range==='30d')return new Date(now.getTime()-(range==='7d'?7:30)*86400000).toISOString();
 return null;
}
export function funnelPeriodBounds(range:FunnelRange,dates:FunnelDates=EMPTY_FUNNEL_DATES){
 return range==='custom'?customFunnelBounds(dates):{since:sinceFromRange(range),until:null};
}
export function funnelPeriodQuery(range:FunnelRange,dates:FunnelDates){
 const params=new URLSearchParams({periodo:range});
 if(range==='custom'){params.set('de',dates.from);params.set('ate',dates.to)}
 return params.toString();
}
