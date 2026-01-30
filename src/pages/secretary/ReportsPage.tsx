import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { FileText, Download, TrendingUp, Users, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const ReportsPage: React.FC = () => {
  const [students, setStudents] = useState<Array<{ id: string; name: string; email: string; className?: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentGrades, setStudentGrades] = useState<
    Array<{
      id: string;
      subjectName: string;
      bimesterName: string;
      grade1: number;
      grade2: number;
      absences: number;
      average: number;
      status: 'approved' | 'recovery' | 'failed';
    }>
  >([]);
  const [attendanceAbsences, setAttendanceAbsences] = useState<
    Array<{ id: string; subjectName: string; bimesterName: string; absences: number }>
  >([]);
  const [isConsultLoading, setIsConsultLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    subjectsCount: 0,
    approvalRate: '-',
    averageGrade: '-',
  });

  const formatSupabaseError = (err: unknown, fallback: string) => {
    if (err instanceof Error) {
      const isAuth =
        /unauthorized|jwt|invalid api key|apikey/i.test(err.message) ||
        (err as unknown as { status?: number }).status === 401;
      return isAuth
        ? `${err.message} (verifique VITE_SUPABASE_ANON_KEY e/ou policies RLS no Supabase)`
        : err.message;
    }

    const msg = (err as { message?: unknown } | null)?.message;
    return typeof msg === 'string' && msg.trim() ? msg : fallback;
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [studentsRes, subjectsRes, gradesRes, studentsListRes] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase.from('grades').select('average,status'),
          supabase
            .from('students')
            .select('id,users(name,email),classes(name)')
            .order('created_at', { ascending: false }),
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (subjectsRes.error) throw subjectsRes.error;
        if (studentsListRes.error) throw studentsListRes.error;

        let approvalRate = '-';
        let averageGrade = '-';

        if (!gradesRes.error) {
          const grades = (gradesRes.data ?? []) as Array<{ average: number; status: 'approved' | 'recovery' | 'failed' }>;
          const totalGrades = grades.length;
          if (totalGrades > 0) {
            const approved = grades.reduce((acc, g) => acc + (g.status === 'approved' ? 1 : 0), 0);
            const avg = grades.reduce((acc, g) => acc + (g.average ?? 0), 0) / totalGrades;
            approvalRate = ((approved / totalGrades) * 100).toFixed(1);
            averageGrade = avg.toFixed(1);
          }
        }

        if (!cancelled) {
          setStats({
            totalStudents: studentsRes.count ?? 0,
            subjectsCount: subjectsRes.count ?? 0,
            approvalRate,
            averageGrade,
          });

          setStudents(
            (studentsListRes.data ?? []).map((row: unknown) => {
              const item = row as {
                id: string;
                users: { name: string; email: string } | null;
                classes: { name: string } | null;
              };
              return {
                id: item.id,
                name: item.users?.name ?? '',
                email: item.users?.email ?? '',
                className: item.classes?.name ?? undefined,
              };
            }),
          );
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: formatSupabaseError(err, 'Falha ao carregar dados de relatórios.'),
            variant: 'destructive',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStudentGrades([]);
      setAttendanceAbsences([]);
      if (!selectedStudentId) return;

      setIsConsultLoading(true);
      try {
        const [gradesRes, attendanceRes] = await Promise.all([
          supabase
            .from('grades')
            .select('id,grade1,grade2,absences,average,status,subjects(name),bimesters(name)')
            .eq('student_id', selectedStudentId)
            .order('created_at', { ascending: false }),
          supabase
            .from('attendance')
            .select('subject_id,bimester_id,subjects(name),bimesters(name),present')
            .eq('student_id', selectedStudentId)
            .eq('present', false)
            .order('date', { ascending: false }),
        ]);

        if (gradesRes.error) throw gradesRes.error;
        if (attendanceRes.error) throw attendanceRes.error;

        const mappedGrades = (gradesRes.data ?? []).map((row: unknown) => {
          const g = row as {
            id: string;
            grade1: number;
            grade2: number;
            absences: number;
            average: number;
            status: 'approved' | 'recovery' | 'failed';
            subjects: { name: string } | null;
            bimesters: { name: string } | null;
          };

          return {
            id: g.id,
            subjectName: g.subjects?.name ?? '-',
            bimesterName: g.bimesters?.name ?? '-',
            grade1: g.grade1 ?? 0,
            grade2: g.grade2 ?? 0,
            absences: g.absences ?? 0,
            average: g.average ?? 0,
            status: g.status,
          };
        });

        const byKey = new Map<string, { subjectName: string; bimesterName: string; absences: number }>();
        for (const row of (attendanceRes.data ?? []) as Array<{
          subject_id: string;
          bimester_id: string;
          subjects: { name: string } | null;
          bimesters: { name: string } | null;
          present: boolean;
        }>) {
          const key = `${row.subject_id}:${row.bimester_id}`;
          const prev = byKey.get(key);
          if (prev) {
            prev.absences += 1;
          } else {
            byKey.set(key, {
              subjectName: row.subjects?.name ?? '-',
              bimesterName: row.bimesters?.name ?? '-',
              absences: 1,
            });
          }
        }

        const mappedAttendance = Array.from(byKey.entries()).map(([key, value]) => ({
          id: key,
          subjectName: value.subjectName,
          bimesterName: value.bimesterName,
          absences: value.absences,
        }));

        if (!cancelled) {
          setStudentGrades(mappedGrades);
          setAttendanceAbsences(mappedAttendance);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: formatSupabaseError(err, 'Falha ao consultar notas/presenças.'),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsConsultLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId]);

  const reports = [
    {
      id: 1,
      title: 'Relatório de Alunos Matriculados',
      description: 'Lista completa de todos os alunos com suas informações',
      icon: Users,
    },
    {
      id: 2,
      title: 'Relatório de Notas por Bimestre',
      description: 'Notas de todos os alunos separadas por bimestre',
      icon: FileText,
    },
    {
      id: 3,
      title: 'Relatório de Aprovação',
      description: 'Taxa de aprovação e reprovação por disciplina',
      icon: TrendingUp,
    },
    {
      id: 4,
      title: 'Relatório de Disciplinas',
      description: 'Lista de disciplinas com carga horária',
      icon: BookOpen,
    },
  ];

  const handleDownload = (reportId: number) => {
    // Simulate download
    const report = reports.find(r => r.id === reportId);
    alert(`Download do relatório "${report?.title}" iniciado!`);
  };

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <PageHeader
        title="Relatórios"
        subtitle="Gere e baixe relatórios do sistema"
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-primary">{stats.totalStudents}</p>
          <p className="text-sm text-muted-foreground">Alunos</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-success">{stats.approvalRate}%</p>
          <p className="text-sm text-muted-foreground">Aprovação</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-accent">{stats.averageGrade}</p>
          <p className="text-sm text-muted-foreground">Média Geral</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{stats.subjectsCount}</p>
          <p className="text-sm text-muted-foreground">Disciplinas</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Consultar Notas e Presenças</h2>
            <p className="text-sm text-muted-foreground">Selecione um aluno para visualizar o histórico.</p>
          </div>
          <div className="w-full md:max-w-[420px]">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="form-input"
            >
              <option value="">Selecione um aluno</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.className ? ` - ${s.className}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!selectedStudentId ? (
          <div className="p-8 text-center text-muted-foreground">Selecione um aluno para iniciar a consulta.</div>
        ) : isConsultLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-semibold text-foreground">Notas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="text-left p-4 font-semibold">Disciplina</th>
                      <th className="text-left p-4 font-semibold">Bimestre</th>
                      <th className="text-center p-4 font-semibold">Média</th>
                      <th className="text-center p-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentGrades.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          Nenhuma nota registrada.
                        </td>
                      </tr>
                    ) : (
                      studentGrades.map((g) => (
                        <tr key={g.id} className="table-row">
                          <td className="p-4 font-medium text-foreground">{g.subjectName}</td>
                          <td className="p-4 text-muted-foreground">{g.bimesterName}</td>
                          <td className="p-4 text-center">{Number(g.average ?? 0).toFixed(1)}</td>
                          <td className="p-4 text-center">
                            <StatusBadge status={g.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-semibold text-foreground">Faltas (por Presença)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="text-left p-4 font-semibold">Disciplina</th>
                      <th className="text-left p-4 font-semibold">Bimestre</th>
                      <th className="text-center p-4 font-semibold">Faltas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceAbsences.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-muted-foreground">
                          Nenhuma falta registrada.
                        </td>
                      </tr>
                    ) : (
                      attendanceAbsences.map((r) => (
                        <tr key={r.id} className="table-row">
                          <td className="p-4 font-medium text-foreground">{r.subjectName}</td>
                          <td className="p-4 text-muted-foreground">{r.bimesterName}</td>
                          <td className="p-4 text-center">{r.absences}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <report.icon size={24} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">{report.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {report.description}
                </p>
                <Button
                  onClick={() => handleDownload(report.id)}
                  variant="outline"
                  className="gap-2"
                >
                  <Download size={16} />
                  Baixar PDF
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
