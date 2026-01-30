import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const StudentStatusPage: React.FC = () => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [grades, setGrades] = useState<Array<{ id: string; average: number; absences: number; subjectId: string; subjectName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;
      setIsLoading(true);

      try {
        const { data: studentRow, error: studentErr } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (studentErr) throw studentErr;

        const sid = (studentRow as { id: string } | null)?.id;
        if (!sid) {
          if (!cancelled) {
            setStudentId(null);
            setGrades([]);
          }
          return;
        }

        const { data: gradesData, error: gradesErr } = await supabase
          .from('grades')
          .select('id,average,absences,subject_id,subjects(id,name)')
          .eq('student_id', sid)
          .order('created_at', { ascending: false });

        if (gradesErr) throw gradesErr;

        const mapped = (gradesData ?? []).map((g: unknown) => {
          const row = g as {
            id: string;
            average: number | null;
            absences: number | null;
            subject_id: string;
            subjects: { id: string; name: string } | null;
          };

          return {
            id: row.id,
            average: row.average ?? 0,
            absences: row.absences ?? 0,
            subjectId: row.subject_id,
            subjectName: row.subjects?.name ?? '-',
          };
        });

        if (!cancelled) {
          setStudentId(sid);
          setGrades(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar situação final do banco. Verifique as permissões (RLS).',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const finalAverageNumber = useMemo(() => {
    if (grades.length === 0) return null;
    return grades.reduce((sum, g) => sum + (g.average ?? 0), 0) / grades.length;
  }, [grades]);

  const finalStatus = useMemo(() => {
    if (finalAverageNumber == null) return null;
    if (finalAverageNumber >= 7) return 'approved';
    if (finalAverageNumber >= 5) return 'recovery';
    return 'failed';
  }, [finalAverageNumber]);

  const finalAverage = finalAverageNumber != null ? finalAverageNumber.toFixed(1) : '-';

  const summaryBySubject = useMemo(() => {
    const bySubject = new Map<string, { subjectId: string; subjectName: string; averageSum: number; count: number; absences: number }>();
    for (const g of grades) {
      const key = g.subjectId;
      if (!bySubject.has(key)) {
        bySubject.set(key, { subjectId: g.subjectId, subjectName: g.subjectName, averageSum: 0, count: 0, absences: 0 });
      }
      const item = bySubject.get(key)!;
      item.averageSum += g.average ?? 0;
      item.count += 1;
      item.absences += g.absences ?? 0;
    }

    return Array.from(bySubject.values())
      .map((s) => {
        const avg = s.count > 0 ? s.averageSum / s.count : 0;
        const status = avg >= 7 ? 'approved' : avg >= 5 ? 'recovery' : 'failed';
        return { subjectId: s.subjectId, subjectName: s.subjectName, average: avg, absences: s.absences, status };
      })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [grades]);

  const statusConfig = {
    approved: {
      title: 'Aprovado',
      description: 'Parabéns! Você foi aprovado com sucesso.',
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    recovery: {
      title: 'Em Recuperação',
      description: 'Você precisa fazer a recuperação para ser aprovado.',
      icon: AlertTriangle,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    failed: {
      title: 'Reprovado',
      description: 'Infelizmente você não atingiu a média necessária.',
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
  };

  const currentStatus = finalStatus ? statusConfig[finalStatus] : null;

  return (
    <DashboardLayout allowedRoles={['student']}>
      <PageHeader
        title="Situação Final"
        subtitle="Visualize sua situação acadêmica geral"
      />

      {/* Final Status Card */}
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 mb-6 text-center">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : !studentId ? (
        <div className="bg-card rounded-xl border border-border p-12 mb-6 text-center">
          <p className="text-muted-foreground">Aluno não encontrado.</p>
        </div>
      ) : currentStatus ? (
        <div className={`${currentStatus.bg} rounded-xl border border-border p-8 mb-6`}>
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className={`p-4 rounded-full ${currentStatus.bg}`}>
              <currentStatus.icon size={48} className={currentStatus.color} />
            </div>
            <div>
              <h2 className={`text-3xl font-bold ${currentStatus.color}`}>
                {currentStatus.title}
              </h2>
              <p className="text-muted-foreground mt-1">{currentStatus.description}</p>
              <p className="text-lg mt-4">
                Média Final: <span className="font-bold text-foreground">{finalAverage}</span>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subjects Summary */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Resumo por Disciplina</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left p-4 font-semibold">Disciplina</th>
                <th className="text-center p-4 font-semibold">Média</th>
                <th className="text-center p-4 font-semibold">Faltas</th>
                <th className="text-center p-4 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : !studentId ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Aluno não encontrado.
                  </td>
                </tr>
              ) : summaryBySubject.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Nenhuma nota registrada ainda.
                  </td>
                </tr>
              ) : (
                summaryBySubject.map((subject) => (
                  <tr key={subject.subjectId} className="table-row">
                    <td className="p-4 font-medium text-foreground">{subject.subjectName}</td>
                    <td className="p-4 text-center">
                      <span className="text-lg font-bold">{subject.average.toFixed(1)}</span>
                    </td>
                    <td className="p-4 text-center">{subject.absences}</td>
                    <td className="p-4 text-center">
                      <StatusBadge status={subject.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentStatusPage;
