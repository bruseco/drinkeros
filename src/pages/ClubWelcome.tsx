import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Download,Share,Plus,Smartphone,CheckCircle2,Loader2} from 'lucide-react';
import {useAuth} from '@/contexts/AuthContext';
import {supabase} from '@/integrations/supabase/client';
import {clearDeferredInstallPrompt,getDeferredInstallPrompt,isIOSDevice,onInstallPromptChange} from '@/lib/installPrompt';
import FiscalAddressDialog from '@/components/user/FiscalAddressDialog';
import logo from '@/assets/logotipo-drinkeros.png';
export default function ClubWelcome(){
 const {user,isLoading}=useAuth();const navigate=useNavigate();
 const [available,setAvailable]=useState(!!getDeferredInstallPrompt());
 const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches);
 const [busy,setBusy]=useState(false),[fiscal,setFiscal]=useState(false),[message,setMessage]=useState('');
 const ios=isIOSDevice();
 useEffect(()=>onInstallPromptChange(()=>setAvailable(!!getDeferredInstallPrompt())),[]);
 useEffect(()=>{if(!isLoading&&!user)navigate('/login?redirect=/clube/boas-vindas',{replace:true})},[user,isLoading,navigate]);
 useEffect(()=>{const done=()=>{setInstalled(true);if(user)void (supabase.rpc as any)('record_engagement_prompt',{_prompt:'pwa',_action:'accepted'})};window.addEventListener('appinstalled',done);return()=>window.removeEventListener('appinstalled',done)},[user]);
 const proceed=()=>{try{sessionStorage.setItem('engagement-prompt-session','1')}catch{}setFiscal(true)};
 const install=async()=>{const prompt=getDeferredInstallPrompt();if(!prompt)return;setBusy(true);try{await prompt.prompt();const choice=await prompt.userChoice;clearDeferredInstallPrompt();setMessage(choice.outcome==='accepted'?'Confirme a instalação no navegador e abra pelo ícone na tela inicial.':'Você pode instalar depois. Seu acesso continua disponível.')}catch{setMessage('Use as instruções abaixo ou continue sem instalar.')}finally{setBusy(false)}};
 if(isLoading||!user)return <div className="min-h-screen bg-[#141414] grid place-items-center"><Loader2 className="animate-spin text-white"/></div>;
 return <main className="min-h-screen bg-[#141414] text-white px-5 py-10 flex items-center justify-center"><section className="max-w-md w-full text-center">
  <img src={logo} alt="Drinkeros" className="h-10 w-auto mx-auto mb-10"/>
  {installed?<CheckCircle2 className="text-green-400 mx-auto mb-5" size={60}/>:<Smartphone className="text-yellow-300 mx-auto mb-5" size={60}/>}
  <h1 className="text-3xl font-bold mb-4">{installed?'O Clube já está no seu aparelho':'Leve o Clube para sua tela inicial'}</h1>
  <p className="text-white/70 mb-8">{installed?'Abra pelo ícone e encontre suas receitas com um toque.':'Instale o aplicativo e abra suas receitas direto pelo ícone, sem precisar procurar o site.'}</p>
  {!installed&&<>
   {available&&!ios&&<button disabled={busy} onClick={()=>void install()} className="w-full rounded-xl bg-yellow-300 text-black font-bold py-4 flex justify-center gap-2 mb-6"><Download/>{busy?'Abrindo instalação…':'Instalar aplicativo'}</button>}
   <ol className="text-left rounded-2xl border border-white/15 p-5 mb-6 space-y-4 text-sm">
    {ios?<><li className="flex gap-3"><Share className="flex-none" size={20}/>No Safari, toque em Compartilhar.</li><li className="flex gap-3"><Plus className="flex-none" size={20}/>Escolha “Adicionar à Tela de Início”.</li><li>Confirme em “Adicionar” e abra pelo ícone.</li></>:<><li>Abra o menu do navegador (⋮ ou ⋯).</li><li>Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</li><li>Confirme a instalação. No computador, a opção também pode aparecer na barra de endereço.</li></>}
   </ol>
  </>}
  {message&&<p role="status" className="text-sm text-yellow-200 mb-5">{message}</p>}
  <button onClick={proceed} className="rounded-xl border border-white/25 w-full py-4 font-semibold">{installed?'Entrar no Clube':'Agora não — entrar no Clube'}</button>
  <p className="text-xs text-white/50 mt-5">A instalação é opcional. Você também pode usar o Clube pelo navegador.</p>
  <FiscalAddressDialog open={fiscal} userId={user.id} onDone={()=>navigate('/app/receitas',{replace:true})}/>
 </section></main>;
}
