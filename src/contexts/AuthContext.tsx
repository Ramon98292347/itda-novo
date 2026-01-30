import React, { createContext, useContext, useState, ReactNode } from 'react'; // React + Context API
import { User } from '@/data/mockData'; // Tipos
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  user: User | null; // Usuário logado (ou null)
  login: (email: string, password: string) => Promise<User | null>; // Faz login e retorna usuário (ou null)
  register: (payload: { name: string; email: string; role: User['role']; password: string }) => Promise<User>;
  logout: () => void; // Faz logout (limpa sessão)
  isAuthenticated: boolean; // Flag derivada (true se existir user)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null); // Estado do usuário em memória
  type UserRow = { id: string; name: string; email: string; role: User['role']; avatar_url: string | null };

  const loadProfile = async (userId: string): Promise<UserRow | null> => {
    const { data: profileRow, error: profileErr } = await supabase
      .from('users')
      .select('id,name,email,role,avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      throw new Error(profileErr.message);
    }

    return (profileRow as unknown as UserRow | null) ?? null;
  };

  const login = async (email: string, password: string): Promise<User | null> => {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authErr) {
      if (/email logins are disabled/i.test(authErr.message)) {
        throw new Error('O login por e-mail está desativado no Supabase. Ative em Authentication > Providers > Email.');
      }
      throw new Error(authErr.message);
    }

    const authUserId = authData.user?.id;
    if (!authUserId) return null;

    let row: UserRow | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      row = await loadProfile(authUserId);
      if (row) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!row) {
      throw new Error('Login realizado, mas o perfil ainda não sincronizou. Se você acabou de confirmar o email, aguarde alguns segundos e tente novamente.');
    }

    const foundUser: User = { id: row.id, name: row.name, email: row.email, role: row.role, avatar: row.avatar_url ?? undefined };
    setUser(foundUser); // Atualiza usuário no contexto
    localStorage.setItem('auth:user', JSON.stringify(foundUser)); // Persiste sessão no navegador (sem senha)
    return foundUser; // Retorna usuário para o chamador decidir a navegação
  };

  const register = async (payload: { name: string; email: string; role: User['role']; password: string }): Promise<User> => {
    const normalizedEmail = payload.email.trim().toLowerCase();

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: payload.password,
      options: {
        data: {
          name: payload.name.trim(),
          role: payload.role,
        },
      },
    });

    if (signUpErr) {
      throw new Error(signUpErr.message);
    }

    const authUserId = signUpData.user?.id;
    if (!authUserId) {
      throw new Error('Falha ao cadastrar: resposta vazia do Supabase.');
    }

    if (!signUpData.session) {
      throw new Error('Cadastro realizado. Confirme o email para fazer login.');
    }

    let profile: UserRow | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      profile = await loadProfile(authUserId);
      if (profile) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!profile) {
      throw new Error('Cadastro realizado, mas o perfil ainda não sincronizou. Se você acabou de confirmar o email, aguarde alguns segundos e tente novamente.');
    }

    const createdUser: User = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      avatar: profile.avatar_url ?? undefined,
    };

    setUser(createdUser);
    localStorage.setItem('auth:user', JSON.stringify(createdUser));
    return createdUser;
  };

  const logout = () => {
    setUser(null); // Limpa usuário em memória
    localStorage.removeItem('auth:user'); // Remove persistência
    void supabase.auth.signOut();
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('auth:user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User;
        if (parsed?.id && parsed?.email && parsed?.role) {
          setUser(parsed);
        }
      } catch {
        localStorage.removeItem('auth:user');
      }
    }

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setUser(null);
          localStorage.removeItem('auth:user');
          return;
        }

        if (!user) {
          const authUserId = data.session.user.id;
          let row: UserRow | null = null;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            row = await loadProfile(authUserId);
            if (row) break;
            await new Promise((r) => setTimeout(r, 200));
          }

          if (row) {
            const foundUser: User = {
              id: row.id,
              name: row.name,
              email: row.email,
              role: row.role,
              avatar: row.avatar_url ?? undefined,
            };
            setUser(foundUser);
            localStorage.setItem('auth:user', JSON.stringify(foundUser));
          }
        }
      } catch {
        setUser(null);
        localStorage.removeItem('auth:user');
        void supabase.auth.signOut();
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('auth:user');
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
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
