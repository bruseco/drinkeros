import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useClubFeed, useClubMyPoints, tierColor } from '@/hooks/useClub';
import { BatalhaIntro, hasSeenBatalhaIntro } from '@/components/user/BatalhaIntro';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, Plus, Trophy, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

const UserClub: React.FC = () => {
  const { data: feed, isLoading } = useClubFeed();
  const { data: myPoints } = useClubMyPoints();
  const [showIntro, setShowIntro] = useState(() => !hasSeenBatalhaIntro());

  if (showIntro) {
    return <BatalhaIntro onFinish={() => setShowIntro(false)} />;
  }

  return (
    <div className="container mx-auto max-w-3xl py-6 px-4 pb-24 md:pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Batalha Drinkeros</h1>
          <p className="text-muted-foreground text-sm">Compartilhe receitas e vote nas favoritas.</p>
        </div>
        <Button asChild size="sm">
          <Link to="/app/clube/nova"><Plus className="h-4 w-4 mr-1" /> Postar</Link>
        </Button>
      </div>

      {myPoints && (
        <Card className={`p-4 bg-gradient-to-r ${tierColor(myPoints.tier)} text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90">Seu nível</p>
              <p className="text-lg font-bold">{myPoints.tier}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-90">Pontos</p>
              <p className="text-2xl font-bold">{myPoints.points}</p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/clube/ranking"><Trophy className="h-4 w-4 mr-1" /> Ranking</Link>
            </Button>
          </div>
        </Card>
      )}

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
              <Link key={r.id} to={`/app/clube/receita/${r.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
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

export default UserClub;
