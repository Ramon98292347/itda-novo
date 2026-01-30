import React, { useEffect, useMemo, useState } from 'react'; // React
import { DashboardLayout } from '@/components/layout/DashboardLayout'; // Layout protegido por autenticação/role
import { PageHeader } from '@/components/ui/PageHeader'; // Cabeçalho da página
import { StatusBadge } from '@/components/ui/StatusBadge'; // Badge visual da situação (aprovado/recuperação/reprovado)
import { useAuth } from '@/contexts/AuthContext'; // Usuário logado
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const StudentGradesPage: React.FC = () => {
  const { user } = useAuth(); // Dados do usuário autenticado
  const [studentId, setStudentId] = useState<string | null>(null);
  const [grades, setGrades] = useState<Array<{ id: string; subjectName: string; bimesterName: string; grade1: number; grade2: number; average: number; absences: number; status: 'approved' | 'recovery' | 'failed' }>>([]);
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
          .select('id,grade1,grade2,average,absences,status,subjects(name),bimesters(name)')
          .eq('student_id', sid)
          .order('created_at', { ascending: false });

        if (gradesErr) throw gradesErr;

        const mapped = (gradesData ?? []).map((g: unknown) => {
          const row = g as {
            id: string;
            grade1: number | null;
            grade2: number | null;
            average: number | null;
            absences: number | null;
            status: 'approved' | 'recovery' | 'failed';
            subjects: { name: string } | null;
            bimesters: { name: string } | null;
          };

          return {
            id: row.id,
            subjectName: row.subjects?.name ?? '-',
            bimesterName: row.bimesters?.name ?? '-',
            grade1: row.grade1 ?? 0,
            grade2: row.grade2 ?? 0,
            average: row.average ?? 0,
            absences: row.absences ?? 0,
            status: row.status,
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
            description: 'Falha ao carregar notas do banco. Verifique as permissões (RLS).',
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

  const gradesBySubject = useMemo(() => {
    const groups = new Map<string, Array<typeof grades[number]>>();
    for (const g of grades) {
      if (!groups.has(g.subjectName)) groups.set(g.subjectName, []);
      groups.get(g.subjectName)!.push(g);
    }
    return Array.from(groups.entries()).map(([subjectName, subjectGrades]) => ({ subjectName, grades: subjectGrades }));
  }, [grades]);

  return (
    <DashboardLayout allowedRoles={['student']}>
      <PageHeader
        title="Notas por Bimestre"
        subtitle="Visualize suas notas separadas por disciplina e bimestre"
      />

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">
            Carregando...
          </p>
        </div>
      ) : !studentId ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">
            Aluno não encontrado.
          </p>
        </div>
      ) : gradesBySubject.length > 0 ? (
        <div className="space-y-6">
          {gradesBySubject.map(({ subjectName, grades }) => (
            <div key={subjectName} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-semibold text-foreground">{subjectName}</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="text-left p-4 font-semibold">Bimestre</th>
                      <th className="text-center p-4 font-semibold">Nota 1</th>
                      <th className="text-center p-4 font-semibold">Nota 2</th>
                      <th className="text-center p-4 font-semibold">Média</th>
                      <th className="text-center p-4 font-semibold">Faltas</th>
                      <th className="text-center p-4 font-semibold">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id} className="table-row">
                        <td className="p-4 font-medium text-foreground">
                          {grade.bimesterName}
                        </td>
                        <td className="p-4 text-center">{grade.grade1.toFixed(1)}</td>
                        <td className="p-4 text-center">{grade.grade2.toFixed(1)}</td>
                        <td className="p-4 text-center">
                          <span className="text-lg font-bold">{grade.average.toFixed(1)}</span>
                        </td>
                        <td className="p-4 text-center">{grade.absences}</td>
                        <td className="p-4 text-center">
                          <StatusBadge status={grade.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">
            Nenhuma nota registrada para você ainda.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentGradesPage;
