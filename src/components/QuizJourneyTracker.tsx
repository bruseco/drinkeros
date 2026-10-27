import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { quizJourneyAt } from '@/lib/quizJourney';
import { trackFunnel } from '@/lib/funnelTracking';

export default function QuizJourneyTracker() {
  const { pathname,search } = useLocation();
  useEffect(() => {
    if(new URLSearchParams(search).get('quiz')==='1')return;
    const step = quizJourneyAt(pathname);
    if (step) trackFunnel('quiz', step.event, { metadata: step.metadata });
  }, [pathname,search]);
  return null;
}
