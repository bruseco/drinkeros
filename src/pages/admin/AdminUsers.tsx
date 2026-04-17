import React, { useState, useMemo } from 'react';
import { useAdminUsers, useUpdateUserRole, useUpdateUserAccess, useCreateUser, useResendWelcomeEmail, useResetUserPassword, useUpdateUserProfile, useDeleteUser, UserWithRole } from '@/hooks/useAdminUsers';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCourses } from '@/hooks/useCourses';
import { useEbooks } from '@/hooks/useEbooks';
import { useCombos } from '@/hooks/useCombos';
import { useToggleExclusiveAccess } from '@/hooks/useExclusiveAccess';
import { useLifetimeAccessUsers, useToggleLifetimeAccess } from '@/hooks/useLifetimeAccess';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Users, Shield, Package, Loader2, Edit, Plus, Mail, MoreHorizontal, Send, ChevronLeft, ChevronRight, Key, Pencil, Crown, Trash2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type AppRole = Database['public']['Enums']['app_role'];
type AccessType = 'course' | 'ebook' | 'exclusive' | 'combo';

interface AccessItem {
  id: string;
  name: string;
  type: 'course' | 'ebook' | 'combo' | 'exclusive';
}

const PAGE_SIZE = 50;

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  editor: 'Editor',
  viewer: 'Visualizador',
};

const roleBadgeVariant: Record<AppRole | 'student', 'default' | 'secondary' | 'outline' | 'destructive'> = {
  super_admin: 'destructive',
  editor: 'default',
  viewer: 'secondary',
  student: 'outline',
};

const typeBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  course: 'secondary',
  ebook: 'outline',
  combo: 'default',
  exclusive: 'default',
};

const typeLabel: Record<string, string> = {
  course: 'Curso',
  ebook: 'E-book',
  combo: 'Pacote',
  exclusive: 'Exclusivo',
};

// Reusable access list component
const AccessItemList: React.FC<{
  items: AccessItem[];
  selectedIds: Set<string>;
  onToggle: (id: string, type: 'course' | 'ebook' | 'combo' | 'exclusive') => void;
  searchFilter: string;
  typeFilter: AccessType;
  onSearchChange: (v: string) => void;
  onTypeChange: (v: AccessType) => void;
  maxHeight?: string;
}> = ({ items, selectedIds, onToggle, searchFilter, typeFilter, onSearchChange, onTypeChange, maxHeight = '60vh' }) => {
  const filtered = useMemo(() => {
    let list = items.filter((i) => i.type === typeFilter);
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, typeFilter, searchFilter]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={searchFilter}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <Tabs value={typeFilter} onValueChange={(v) => onTypeChange(v as AccessType)}>
         <TabsList className="w-full">
          <TabsTrigger value="course" className="flex-1">Cursos</TabsTrigger>
          <TabsTrigger value="ebook" className="flex-1">E-books</TabsTrigger>
          <TabsTrigger value="exclusive" className="flex-1">Exclusivo</TabsTrigger>
          <TabsTrigger value="combo" className="flex-1">Pacotes</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className={`space-y-2 overflow-y-auto pr-1`} style={{ maxHeight }}>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum item encontrado</p>
        ) : (
          filtered.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <Checkbox
                id={`${item.type}-${item.id}`}
                checked={selectedIds.has(`${item.type}:${item.id}`)}
                onCheckedChange={() => onToggle(item.id, item.type)}
              />
              <label htmlFor={`${item.type}-${item.id}`} className="flex-1 cursor-pointer text-sm font-medium leading-none">
                {item.name}
              </label>
              <Badge variant={typeBadgeVariant[item.type]} className="text-xs shrink-0">
                {typeLabel[item.type]}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AdminUsers: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedAccess, setSelectedAccess] = useState<Set<string>>(new Set());
  const [accessSearch, setAccessSearch] = useState('');
  const [accessType, setAccessType] = useState<AccessType>('course');

  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserAccess, setNewUserAccess] = useState<Set<string>>(new Set());
  const [newAccessSearch, setNewAccessSearch] = useState('');
  const [newAccessType, setNewAccessType] = useState<AccessType>('course');

  const debouncedSearch = useDebounce(search, 300);
  
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading } = useAdminUsers(page, PAGE_SIZE, debouncedSearch);
  const users = data?.users ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: allCourses = [] } = useCourses();
  const { data: allEbooks = [] } = useEbooks();
  const { data: allCombos = [] } = useCombos();
  const updateRole = useUpdateUserRole();
  const updateAccess = useUpdateUserAccess();
  const toggleExclusive = useToggleExclusiveAccess();
  const toggleLifetime = useToggleLifetimeAccess();
  const userIds = useMemo(() => users.map(u => u.user_id), [users]);
  const { data: lifetimeSet = new Set<string>() } = useLifetimeAccessUsers(userIds);
  const createUser = useCreateUser();
  const resendEmail = useResendWelcomeEmail();
  const resetPassword = useResetUserPassword();
  const updateProfile = useUpdateUserProfile();
  const deleteUserMutation = useDeleteUser();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Build unified sorted list
  const accessItems: AccessItem[] = useMemo(() => {
    const courses = allCourses.map((c) => ({ id: c.id, name: c.name, type: 'course' as const }));
    const ebooks = allEbooks.map((e) => ({ id: e.id, name: e.name, type: 'ebook' as const }));
    const combos = allCombos.map((c) => ({ id: c.id, name: c.name, type: 'combo' as const }));
    const exclusiveItems: AccessItem[] = [
      { id: 'receitas', name: 'Receitas', type: 'exclusive' as const },
    ];
    return [
      ...courses.sort((a, b) => a.name.localeCompare(b.name)),
      ...ebooks.sort((a, b) => a.name.localeCompare(b.name)),
      ...exclusiveItems,
      ...combos.sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [allCourses, allEbooks, allCombos]);

  const handleResendEmail = (user: UserWithRole) => {
    resendEmail.mutate(user.user_id);
  };

  const handleRoleChange = (user: UserWithRole, newRole: string) => {
    const role = newRole === 'student' ? null : (newRole as AppRole);
    updateRole.mutate({
      userId: user.user_id,
      role,
      existingRoleId: user.role_id,
    });
  };

  const getRoleDisplay = (user: UserWithRole) => {
    return user.role || 'student';
  };

  // --- Access dialog helpers ---
  const buildAccessSet = (user: UserWithRole): Set<string> => {
    const s = new Set<string>();
    user.course_ids.forEach((id) => s.add(`course:${id}`));
    user.ebook_ids.forEach((id) => s.add(`ebook:${id}`));
    user.combo_ids.forEach((id) => s.add(`combo:${id}`));
    if (user.has_receitas) s.add('exclusive:receitas');
    return s;
  };

  const toggleAccess = (set: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, type: string) => {
    const key = `${type}:${id}`;
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const idsFromSet = (set: Set<string>, type: string) =>
    Array.from(set).filter((k) => k.startsWith(`${type}:`)).map((k) => k.split(':')[1]);

  const openAccessDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedAccess(buildAccessSet(user));
    setAccessSearch('');
    setAccessType('course');
  };

  const closeAccessDialog = () => {
    setSelectedUser(null);
    setSelectedAccess(new Set());
  };

  const saveAccess = async () => {
    if (!selectedUser) return;
    
    const newReceitasAccess = selectedAccess.has('exclusive:receitas');

    // Save course/ebook/combo access
    updateAccess.mutate(
      {
        userId: selectedUser.user_id,
        currentPackageIds: selectedUser.package_ids,
        newPackageIds: selectedUser.package_ids,
        currentComboIds: selectedUser.combo_ids,
        newComboIds: idsFromSet(selectedAccess, 'combo'),
        currentCourseIds: selectedUser.course_ids,
        newCourseIds: idsFromSet(selectedAccess, 'course'),
        currentEbookIds: selectedUser.ebook_ids,
        newEbookIds: idsFromSet(selectedAccess, 'ebook'),
      },
    );

    // Toggle receitas access if changed
    if (newReceitasAccess !== selectedUser.has_receitas) {
      toggleExclusive.mutate(
        { userId: selectedUser.user_id, feature: 'receitas', grant: newReceitasAccess },
        {
          onSuccess: () => {
            toast({ title: newReceitasAccess ? 'Acesso às Receitas concedido' : 'Acesso às Receitas removido' });
          },
        },
      );
    }
    
    closeAccessDialog();
  };

  // --- Create dialog ---
  const openCreateDialog = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserAccess(new Set());
    setNewAccessSearch('');
    setNewAccessType('course');
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => setIsCreateDialogOpen(false);

  const handleCreateUser = () => {
    if (!newUserEmail) return;
    const courseIds = idsFromSet(newUserAccess, 'course');
    const ebookIds = idsFromSet(newUserAccess, 'ebook');
    const comboIds = idsFromSet(newUserAccess, 'combo');
    const grantReceitas = newUserAccess.has('exclusive:receitas');
    createUser.mutate(
      {
        email: newUserEmail,
        fullName: newUserName || undefined,
        courseIds: courseIds.length > 0 ? courseIds : undefined,
        ebookIds: ebookIds.length > 0 ? ebookIds : undefined,
        comboIds: comboIds.length > 0 ? comboIds : undefined,
      },
      {
        onSuccess: (result) => {
          if (grantReceitas && result?.user?.id) {
            toggleExclusive.mutate({ userId: result.user.id, feature: 'receitas', grant: true });
          }
          closeCreateDialog();
        },
      }
    );
  };

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalCount);

  if (isLoading && users.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários e suas permissões</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Usuário
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Equipe Administrativa</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.role === 'super_admin' || u.role === 'editor').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nesta Página</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por email ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Acessos</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isCurrentUser = user.user_id === currentUser?.id;
                  const currentRole = getRoleDisplay(user);

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.full_name || 'Sem nome'}
                            {isCurrentUser && (
                              <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                            )}
                          </span>
                          <span className="text-sm text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={currentRole}
                          onValueChange={(value) => handleRoleChange(user, value)}
                          disabled={isCurrentUser || updateRole.isPending}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue>
                              <Badge variant={roleBadgeVariant[currentRole as keyof typeof roleBadgeVariant]}>
                                {currentRole === 'student' ? 'Aluno' : roleLabels[currentRole as AppRole]}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student"><Badge variant="outline">Aluno</Badge></SelectItem>
                            <SelectItem value="viewer"><Badge variant="secondary">Visualizador</Badge></SelectItem>
                            <SelectItem value="editor"><Badge variant="default">Editor</Badge></SelectItem>
                            <SelectItem value="super_admin"><Badge variant="destructive">Super Admin</Badge></SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-2" onClick={() => openAccessDialog(user)}>
                          <Badge variant="secondary">{user.packages_count}</Badge>
                          {lifetimeSet.has(user.user_id) && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditUser(user);
                              setEditName(user.full_name || '');
                              setEditEmail(user.email);
                              setEditPhone(user.phone || '');
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar dados
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResendEmail(user)} disabled={resendEmail.isPending}>
                              <Send className="h-4 w-4 mr-2" />
                              Reenviar email de boas-vindas
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setResetPasswordUser(user); setNewPassword(''); }}>
                              <Key className="h-4 w-4 mr-2" />
                              Redefinir senha
                            </DropdownMenuItem>
                            {!isCurrentUser && (
                              <DropdownMenuItem
                                onClick={() => setDeleteUser(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Deletar usuário
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Mostrando {rangeStart}–{rangeEnd} de {totalCount} usuários
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && closeAccessDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Acessos</DialogTitle>
            <DialogDescription>
              Selecione os cursos, e-books, conteúdo exclusivo e pacotes que {selectedUser?.full_name || selectedUser?.email} terá acesso.
            </DialogDescription>
          </DialogHeader>
          {/* Lifetime access toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-card border-border">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Acesso Vitalício</p>
                <p className="text-xs text-muted-foreground">Remove expiração de todos os acessos</p>
              </div>
            </div>
            <Checkbox
              checked={selectedUser ? lifetimeSet.has(selectedUser.user_id) : false}
              onCheckedChange={(checked) => {
                if (selectedUser) {
                  toggleLifetime.mutate({ userId: selectedUser.user_id, grant: !!checked });
                }
              }}
            />
          </div>
          <AccessItemList
            items={accessItems}
            selectedIds={selectedAccess}
            onToggle={(id, type) => toggleAccess(selectedAccess, setSelectedAccess, id, type)}
            searchFilter={accessSearch}
            typeFilter={accessType}
            onSearchChange={setAccessSearch}
            onTypeChange={setAccessType}
            maxHeight="35vh"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeAccessDialog}>Cancelar</Button>
            <Button onClick={saveAccess} disabled={updateAccess.isPending || toggleExclusive.isPending}>
              {(updateAccess.isPending || toggleExclusive.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Adicionar Novo Usuário
            </DialogTitle>
            <DialogDescription>
              O usuário receberá um email de boas-vindas com a senha temporária de acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newUserEmail">Email *</Label>
              <Input id="newUserEmail" type="email" placeholder="email@exemplo.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newUserName">Nome completo</Label>
              <Input id="newUserName" placeholder="Nome do usuário" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Acessos (opcional)</Label>
              <AccessItemList
                items={accessItems}
                selectedIds={newUserAccess}
                onToggle={(id, type) => toggleAccess(newUserAccess, setNewUserAccess, id, type)}
                searchFilter={newAccessSearch}
                typeFilter={newAccessType}
                onSearchChange={setNewAccessSearch}
                onTypeChange={setNewAccessType}
                maxHeight="25vh"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={!newUserEmail || createUser.isPending}>
              {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) setResetPasswordUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Redefinir Senha
            </DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {resetPasswordUser?.full_name || resetPasswordUser?.email}. A senha não será enviada por email — comunique diretamente ao aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha *</Label>
              <Input
                id="newPassword"
                type="text"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordUser(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!resetPasswordUser) return;
                resetPassword.mutate(
                  { userId: resetPasswordUser.user_id, newPassword },
                  { onSuccess: () => setResetPasswordUser(null) }
                );
              }}
              disabled={newPassword.length < 6 || resetPassword.isPending}
            >
              {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Profile Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Dados do Usuário
            </DialogTitle>
            <DialogDescription>
              Altere os dados de {editUser?.full_name || editUser?.email}. Se o email for alterado, será atualizado também nas credenciais de login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Nome completo</Label>
              <Input
                id="editName"
                placeholder="Nome do usuário"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                placeholder="email@exemplo.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Telefone</Label>
              <Input
                id="editPhone"
                placeholder="+5511999999999"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editUser || !editEmail) return;
                updateProfile.mutate(
                  {
                    userId: editUser.user_id,
                    fullName: editName,
                    phone: editPhone,
                    email: editEmail,
                    originalEmail: editUser.email,
                  },
                  { onSuccess: () => setEditUser(null) }
                );
              }}
              disabled={!editEmail || updateProfile.isPending}
            >
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
