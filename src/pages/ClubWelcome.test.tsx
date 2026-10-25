import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import ClubWelcome from './ClubWelcome';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'buyer'},isLoading:false})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:vi.fn()}}));
vi.mock('@/components/user/FiscalAddressDialog',()=>({default:({open}:any)=>open?<p>Completar dados fiscais ou pular</p>:null}));
vi.mock('@/lib/installPrompt',()=>({getDeferredInstallPrompt:()=>null,isIOSDevice:()=>true,onInstallPromptChange:()=>()=>{},clearDeferredInstallPrompt:()=>{}}));
afterEach(cleanup);
it('offers iPhone instructions and allows access without installation before asking for fiscal details',()=>{
 render(<MemoryRouter><ClubWelcome/></MemoryRouter>);expect(screen.getByText('Leve o Clube para sua tela inicial')).toBeInTheDocument();expect(screen.getByText('No Safari, toque em Compartilhar.')).toBeInTheDocument();expect(screen.queryByText('Completar dados fiscais ou pular')).not.toBeInTheDocument();fireEvent.click(screen.getByText('Agora não — entrar no Clube'));expect(screen.getByText('Completar dados fiscais ou pular')).toBeInTheDocument();
});
