export * from '../../supabase/functions/_shared/quizRules';
import type {QuizProfile} from '../../supabase/functions/_shared/quizRules';
export function quizAdParams(search:string):Record<string,string>{const result:Record<string,string>={};new URLSearchParams(search).forEach((v,k)=>{if(/^utm_(source|medium|campaign|content|term)$/.test(k)||k==='fbclid')result[k]=v.slice(0,500);});return result;}
export function buildDestinationUrl(profile:QuizProfile,search:string):string {const p=new URLSearchParams(quizAdParams(search));p.set('quiz_profile',profile.id);return `${profile.path}?${p}`;}
