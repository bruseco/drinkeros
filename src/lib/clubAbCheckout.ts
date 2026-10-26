const KEY='drinkeros:club-ab-checkout:v1';
export function rememberClubCheckoutVariant(variant:'a'|'b'|null){
 try{if(variant)sessionStorage.setItem(KEY,JSON.stringify({variant,at:Date.now()}));else sessionStorage.removeItem(KEY);}catch{}
}
export function clubCheckoutVariant(): 'a'|'b'|undefined {
 try{const value=JSON.parse(sessionStorage.getItem(KEY)||'null');if(value&&['a','b'].includes(value.variant)&&Date.now()-value.at>=0&&Date.now()-value.at<2*60*60*1000)return value.variant;}catch{}
 return undefined;
}
