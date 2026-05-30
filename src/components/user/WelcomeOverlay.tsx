import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles } from 'lucide-react';

const FLAG_KEY = 'drinkeros:just_signed_up';

export const WelcomeOverlay: React.FC = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    if (!user) return;
    const shouldShow = sessionStorage.getItem(FLAG_KEY) === '1';
    if (!shouldShow) return;
    sessionStorage.removeItem(FLAG_KEY);

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const name = (data?.full_name || '').split(' ')[0] || '';
      setFirstName(name);
      setVisible(true);

      window.setTimeout(() => setClosing(true), 2800);
      window.setTimeout(() => setVisible(false), 3400);
    })();
  }, [user]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6 transition-opacity duration-500 ${
        closing ? 'opacity-0' : 'opacity-100 animate-fade-in'
      }`}
      aria-hidden
    >
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-primary/20 p-4 mb-5 shadow-lg shadow-accent/20">
          <Sparkles className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-3xl font-bold text-white leading-tight">
          {firstName ? `Bem-vindo, ${firstName}!` : 'Bem-vindo aos Drinkeros!'}
        </h2>
        <p className="mt-3 text-white/80 text-base leading-snug">
          Sua jornada na mixologia começa agora. Explore receitas, cursos e muito mais. 🍹
        </p>
      </div>
    </div>
  );
};

export default WelcomeOverlay;
