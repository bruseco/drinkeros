import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {UserLayout} from './UserLayout';
const mocks=vi.hoisted(()=>({plan:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'buyer'},isLoading:false})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{phone:null}})})})}),rpc:mocks.plan}}));
vi.mock('@/hooks/useAccessTracking',()=>({useTrackDailyAppAccess:()=>{}}));
vi.mock('./UserNavbar',()=>({UserNavbar:()=>null}));vi.mock('./UserSidebar',()=>({UserSidebar:()=>null}));vi.mock('./PageTransition',()=>({PageTransition:({children}:any)=>children}));vi.mock('./EngagementOrchestrator',()=>({EngagementOrchestrator:()=>null}));vi.mock('./PwaSplashScreen',()=>({PwaSplashScreen:()=>null}));vi.mock('./VipDiscountCountdownBanner',()=>({VipDiscountCountdownBanner:()=>null}));vi.mock('./WelcomeOverlay',()=>({WelcomeOverlay:()=>null}));vi.mock('./ClubeIntroStickyBar',()=>({default:()=>null}));vi.mock('./ClubeRetriggerWatcher',()=>({default:()=>null}));vi.mock('./VipDiscountBootstrap',()=>({default:()=>null}));vi.mock('./FiscalPendingBanner',()=>({default:()=> <p>Aviso fiscal não bloqueante</p>}));
afterEach(cleanup);
it.each([['socio','Receitas liberadas'],['free','Completar cadastro']])('keeps paid Club access available without a phone: %s',async(plan,label)=>{
 mocks.plan.mockResolvedValue({data:plan});render(<MemoryRouter initialEntries={['/app/receitas']}><Routes><Route path="/app" element={<UserLayout/>}><Route path="receitas" element={<p>Receitas liberadas</p>}/></Route><Route path="/complete-profile" element={<p>Completar cadastro</p>}/></Routes></MemoryRouter>);expect(await screen.findByText(label)).toBeInTheDocument();if(plan==='socio')expect(screen.getByText('Aviso fiscal não bloqueante')).toBeInTheDocument();
});
