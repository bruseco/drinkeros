import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import GuestClubCheckout from './GuestClubCheckout';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),signin:vi.fn(),initialize:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:mocks.invoke},auth:{signInWithPassword:mocks.signin}}}));
vi.mock('@/lib/publicClubOffer',()=>({publicClubOfferToken:()=> 'b'.repeat(64)}));
vi.mock('sonner',()=>({toast:{success:vi.fn()}}));
vi.mock('@mercadopago/sdk-react',()=>({initMercadoPago:mocks.initialize,CardPayment:({onSubmit}:any)=><button onClick={()=>onSubmit({token:'fake-card-token',payer:{email:'buyer@example.com'}})}>Confirmar pagamento de teste</button>,Payment:({onSubmit}:any)=><button onClick={()=>onSubmit({formData:{token:'fake-card-token',payer:{email:'buyer@example.com'}}})}>Confirmar pagamento de teste</button>}));
beforeEach(()=>{sessionStorage.clear();mocks.invoke.mockReset();mocks.signin.mockReset().mockResolvedValue({data:{user:{id:'new-user'}},error:null});mocks.invoke.mockImplementation(async(name,{body}:any={})=>{
 if(name==='get-mp-public-key')return{data:{publicKey:'TEST-public'}};
 if(body.action==='quote')return{data:{price:97}};
 if(body.action==='create')return{data:{status:'pending',amount:97}};
 if(body.action==='status')return{data:{status:'pending',amount:97}};
 if(body.action==='activate')return{data:{status:'activated',email:'buyer@example.com'}};
});});
afterEach(cleanup);
function show(monthly=false){render(<MemoryRouter initialEntries={['/checkout/club/clube-anual']}><Routes><Route path="/checkout/club/clube-anual" element={<GuestClubCheckout monthly={monthly}/>}/><Route path="/clube/boas-vindas" element={<p>Instalação opcional do aplicativo</p>}/><Route path="/login" element={<p>Login da conta existente</p>}/></Routes></MemoryRouter>)}
it('opens payment without requiring a password, signup or fiscal address',async()=>{
 show();expect(await screen.findByText('Confirmar pagamento de teste')).toBeInTheDocument();expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();expect(screen.queryByLabelText('CEP')).not.toBeInTheDocument();expect(mocks.initialize).toHaveBeenCalledWith('TEST-public',{locale:'pt-BR'});
 fireEvent.click(screen.getByText('Confirmar pagamento de teste'));
 await screen.findByText('Aguardando confirmação do pagamento');expect(screen.queryByText('Pagamento confirmado')).not.toBeInTheDocument();
 const create=mocks.invoke.mock.calls.find(([,options])=>options?.body?.action==='create');expect(create?.[1].body.expected_amount).toBe(97);expect(create?.[1].body).not.toHaveProperty('password');
});
it('shows password only after the server confirms a paid new account',async()=>{
 const original=mocks.invoke.getMockImplementation()!;mocks.invoke.mockImplementation(async(name,options)=>options?.body?.action==='create'?{data:{status:'paid',email:'buyer@example.com',can_activate:true}}:original(name,options));
 show();fireEvent.click(await screen.findByText('Confirmar pagamento de teste'));await screen.findByText('Pagamento confirmado');
 fireEvent.change(screen.getByLabelText('Senha'),{target:{value:'secure-password'}});fireEvent.change(screen.getByLabelText('Confirmar senha'),{target:{value:'secure-password'}});fireEvent.click(screen.getByText('Criar senha e entrar no Clube'));
 await screen.findByText('Instalação opcional do aplicativo');expect(mocks.signin).toHaveBeenCalledWith({email:'buyer@example.com',password:'secure-password'});
});
it('preserves an existing account password and offers its normal login',async()=>{
 const original=mocks.invoke.getMockImplementation()!;mocks.invoke.mockImplementation(async(name,options)=>options?.body?.action==='create'?{data:{status:'paid',email:'buyer@example.com',can_activate:false}}:original(name,options));
 show();fireEvent.click(await screen.findByText('Confirmar pagamento de teste'));await screen.findByText('Pagamento confirmado');expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();fireEvent.click(screen.getByText('Entrar com minha conta'));await screen.findByText('Login da conta existente');expect(mocks.signin).not.toHaveBeenCalled();
});
it('resumes a pending checkout after reload without submitting another payment',async()=>{
 sessionStorage.setItem('drinkeros:club-guest-attempt:v1','a'.repeat(64));show();await screen.findByText('Aguardando confirmação do pagamento');await waitFor(()=>expect(mocks.invoke.mock.calls.some(([,o])=>o?.body?.action==='status')).toBe(true));expect(mocks.invoke.mock.calls.some(([,o])=>o?.body?.action==='create')).toBe(false);
});

it('waits for the server quote without flashing a default price or opening payment',async()=>{
 const original=mocks.invoke.getMockImplementation()!;
 let resolveQuote!:(value:any)=>void;
 mocks.invoke.mockImplementation((name,options)=>options?.body?.action==='quote'?new Promise(resolve=>{resolveQuote=resolve}):original(name,options));
 show();
 expect(screen.getByRole('status')).toHaveTextContent('Confirmando valor');
 expect(screen.queryByText('R$ 197')).toBeNull();
 expect(screen.queryByText('Confirmar pagamento de teste')).toBeNull();
 await waitFor(()=>expect(resolveQuote).toBeTypeOf('function'));
 resolveQuote({data:{price:87}});
 expect(await screen.findByText('R$ 87')).toBeInTheDocument();
 expect(await screen.findByText('Confirmar pagamento de teste')).toBeInTheDocument();
 expect(screen.getByText('Receitas em vídeo, xaropes e organizador de festas — tudo liberado por 12 meses.')).toBeInTheDocument();
 expect(mocks.invoke.mock.calls.some(([,o])=>o?.body?.action==='create')).toBe(false);
});
it('does not offer payment if the quote fails',async()=>{
 mocks.invoke.mockResolvedValue({error:{message:'Network failure'}});
 show();await screen.findByRole('alert');
 expect(screen.queryByText('R$ 197')).toBeNull();expect(screen.queryByText('Confirmar pagamento de teste')).toBeNull();
});
it('keeps the amount of the resumed attempt when the current offer has a different price',async()=>{
 sessionStorage.setItem('drinkeros:club-guest-attempt:v1','a'.repeat(64));
 const original=mocks.invoke.getMockImplementation()!;
 mocks.invoke.mockImplementation(async(name,options)=>options?.body?.action==='status'?{data:{status:'pending',amount:87}}:options?.body?.action==='quote'?{data:{price:197}}:original(name,options));
 show();await screen.findByText('R$ 87');await waitFor(()=>expect(mocks.initialize).toHaveBeenCalled());
 expect(screen.queryByText('R$ 197')).toBeNull();
 expect(mocks.invoke.mock.calls.some(([,o])=>o?.body?.action==='create')).toBe(false);
});

it('opens monthly B directly on card, without a Pix selector or an annual promise',async()=>{
 const original=mocks.invoke.getMockImplementation()!;
 mocks.invoke.mockImplementation(async(name,options)=>options?.body?.action==='quote'?{data:{price:7,billing_months:1}}:original(name,options));
 show(true);await screen.findByText('R$ 7 / mês');await screen.findByText('Confirmar pagamento de teste');
 expect(screen.queryByRole('button',{name:/^Pix$/})).toBeNull();
 expect(screen.queryByRole('button',{name:/^Cartão$/})).toBeNull();
 expect(screen.queryByText(/tudo liberado por 12 meses/)).toBeNull();
 fireEvent.click(screen.getByText('Confirmar pagamento de teste'));
 await waitFor(()=>expect(mocks.invoke.mock.calls.find(([,o])=>o?.body?.action==='create')?.[1].body).toMatchObject({billing_plan:'monthly-b',method:'card',expected_amount:7}));
});

it('does not open monthly payment if an older server returns an annual quote',async()=>{
 show(true);await screen.findByRole('alert');
 expect(screen.queryByText('R$ 97 / mês')).toBeNull();
 expect(screen.queryByText('Confirmar pagamento de teste')).toBeNull();
});
