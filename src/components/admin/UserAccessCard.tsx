import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Plus, Calendar, Trash2, Infinity as InfinityIcon, Pencil, Check, X, Download, CircleDashed } from 'lucide-react';
import { useUpdateAccessExpiration, useRevokeAccess, type UserDetailContent } from '@/hooks/useUserDetail';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type AccessTable = 'user_courses' | 'user_ebooks' | 'user_combos' | 'user_packages' | 'user_exclusive_access';

interface Props {
  title: string;
  table: AccessTable;
  items: UserDetailContent[];
  onAdd: () => void;
}

export const UserAccessCard: React.FC<Props> = ({ title, table, items, onAdd }) => {
  const updateExpiration = useUpdateAccessExpiration();
  const revoke = useRevokeAccess();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (item: UserDetailContent) => {
    setEditing(item.id);
    setEditValue(item.expires_at ? item.expires_at.slice(0, 10) : '');
  };

  const saveEdit = (id: string) => {
    const expires_at = editValue ? new Date(editValue + 'T23:59:59').toISOString() : null;
    updateExpiration.mutate({ table, id, expires_at }, { onSuccess: () => setEditing(null) });
  };

  const isExpired = (date: string | null) => date && new Date(date) < new Date();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title} <span className="text-sm text-muted-foreground">({items.length})</span></h3>
          <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum {title.toLowerCase()} liberado.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                {item.cover_image_url && (
                  <img src={item.cover_image_url} alt={item.name} className="h-10 w-10 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>

                  {/* Course progress bar */}
                  {table === 'user_courses' && item.progress !== undefined && (
                    <div className="mt-1.5 mb-1">
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-muted-foreground">
                          {item.completed_lessons ?? 0}/{item.total_lessons ?? 0} aulas
                        </span>
                        <span className="font-semibold">{item.progress}%</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Comprado: {format(new Date(item.purchased_at), 'dd/MM/yyyy')}
                    </span>

                    {/* Ebook download badge */}
                    {table === 'user_ebooks' && (
                      item.downloaded ? (
                        <Badge variant="default" className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-600">
                          <Download className="h-3 w-3" />
                          Baixou {item.downloaded_at && `em ${format(new Date(item.downloaded_at), 'dd/MM/yyyy')}`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                          <CircleDashed className="h-3 w-3" />
                          Não baixou
                        </Badge>
                      )
                    )}

                    {editing === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 w-36 text-xs"
                          placeholder="Vitalício"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(item.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        {item.expires_at && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditValue(''); saveEdit(item.id); }}>
                            <InfinityIcon className="h-3 w-3 mr-1" /> Vitalício
                          </Button>
                        )}
                      </div>
                    ) : item.expires_at ? (
                      <Badge variant={isExpired(item.expires_at) ? 'destructive' : 'secondary'} className="text-xs gap-1">
                        <Calendar className="h-3 w-3" />
                        {isExpired(item.expires_at) ? 'Expirou' : 'Expira'} {format(new Date(item.expires_at), 'dd/MM/yyyy')}
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs gap-1">
                        <InfinityIcon className="h-3 w-3" /> Vitalício
                      </Badge>
                    )}
                  </div>
                </div>
                {editing !== item.id && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar acesso?</AlertDialogTitle>
                          <AlertDialogDescription>O aluno perderá o acesso a "{item.name}" imediatamente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revoke.mutate({ table, id: item.id })}>Revogar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
