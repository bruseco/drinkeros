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
        <div className="grid gap-4 sm:grid-cols-2">
          {feed.map(r => {
            const initial = (r.author_name || 'U').charAt(0).toUpperCase();
            return (
              <Link key={r.id} to={`/app/batalha/receita/${r.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full relative">
                  {r.is_in_battle && (
                    <span className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-lime-400 text-lime-950 shadow-md">
                      Em Batalha
                    </span>
                  )}
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-muted" />
                  )}
                  <div className="p-3 space-y-2">
                    <h3 className="font-semibold truncate">{r.name}</h3>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={r.author_avatar || undefined} />
                        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">{r.author_name || 'Usuário'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{r.avg_rating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({r.total_votes})</span>
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
