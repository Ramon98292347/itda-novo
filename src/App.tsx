import React from "react";
import { Toaster } from "@/components/ui/toaster"; // Toasts (shadcn/ui)
import { Toaster as Sonner } from "@/components/ui/sonner"; // Toasts (sonner) renomeado para evitar conflito
import { TooltipProvider } from "@/components/ui/tooltip"; // Provider global de tooltips
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Cache/fetch de dados (React Query)
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Roteamento SPA
import { AuthProvider } from "@/contexts/AuthContext"; // Contexto de autenticação (usuário logado)

// Pages
import LoginPage from "./pages/LoginPage"; // Tela de login (rota pública)

// Secretary Pages
import SecretaryDashboard from "./pages/secretary/SecretaryDashboard"; // Dashboard da secretaria
import StudentsPage from "./pages/secretary/StudentsPage"; // Gestão de alunos
import TeachersPage from "./pages/secretary/TeachersPage"; // Gestão de professores
import SubjectsPage from "./pages/secretary/SubjectsPage"; // Gestão de disciplinas
import ClassesPage from "./pages/secretary/ClassesPage"; // Gestão de turmas
import BimestersPage from "./pages/secretary/BimestersPage"; // Gestão de bimestres
import ReportsPage from "./pages/secretary/ReportsPage"; // Relatórios

// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard"; // Dashboard do professor
import TeacherSubjectsPage from "./pages/teacher/TeacherSubjectsPage"; // Disciplinas do professor
import TeacherBimestersPage from "./pages/teacher/TeacherBimestersPage"; // Bimestres do professor
import TeacherGradesPage from "./pages/teacher/TeacherGradesPage"; // Lançamento de notas
import TeacherAttendancePage from "./pages/teacher/TeacherAttendancePage"; // Lançamento de presença

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard"; // Dashboard do aluno
import StudentSubjectsPage from "./pages/student/StudentSubjectsPage"; // Disciplinas do aluno
import StudentGradesPage from "./pages/student/StudentGradesPage"; // Notas por bimestre
import StudentAbsencesPage from "./pages/student/StudentAbsencesPage"; // Faltas
import StudentStatusPage from "./pages/student/StudentStatusPage"; // Situação final

import NotFound from "./pages/NotFound"; // Página 404 (rota não encontrada)

const queryClient = new QueryClient(); // Cliente global do React Query (cache)

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage?: string }
> {
  state = { hasError: false as boolean, errorMessage: undefined as string | undefined };

  static getDerivedStateFromError(error: unknown) {
    if (error instanceof Error) return { hasError: true, errorMessage: error.message };
    return { hasError: true, errorMessage: "Erro inesperado." };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 720, width: "100%" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Ocorreu um erro na tela</h1>
          <p style={{ opacity: 0.8, marginBottom: 16 }}>
            Tente recarregar a página. Se continuar acontecendo, revise o console do navegador e as permissões no Supabase.
          </p>
          {this.state.errorMessage ? (
            <pre
              style={{
                background: "rgba(0,0,0,0.05)",
                padding: 12,
                borderRadius: 8,
                overflow: "auto",
                marginBottom: 16,
              }}
            >
              {this.state.errorMessage}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 600,
            }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

const App = () => ( // Componente raiz da aplicação
  <QueryClientProvider client={queryClient}> {/* Provider do React Query */}
    <TooltipProvider> {/* Provider global de tooltips */}
      <AuthProvider> {/* Provider de autenticação */}
        <Toaster /> {/* Toasts padrão */}
        <Sonner /> {/* Toasts via Sonner */}
        <AppErrorBoundary>
          <BrowserRouter> {/* Habilita rotas no navegador */}
            <Routes> {/* Declaração das rotas */}
              {/* Public Routes */}
              <Route path="/" element={<Navigate to="/login" replace />} /> {/* Redireciona raiz para login */}
              <Route path="/login" element={<LoginPage />} /> {/* Tela de login */}

              {/* Secretary Routes */}
              <Route path="/secretary" element={<SecretaryDashboard />} /> {/* Dashboard da secretaria */}
              <Route path="/secretary/students" element={<StudentsPage />} /> {/* Gestão de alunos */}
              <Route path="/secretary/teachers" element={<TeachersPage />} /> {/* Gestão de professores */}
              <Route path="/secretary/subjects" element={<SubjectsPage />} /> {/* Gestão de disciplinas */}
              <Route path="/secretary/classes" element={<ClassesPage />} /> {/* Gestão de turmas */}
              <Route path="/secretary/bimesters" element={<BimestersPage />} /> {/* Gestão de bimestres */}
              <Route path="/secretary/reports" element={<ReportsPage />} /> {/* Relatórios */}

              {/* Teacher Routes */}
              <Route path="/teacher" element={<TeacherDashboard />} /> {/* Dashboard do professor */}
              <Route path="/teacher/subjects" element={<TeacherSubjectsPage />} /> {/* Disciplinas do professor */}
              <Route path="/teacher/bimesters" element={<TeacherBimestersPage />} /> {/* Bimestres do professor */}
              <Route path="/teacher/grades" element={<TeacherGradesPage />} /> {/* Lançamento de notas */}
              <Route path="/teacher/attendance" element={<TeacherAttendancePage />} /> {/* Lançamento de presença */}

              {/* Student Routes */}
              <Route path="/student" element={<StudentDashboard />} /> {/* Dashboard do aluno */}
              <Route path="/student/subjects" element={<StudentSubjectsPage />} /> {/* Disciplinas do aluno */}
              <Route path="/student/grades" element={<StudentGradesPage />} /> {/* Notas do aluno */}
              <Route path="/student/absences" element={<StudentAbsencesPage />} /> {/* Faltas do aluno */}
              <Route path="/student/status" element={<StudentStatusPage />} /> {/* Situação final */}

              {/* 404 */}
              <Route path="*" element={<NotFound />} /> {/* Qualquer rota não mapeada */}
            </Routes>
          </BrowserRouter>
        </AppErrorBoundary>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
