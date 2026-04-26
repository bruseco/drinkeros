import React from 'react';
import { useBatalhaRanking, tierColor } from '@/hooks/useBatalha';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Trophy, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const UserBatalhaRanking: React.FC = () => {
  const { data, isLoading } = useBatalhaRanking();
  const { user } = useAuth();

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4 pb-24 md:pb-6 space-y-4">
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">Ranking do Clube</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {data?.map((p, idx) => {
            const isMe = p.user_id === user?.id;
            const initial = p.full_name.charAt(0).toUpperCase();
            return (
              <Card key={p.user_id} className={`p-3 flex items-center gap-3 ${isMe ? 'ring-2 ring-accent' : ''}`}>
                <span className="w-8 text-center font-bold text-muted-foreground">{idx + 1}º</span>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p.avatar_url || undefined} />
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.full_name}{isMe && ' (você)'}</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${tierColor(p.tier)} text-white font-medium`}>
                    {p.tier}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-bold">{p.points}</p>
                  <p className="text-[10px] text-muted-foreground">pontos</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserBatalhaRanking;
