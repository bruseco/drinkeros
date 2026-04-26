import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trophy, Star } from 'lucide-react';
import { useCurrentWinner } from '@/hooks/useBatalha';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

export const WinnerPopup: React.FC = () => {
  const { user } = useAuth();
  const { data } = useCurrentWinner();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (data?.winner) setOpen(true);
  }, [data?.winner?.id]);

  if (!data?.winner || !data.recipe) return null;

  const handleDismiss = async () => {
    if (!user) return;
    await supabase.from('club_winner_dismissals').insert({
      user_id: user.id,
      winner_id: data.winner.id,
    });
    qc.invalidateQueries({ queryKey: ['club-current-winner'] });
    setOpen(false);
  };

  const initial = (data.profile?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 p-6 text-center">
          <Trophy className="mx-auto h-12 w-12 text-white drop-shadow-lg" />
          <h2 className="mt-2 text-xl font-bold text-white">Receita Vencedora do Mês!</h2>
        </div>
        {data.recipe.image_url && (
          <img src={data.recipe.image_url} alt={data.recipe.name} className="w-full h-48 object-cover" />
        )}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-2xl font-bold">{data.recipe.name}</h3>
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className={`h-4 w-4 ${i <= Math.round(data.winner.avg_rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {data.winner.avg_rating.toFixed(1)} ({data.winner.total_votes} votos)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-12 w-12">
              <AvatarImage src={data.profile?.avatar_url || undefined} />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{data.profile?.full_name || 'Usuário'}</p>
              {data.profile?.bio && <p className="text-xs text-muted-foreground line-clamp-2">{data.profile.bio}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDismiss} className="flex-1">Fechar</Button>
            <Button asChild className="flex-1">
              <Link to={`/app/batalha/receita/${data.recipe.id}`} onClick={handleDismiss}>Ver receita</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
