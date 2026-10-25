import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import QuizAnswerMetrics from './QuizAnswerMetrics';
const mocks=vi.hoisted(()=>({query:vi.fn(),rpc:vi.fn()}));
vi.mock('@tanstack/react-query',()=>({useQuery:(options:unknown)=>mocks.query(options)}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc}}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
it('uses each question’s own denominator and shows the conditional fourth question',()=>{
 mocks.query.mockReturnValue({data:[{question:'q1',answer:'A',count:3},{question:'q1',answer:'B',count:1},{question:'q4',answer:'B',count:2}],isLoading:false,isError:false});
 render(<QuizAnswerMetrics range="30d"/>);const q1=screen.getByRole('heading',{name:'1. O que te trouxe até aqui?'}).closest('article')!;expect(within(q1).getByText('4 respostas')).toBeInTheDocument();expect(within(q1).getByText('75%')).toBeInTheDocument();expect(within(q1).getAllByRole('meter')[0]).toHaveAttribute('aria-valuenow','3');expect(within(q1).getAllByRole('meter')[0]).toHaveAttribute('aria-valuemax','4');const q4=screen.getByRole('heading',{name:'4. Como você se imagina ganhando dinheiro com drinks?'}).closest('article')!;expect(within(q4).getByText('100%')).toBeInTheDocument();expect(within(q4).getByText(/Pergunta condicional/)).toBeInTheDocument();
});
it('preserves unknown alternatives in the denominator and distinguishes empty periods',()=>{
 mocks.query.mockReturnValue({data:[{question:'q1',answer:'A',count:1},{question:'q1',answer:null,count:1}],isLoading:false,isError:false});render(<QuizAnswerMetrics range="all"/>);expect(screen.getByText('50%')).toBeInTheDocument();expect(screen.getByText(/1 respostas sem alternativa identificada/)).toBeInTheDocument();expect(screen.getAllByText('Sem respostas no período.')).toHaveLength(3);
});
it('sends the shared period to the aggregate RPC',async()=>{
 mocks.query.mockReturnValue({isLoading:true});mocks.rpc.mockResolvedValue({data:[],error:null});render(<QuizAnswerMetrics range="all"/>);const options=mocks.query.mock.calls.at(-1)![0];await options.queryFn();expect(mocks.rpc).toHaveBeenCalledWith('get_quiz_answer_metrics',{_since:null});expect(options.queryKey).toEqual(['quiz-answer-metrics','all']);
});
it('shows errors rather than pretending the answers are zero',()=>{
 mocks.query.mockReturnValue({isError:true});render(<QuizAnswerMetrics range="7d"/>);expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');expect(screen.queryByText('Sem respostas no período.')).not.toBeInTheDocument();
});
