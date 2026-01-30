import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  School,
  Calendar,
  FileText,
  LogOut,
  User,
  ClipboardList,
  CheckSquare,
  X,
  Menu,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const secretaryMenu: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/secretary' },
  { icon: Users, label: 'Alunos', path: '/secretary/students' },
  { icon: GraduationCap, label: 'Professores', path: '/secretary/teachers' },
  { icon: BookOpen, label: 'Disciplinas', path: '/secretary/subjects' },
  { icon: School, label: 'Turmas', path: '/secretary/classes' },
  { icon: Calendar, label: 'Bimestres', path: '/secretary/bimesters' },
  { icon: FileText, label: 'Relatórios', path: '/secretary/reports' },
];

const teacherMenu: MenuItem[] = [
  { icon: User, label: 'Meu Perfil', path: '/teacher' },
  { icon: BookOpen, label: 'Minhas Disciplinas', path: '/teacher/subjects' },
  { icon: Calendar, label: 'Bimestres', path: '/teacher/bimesters' },
  { icon: ClipboardList, label: 'Lançar Notas', path: '/teacher/grades' },
  { icon: CheckSquare, label: 'Lançar Presença', path: '/teacher/attendance' },
];

const studentMenu: MenuItem[] = [
  { icon: User, label: 'Meu Perfil', path: '/student' },
  { icon: BookOpen, label: 'Minhas Disciplinas', path: '/student/subjects' },
  { icon: ClipboardList, label: 'Notas por Bimestre', path: '/student/grades' },
  { icon: CheckSquare, label: 'Faltas', path: '/student/absences' },
  { icon: FileText, label: 'Situação Final', path: '/student/status' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getMenu = (): MenuItem[] => {
    switch (user?.role) {
      case 'secretary':
        return secretaryMenu;
      case 'teacher':
        return teacherMenu;
      case 'student':
        return studentMenu;
      default:
        return [];
    }
  };

  const getRoleLabel = (): string => {
    switch (user?.role) {
      case 'secretary':
        return 'Secretaria';
      case 'teacher':
        return 'Professor';
      case 'student':
        return 'Aluno';
      default:
        return '';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menu = getMenu();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 
          bg-sidebar transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'linear-gradient(180deg, hsl(217, 91%, 28%) 0%, hsl(217, 91%, 18%) 100%)',
        }}
      >
        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-sidebar-foreground/80 hover:text-sidebar-foreground lg:hidden"
        >
          <X size={24} />
        </button>

        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <img
            src="/logo.png"
            alt="ETDA - Escola Teológica Deus é Amor"
            className="w-full max-w-[180px] mx-auto"
          />
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
              <User size={20} className="text-sidebar-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[140px]">
                {user?.name}
              </p>
              <p className="text-xs text-sidebar-foreground/60">{getRoleLabel()}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {menu.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`
                  }
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-sidebar-foreground/80 hover:text-destructive"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
};
