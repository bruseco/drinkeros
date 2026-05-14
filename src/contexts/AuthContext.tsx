import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { trackFbEvent } from '@/lib/metaPixel';

type AppRole = 'super_admin' | 'editor' | 'viewer';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string, userObj?: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116' && userObj) {
        // Profile not found — auto-create for OAuth/Magic Link users
        const meta = userObj.user_metadata || {};
        const email = userObj.email || meta.email || '';
        const fullName = meta.full_name || meta.name || null;
        const avatarUrl = meta.avatar_url || meta.picture || null;

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            email,
            full_name: fullName,
            avatar_url: avatarUrl,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          setProfile(null);
        } else {
          setProfile(newProfile as UserProfile);
          // Novo cadastro via OAuth/Magic Link → CompleteRegistration
          const provider = (userObj.app_metadata as any)?.provider || 'oauth';
          trackFbEvent(
            'CompleteRegistration',
            { method: provider },
            { dedupeKey: `user:${userId}` }
          );
        }
        return;
      }

      if (error) throw error;
      setProfile(data as UserProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  const fetchRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;
      setRoles((data || []).map((r) => r.role as AppRole));
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([]);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Save last used auth method for "Último acesso" badge
          if (event === 'SIGNED_IN') {
            const provider = (session.user.app_metadata as any)?.provider || 'email';
            try {
              localStorage.setItem('drinkeros:last_auth_method', provider);
            } catch { /* ignore */ }
            // Inicia (idempotente) a janela de 7 dias do desconto VIP
            setTimeout(() => {
              (supabase.rpc('start_vip_discount_window' as any) as unknown as Promise<unknown>).catch(() => { /* ignore */ });
            }, 0);
          }

          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => {
            fetchProfile(session.user.id, session.user);
            fetchRoles(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setIsLoading(false);
      }
    );

    // THEN check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id, session.user);
        fetchRoles(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message === 'Failed to fetch'
          ? 'Não foi possível conectar. Verifique sua conexão com a internet e tente novamente.'
          : error.message;
        return { error: new Error(msg) };
      }
      return { error: null };
    } catch (err: any) {
      const raw = err?.message || '';
      const msg = raw === 'Failed to fetch' || raw.toLowerCase().includes('network')
        ? 'Não foi possível conectar. Verifique sua conexão com a internet e tente novamente.'
        : (raw || 'Erro inesperado ao entrar. Tente novamente.');
      return { error: new Error(msg) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const isAdmin = roles.some((r) => ['super_admin', 'editor', 'viewer'].includes(r));
  const canEdit = roles.some((r) => ['super_admin', 'editor'].includes(r));
  const isSuperAdmin = roles.includes('super_admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isLoading,
        isAdmin,
        canEdit,
        isSuperAdmin,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
