import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const StudentAbsencesPage: React.FC = () => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [grades, setGrades] = useState<Array<{ id: string; subjectName: string; bimesterName: string; absences: number }>>([]);
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
          .select('id,absences,subjects(name),bimesters(name)')
          .eq('student_id', sid)
          .order('created_at', { ascending: false });

        if (gradesErr) throw gradesErr;

        const mapped = (gradesData ?? []).map((g: unknown) => {
          const row = g as {
            id: string;
            absences: number | null;
            subjects: { name: string } | null;
            bimesters: { name: string } | null;
          };

          return {
            id: row.id,
            subjectName: row.subjects?.name ?? '-',
            bimesterName: row.bimesters?.name ?? '-',
            absences: row.absences ?? 0,
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
            description: 'Falha ao carregar faltas do banco. Verifique as permissões (RLS).',
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

  const totalAbsences = useMemo(() => grades.reduce((sum, g) => sum + (g.absences ?? 0), 0), [grades]);

  return (
    <DashboardLayout allowedRoles={['student']}>
      <PageHeader
        title="Faltas"
        subtitle="Acompanhe suas faltas por disciplina"
      />

      {/* Total Summary */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-warning/10 rounded-xl">
            <AlertCircle size={32} className="text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total de Faltas</p>
            <p className="text-4xl font-bold text-foreground">{isLoading ? '-' : totalAbsences}</p>
          </div>
        </div>
      </div>

      {/* Absences by Subject */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
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
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : !studentId ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">
                    Aluno não encontrado.
                  </td>
                </tr>
              ) : grades.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">
                    Nenhuma falta registrada.
                  </td>
                </tr>
              ) : (
                grades.map((grade) => (
                  <tr key={grade.id} className="table-row">
                    <td className="p-4 font-medium text-foreground">{grade.subjectName}</td>
                    <td className="p-4 text-muted-foreground">{grade.bimesterName}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-medium ${
                          grade.absences > 5
                            ? 'bg-destructive/10 text-destructive'
                            : grade.absences > 2
                            ? 'bg-warning/10 text-warning'
                            : 'bg-success/10 text-success'
                        }`}
                      >
                        {grade.absences}
                      </span>
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

export default StudentAbsencesPage;
