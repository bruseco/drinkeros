import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Star, Loader2, Flag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const UserBatalhaRecipeDetail: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [hover, setHover] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['club-recipe', id],
    queryFn: async () => {
      const { data: recipe } = await supabase.from('club_recipes').select('*').eq('id', id!).maybeSingle();
      if (!recipe) return null;
      const [{ data: votes }, { data: profile }] = await Promise.all([
        supabase.from('club_recipe_votes').select('rating, user_id').eq('recipe_id', id!),
        supabase.from('profiles').select('user_id, full_name, avatar_url, bio').eq('user_id', recipe.user_id).maybeSingle(),
      ]);
      const total = votes?.length || 0;
      const avg = total > 0 ? votes!.reduce((s, v) => s + v.rating, 0) / total : 0;
      const my = user ? votes?.find(v => v.user_id === user.id) : null;
      return { recipe, profile, avg, total, myVote: my?.rating || 0 };
    },
    enabled: !!id,
  });

  const handleVote = async (rating: number) => {
    if (!user || !data?.recipe) return;
    if (data.recipe.user_id === user.id) {
      toast.error('Você não pode votar na própria receita.');
      return;
    }
    const { error } = await supabase.from('club_recipe_votes').upsert(
      { recipe_id: data.recipe.id, user_id: user.id, rating },
      { onConflict: 'recipe_id,user_id' }
    );
    if (error) { toast.error(error.message); return; }
    toast.success('Voto registrado! +1 ponto');
    qc.invalidateQueries({ queryKey: ['club-recipe', id] });
    qc.invalidateQueries({ queryKey: ['club-feed'] });
    qc.invalidateQueries({ queryKey: ['club-my-points'] });
  };

  const handleReport = async () => {
    if (!data?.recipe) return;
    await supabase.from('club_recipes').update({ is_reported: true }).eq('id', data.recipe.id);
    toast.success('Receita denunciada. Nossa equipe vai analisar.');
  };

  const handleDelete = async () => {
    if (!data?.recipe || !confirm('Excluir esta receita?')) return;
    await supabase.from('club_recipes').delete().eq('id', data.recipe.id);
    toast.success('Receita excluída.');
    window.history.back();
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data?.recipe) return <div className="p-6 text-center text-muted-foreground">Receita não encontrada.</div>;

  const r = data.recipe;
  const isOwner = r.user_id === user?.id;
  const initial = (data.profile?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4 pb-24 md:pb-6 space-y-4">
      {r.image_url && <img src={r.image_url} alt={r.name} className="w-full aspect-video object-cover rounded-lg" />}

      <div>
        <h1 className="text-3xl font-bold">{r.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={data.profile?.avatar_url || undefined} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{data.profile?.full_name || 'Usuário'}</span>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="font-bold">{data.avg.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({data.total} votos)</span>
          </div>
        </div>
        {!isOwner && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Sua avaliação:</p>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => (
                <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => handleVote(i)}>
                  <Star className={`h-7 w-7 transition-colors ${i <= (hover || data.myVote) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
          </div>
        )}
        {isOwner && <p className="text-xs text-muted-foreground italic">Você não pode votar na própria receita.</p>}
      </Card>

      {r.description && (
        <div>
          <h2 className="font-semibold mb-1">Sobre a receita</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{r.description}</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-1">Ingredientes</h2>
        <p className="text-sm whitespace-pre-line">{r.ingredients}</p>
      </div>

      <div>
        <h2 className="font-semibold mb-1">Passo a passo</h2>
        <p className="text-sm whitespace-pre-line">{r.instructions}</p>
      </div>

      {r.characteristics?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.characteristics.map((c: string) => (
            <span key={c} className="text-xs px-2 py-1 rounded-full bg-muted">{c}</span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-4">
        {isOwner ? (
          <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleReport}><Flag className="h-4 w-4 mr-1" /> Denunciar</Button>
        )}
      </div>
    </div>
  );
};

export default UserBatalhaRecipeDetail;
