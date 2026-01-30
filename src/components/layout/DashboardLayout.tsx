import React, { useState } from 'react'; // React + state local
import { Navigate } from 'react-router-dom'; // Redirecionamento por rota
import { useAuth } from '@/contexts/AuthContext'; // Estado de autenticação
import { Sidebar } from './Sidebar'; // Menu lateral do dashboard
import { Menu } from 'lucide-react'; // Ícone do botão mobile

interface DashboardLayoutProps {
  children: React.ReactNode; // Conteúdo da página
  allowedRoles?: Array<'secretary' | 'teacher' | 'student'>; // Roles permitidos para a página
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children, // Conteúdo a renderizar no layout
  allowedRoles, // Lista de roles aceitos
}) => {
  const { user, isAuthenticated } = useAuth(); // Usuário logado e flag de autenticação
  const [sidebarOpen, setSidebarOpen] = useState(false); // Controle do sidebar no mobile

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />; // Se não logado, volta para login
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Se logado, mas sem permissão, redireciona para o dashboard do role atual
    const dashboardPaths = {
      secretary: '/secretary',
      teacher: '/teacher',
      student: '/student',
    };
    return <Navigate to={dashboardPaths[user.role]} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
