import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBatalhaFeed, useBatalhaMyPoints } from '@/hooks/useBatalha';
import { BatalhaIntro, hasSeenBatalhaIntro } from '@/components/user/BatalhaIntro';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, Plus, Trophy, Loader2, HelpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useUserPlan } from '@/hooks/useUserPlan';
import { toast } from 'sonner';

const UserBatalha: React.FC = () => {
  const { data: feed, isLoading } = useBatalhaFeed();
  const { data: myPoints } = useBatalhaMyPoints();
  const { data: planData } = useUserPlan();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(() => !hasSeenBatalhaIntro());
  const [showExplainer, setShowExplainer] = useState(false);

  const handlePostClick = (e: React.MouseEvent) => {
    if (!planData?.isVip) {
      e.preventDefault();
      toast.info('Para postar na Batalha você precisa ser sócio do Clube dos Drinkeros.');
      navigate('/clube');
    }
  };


  if (showIntro) {
    return <BatalhaIntro onFinish={() => setShowIntro(false)} />;
  }

  return (
    <div className="container mx-auto max-w-3xl py-6 px-4 pb-24 md:pb-6 space-y-4">
      {showExplainer && (
        <BatalhaIntro
          initialStage="explainer"
          showCloseButton
          persistOnFinish={false}
          onFinish={() => setShowExplainer(false)}
        />
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Batalha dos Drinkeros</h1>
          <button
            type="button"
            onClick={() => setShowExplainer(true)}
            aria-label="Como funciona a Batalha"
            className="h-7 w-7 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <p className="text-muted-foreground text-sm">Compartilhe receitas e vote nas favoritas.</p>
      </div>

      {myPoints && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Seus pontos</p>
              <p className="text-2xl font-bold">{myPoints.points}</p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/batalha/ranking"><Trophy className="h-4 w-4 mr-1" /> Ranking</Link>
            </Button>
          </div>
        </Card>
      )}

      <Button asChild className="w-full">
        <Link to="/app/batalha/nova" onClick={handlePostClick}><Plus className="h-4 w-4 mr-1" /> Postar receita</Link>
      </Button>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !feed?.length ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhuma receita ainda. Seja o primeiro a postar!</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {feed.map(r => {
            const initial = (r.author_name || 'U').charAt(0).toUpperCase();
            const ingredientTags = (r.ingredients || '')
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
              .slice(0, 4);
            return (
              <Link key={r.id} to={`/app/batalha/receita/${r.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full relative">
                  <div className="flex">
                    <div className="relative w-1/2 shrink-0 aspect-square">
                      {r.is_in_battle && (
                        <span className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-lime-400 text-lime-950 shadow-md">
                          Em Batalha
                        </span>
                      )}
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{r.name}</h3>
                      <div className="flex items-center gap-0.5">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{r.avg_rating.toFixed(1)}</span>
                      </div>
                      {ingredientTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ingredientTags.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground truncate max-w-full">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-auto">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={r.author_avatar || undefined} />
                          <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] text-muted-foreground truncate">{r.author_name || 'Usuário'}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default UserBatalha;
