import React, { useEffect, useState } from 'react'; // React + estado local
import { useNavigate } from 'react-router-dom'; // Navegação programática após login
import { useAuth } from '@/contexts/AuthContext'; // Função de login do contexto
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff, UserPlus } from 'lucide-react'; // Ícones do formulário
import { Button } from '@/components/ui/button'; // Botão com estilos do design system
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register' | 'updatePassword'>('login');
  type RegisterRole = 'secretary' | 'teacher' | 'student';
  const [email, setEmail] = useState(''); // Valor do campo email
  const [password, setPassword] = useState(''); // Valor do campo senha
  const [showPassword, setShowPassword] = useState(false); // Toggle de visualização da senha
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerRole, setRegisterRole] = useState<RegisterRole>('secretary');
  const [error, setError] = useState(''); // Mensagem de erro exibida no topo
  const [isLoading, setIsLoading] = useState(false); // Controle de loading do botão
  const [touched, setTouched] = useState({ email: false, password: false }); // Controle de validação após interação
  const [registerTouched, setRegisterTouched] = useState({ name: false, email: false, password: false, adminPassword: false }); // Controle de validação após interação

  const { login, register } = useAuth(); // Função que autentica e retorna o usuário
  const navigate = useNavigate(); // Função que redireciona para o dashboard

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); // Validação simples de formato de email
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setMode('updatePassword');
      setError('');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita reload do browser
    setTouched({ email: true, password: true }); // Marca campos como "tocados" para exibir validações

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.'); // Erro de validação local
      return; // Interrompe o submit
    }

    if (!validateEmail(email)) {
      setError('Por favor, insira um email válido.'); // Erro de validação local
      return; // Interrompe o submit
    }

    setIsLoading(true); // Desabilita botão e mostra spinner
    setError(''); // Limpa erros anteriores

    try {
      const loggedUser = await login(email, password); // Autentica e recebe o usuário (ou null)
      
      if (loggedUser) {
        const dashboardPaths = {
          secretary: '/secretary',
          teacher: '/teacher',
          student: '/student',
        };

        navigate(dashboardPaths[loggedUser.role]); // Redireciona para a área correta pelo role
      } else {
        setError('Email ou senha inválidos. Verifique suas credenciais.'); // Erro de autenticação
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      setError('Ocorreu um erro. Tente novamente.'); // Erro inesperado
    } finally {
      setIsLoading(false); // Reabilita botão
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterTouched({ name: true, email: true, password: true, adminPassword: true });

    if (!registerName || !registerEmail || !registerPassword || !adminPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (!validateEmail(registerEmail)) {
      setError('Por favor, insira um email válido.');
      return;
    }

    if (registerPassword.trim().length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    const expected = import.meta.env.VITE_ADMIN_PASSWORD;
    if (!expected) {
      setError('Senha admin não configurada. Verifique o arquivo .env.');
      return;
    }

    if (adminPassword !== expected) {
      setError('Senha do admin inválida.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const created = await register({ name: registerName, email: registerEmail, role: registerRole, password: registerPassword });

      if (created) {
        const dashboardPaths = {
          secretary: '/secretary',
          teacher: '/teacher',
          student: '/student',
        };

        navigate(dashboardPaths[created.role]);
      }
    } catch (err) {
      if (err instanceof Error) {
        const rls = /row-level security|rls|permission denied/i.test(err.message);
        setError(
          rls
            ? 'O Supabase bloqueou o cadastro por permissão (RLS). Ajuste as policies e tente novamente.'
            : err.message,
        );
        return;
      }
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReset = async () => {
    const normalized = resetEmail.trim().toLowerCase();
    if (!normalized || !validateEmail(normalized)) {
      setResetResult('Informe um email válido.');
      return;
    }

    setResetLoading(true);
    setResetResult('');

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetErr) throw new Error(resetErr.message);
      setResetResult('Enviamos um link de recuperação para o seu email.');
    } catch (err) {
      setResetResult(err instanceof Error ? err.message : 'Falha ao enviar email de recuperação.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.trim().length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw new Error(updateErr.message);
      await supabase.auth.signOut();
      window.location.hash = '';
      setMode('login');
      setEmail('');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setError('Senha atualizada com sucesso. Faça login novamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar senha.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginHints = [
    //{ role: 'Secretaria', email: 'secretaria@etda.edu.br' },
   // { role: 'Professor', email: 'joao.santos@etda.edu.br' },
    //{ role: 'Aluno', email: 'pedro.almeida@etda.edu.br' },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(217, 91%, 60%) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(160, 84%, 39%) 0%, transparent 70%)' }}
        />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Login Card */}
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              <img
                src="/logo.png"
                alt="ETDA - Escola Teológica Deus é Amor"
                className="w-64 max-w-full"
              />
            </button>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Sistema Escolar ETDA
            </h1>
            <p className="text-muted-foreground">
              {mode === 'login' ? 'Acesse sua conta para continuar' : mode === 'register' ? 'Cadastro de acesso (admin)' : 'Defina uma nova senha'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3 animate-slide-in-up">
              <AlertCircle className="text-destructive shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched({ ...touched, email: true })}
                    placeholder="seu.email@etda.edu.br"
                    className={`form-input pl-12 ${touched.email && !email ? 'border-destructive focus:ring-destructive/50' : ''}`}
                  />
                </div>
                {touched.email && !email && <p className="text-sm text-destructive mt-1">Email é obrigatório</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched({ ...touched, password: true })}
                    placeholder="••••••••"
                    className={`form-input pl-12 pr-12 ${touched.password && !password ? 'border-destructive focus:ring-destructive/50' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {touched.password && !password && <p className="text-sm text-destructive mt-1">Senha é obrigatória</p>}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setResetEmail((email || '').trim());
                    setResetResult('');
                    setResetOpen(true);
                  }}
                >
                  Esqueci minha senha
                </Button>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full btn-primary h-12 text-base">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Entrando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn size={20} />
                    <span>Entrar</span>
                  </div>
                )}
              </Button>
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Senha do admin</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onBlur={() => setRegisterTouched({ ...registerTouched, adminPassword: true })}
                    placeholder="••••••••"
                    className={`form-input pl-12 ${
                      registerTouched.adminPassword && !adminPassword ? 'border-destructive focus:ring-destructive/50' : ''
                    }`}
                  />
                </div>
                {registerTouched.adminPassword && !adminPassword && (
                  <p className="text-sm text-destructive mt-1">Senha do admin é obrigatória</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nome</label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  onBlur={() => setRegisterTouched({ ...registerTouched, name: true })}
                  placeholder="Seu nome"
                  className={`form-input ${registerTouched.name && !registerName ? 'border-destructive focus:ring-destructive/50' : ''}`}
                />
                {registerTouched.name && !registerName && <p className="text-sm text-destructive mt-1">Nome é obrigatório</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    onBlur={() => setRegisterTouched({ ...registerTouched, email: true })}
                    placeholder="seu.email@etda.edu.br"
                    className={`form-input pl-12 ${
                      registerTouched.email && !registerEmail ? 'border-destructive focus:ring-destructive/50' : ''
                    }`}
                  />
                </div>
                {registerTouched.email && !registerEmail && <p className="text-sm text-destructive mt-1">Email é obrigatório</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    onBlur={() => setRegisterTouched({ ...registerTouched, password: true })}
                    placeholder="••••••••"
                    className={`form-input pl-12 pr-12 ${
                      registerTouched.password && !registerPassword ? 'border-destructive focus:ring-destructive/50' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showRegisterPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {registerTouched.password && !registerPassword && <p className="text-sm text-destructive mt-1">Senha é obrigatória</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Perfil</label>
                <select
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value as RegisterRole)}
                  className="form-input"
                >
                  <option value="secretary">Secretaria</option>
                  <option value="teacher">Professor</option>
                  <option value="student">Aluno</option>
                </select>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full btn-primary h-12 text-base">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Cadastrando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus size={20} />
                    <span>Cadastrar</span>
                  </div>
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Voltar para o login
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="form-input pl-12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Confirmar nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="form-input pl-12"
                  />
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full btn-primary h-12 text-base">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus size={20} />
                    <span>Atualizar senha</span>
                  </div>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Voltar para o login
              </Button>
            </form>
          )}

          {/* Login Hints */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-4">
              
            </p>
            <div className="space-y-2">
              {loginHints.map((hint) => (
                <button
                  key={hint.role}
                  type="button"
                  onClick={() => {
                    setEmail(hint.email);
                    setPassword('123456');
                    setError('');
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                >
                  <span className="font-medium text-foreground">{hint.role}:</span>{' '}
                  <span className="text-muted-foreground">{hint.email}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2024 ETDA - Escola Teológica Deus é Amor
        </p>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="form-input"
                placeholder="seu.email@etda.edu.br"
              />
            </div>

            {resetResult && <p className="text-sm text-muted-foreground">{resetResult}</p>}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Fechar
            </Button>
            <Button type="button" className="btn-primary" disabled={resetLoading} onClick={handleSendReset}>
              {resetLoading ? 'Enviando...' : 'Enviar link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
