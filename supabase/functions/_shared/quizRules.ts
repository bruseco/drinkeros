// Shared deterministic rules: no prices or browser dependencies here.
export type AnswerKey = 'A' | 'B' | 'C' | 'D';
export type QuestionId = 'q1' | 'q2_casa' | 'q2_profissional' | 'q2_empreender' | 'q3';
export type Answers = Partial<Record<QuestionId, AnswerKey>>;
export type QuizPath = 'casa' | 'profissional' | 'empreender';
export type ProfileId = 'pack' | 'clube' | 'xperience' | 'mixologia' | 'bordo' | 'delivery' | 'eventos';
export type QuizIcon = 'party' | 'sparkles' | 'flask' | 'wallet' | 'sprout' | 'book' | 'shuffle' | 'trophy' | 'wand' | 'library' | 'target' | 'store' | 'truck' | 'music' | 'ship';
export interface QuizOption { key: AnswerKey; label: string; icon: QuizIcon }
export interface QuizQuestion { id: QuestionId; title: string; options: QuizOption[] }
export const QUESTIONS: Record<QuestionId, QuizQuestion> = {
 q1: { id:'q1', title:'O que você quer com os drinks?', options:[
  {key:'A',icon:'party',label:'Fazer drinks incríveis pra curtir em casa com amigos e família'},
  {key:'B',icon:'trophy',label:'Trabalhar como bartender, conseguir emprego ou crescer na profissão'},
  {key:'C',icon:'store',label:'Ter meu próprio negócio de drinks'}]},
 q2_casa: {id:'q2_casa',title:'Quanto você quer se dedicar a isso?',options:[
  {key:'A',icon:'book',label:'Só quero umas receitas boas pra usar de vez em quando'},
  {key:'B',icon:'library',label:'Quero ter sempre receita nova pra testar e organizar minhas festas'},
  {key:'C',icon:'flask',label:'Quero aprender de verdade a criar meus próprios drinks'}]},
 q2_profissional:{id:'q2_profissional',title:'Como está sua experiência atrás do balcão?',options:[
  {key:'A',icon:'sprout',label:'Nunca trabalhei como bartender, quero começar'},
  {key:'B',icon:'wallet',label:'Já fiz uns freelas e eventos, quero ser contratado'},
  {key:'C',icon:'trophy',label:'Já trabalho em bar e quero crescer e ganhar mais'},
  {key:'D',icon:'ship',label:'Quero trabalhar fora, em navio ou no exterior'}]},
 q2_empreender:{id:'q2_empreender',title:'Qual negócio você quer montar?',options:[
  {key:'A',icon:'music',label:'Bar em festas e eventos'},
  {key:'B',icon:'truck',label:'Delivery de drinks engarrafados'},
  {key:'C',icon:'shuffle',label:'Ainda não sei'}]},
 q3:{id:'q3',title:'O que combina mais com você?',options:[
  {key:'A',icon:'truck',label:'Trabalhar de casa, criando um produto pra vender'},
  {key:'B',icon:'music',label:'Estar no meio da festa, atendendo gente e animando o evento'}]},
};
export function quizPath(a:Answers):QuizPath|null {return a.q1==='A'?'casa':a.q1==='B'?'profissional':a.q1==='C'?'empreender':null;}
export function getQuestionOrder(a:Answers):QuestionId[]{const path=quizPath(a);if(!path)return ['q1'];return ['q1',`q2_${path}` as QuestionId,...(path==='empreender'&&a.q2_empreender==='C'?['q3' as const]:[])];}
export function computeProfile(a:Answers):ProfileId {
 const order=getQuestionOrder(a);
 if(!quizPath(a)||order.some(id=>!QUESTIONS[id].options.some(o=>o.key===a[id])))throw Error('Responda todas as perguntas do seu caminho.');
 if(a.q1==='A')return ({A:'pack',B:'clube',C:'xperience'} as const)[a.q2_casa as 'A'|'B'|'C'];
 if(a.q1==='B')return a.q2_profissional==='A'?'xperience':a.q2_profissional==='D'?'bordo':'mixologia';
 return a.q2_empreender==='A'?'eventos':a.q2_empreender==='B'?'delivery':a.q3==='A'?'delivery':'eventos';
}
export interface QuizProfile {id:ProfileId;title:string;text:string;cta:string;path:string;product:string;slug:string;productType:'course'|'combo'|'club';image:'hobbie'|'bartender'|'empresario'}
export const PROFILES:Record<ProfileId,QuizProfile>={
 pack:{id:'pack',title:'Receitas para curtir em casa',text:'Receitas práticas para surpreender amigos e família quando quiser.',cta:'Conhecer meu desconto',path:'/quiz-pack-ebooks',product:'Pack 6 e-books',slug:'pacote-6-e-books',productType:'combo',image:'hobbie'},
 clube:{id:'clube',title:'Um repertório novo para cada festa',text:'Receitas em vídeo e um organizador para suas festas.',cta:'Conhecer meu desconto',path:'/quiz-clube',product:'Clube dos Drinkeros',slug:'clube-anual',productType:'club',image:'hobbie'},
 xperience:{id:'xperience',title:'Aprenda a criar seus próprios drinks',text:'Comece pelos fundamentos e avance nas técnicas da coquetelaria.',cta:'Conhecer meu desconto',path:'/quiz-xperience',product:'Drinkeros Xperience',slug:'drinkeros-xperience',productType:'course',image:'hobbie'},
 mixologia:{id:'mixologia',title:'Dê o próximo passo atrás do balcão',text:'Aprofunde sua técnica com o curso de Mixologia Avançada.',cta:'Conhecer meu desconto',path:'/quiz-mixologia-avancada',product:'Mixologia Avançada',slug:'mixologia-avancada',productType:'course',image:'bartender'},
 bordo:{id:'bordo',title:'Prepare sua carreira para o mundo',text:'Conheça a preparação para trabalhar como bartender em cruzeiros.',cta:'Conhecer meu desconto',path:'/quiz-bartender-a-bordo',product:'Bartender a Bordo',slug:'bartender-a-bordo',productType:'course',image:'bartender'},
 delivery:{id:'delivery',title:'Seu negócio de drinks engarrafados',text:'Aprenda produção, conservação e venda para seu delivery.',cta:'Conhecer meu desconto',path:'/quiz-drink-delivery',product:'Drink Delivery',slug:'drinkdelivery-engarrafados',productType:'course',image:'empresario'},
 eventos:{id:'eventos',title:'Transforme festas em seu negócio',text:'Aprenda a organizar e operar um bar para eventos.',cta:'Conhecer meu desconto',path:'/quiz-bar-para-eventos',product:'Bar para Eventos',slug:'bar-p-eventos',productType:'course',image:'empresario'},
};
export function allowedQuizProducts(profile:ProfileId,path:QuizPath):ProfileId[]{return [...new Set([profile,...(path==='casa'?(profile==='xperience'?['clube' as const]:profile==='clube'?['pack' as const]:[]):['clube' as const])])];}
export function cleanQuizAnswers(a:Answers):Answers {return Object.fromEntries(getQuestionOrder(a).map(id=>[id,a[id]])) as Answers;}
