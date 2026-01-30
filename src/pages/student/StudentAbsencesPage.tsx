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
  const [absences, setAbsences] = useState<Array<{ id: string; subjectName: string; bimesterName: string; absences: number }>>([]);
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
            setAbsences([]);
          }
          return;
        }

        const { data: attendanceData, error: attendanceErr } = await supabase
          .from('attendance')
          .select('subject_id,bimester_id,subjects(name),bimesters(name),present')
          .eq('student_id', sid)
          .eq('present', false)
          .order('date', { ascending: false });

        if (attendanceErr) throw attendanceErr;

        const byKey = new Map<string, { subjectName: string; bimesterName: string; absences: number }>();
        for (const item of (attendanceData ?? []) as Array<{
          subject_id: string;
          bimester_id: string;
          subjects: { name: string } | null;
          bimesters: { name: string } | null;
          present: boolean;
        }>) {
          const key = `${item.subject_id}:${item.bimester_id}`;
          const prev = byKey.get(key);
          if (prev) {
            prev.absences += 1;
          } else {
            byKey.set(key, {
              subjectName: item.subjects?.name ?? '-',
              bimesterName: item.bimesters?.name ?? '-',
              absences: 1,
            });
          }
        }

        const mapped = Array.from(byKey.entries()).map(([key, value]) => ({
          id: key,
          subjectName: value.subjectName,
          bimesterName: value.bimesterName,
          absences: value.absences,
        }));

        if (!cancelled) {
          setStudentId(sid);
          setAbsences(mapped);
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

  const totalAbsences = useMemo(() => absences.reduce((sum, g) => sum + (g.absences ?? 0), 0), [absences]);

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
              ) : absences.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">
                    Nenhuma falta registrada.
                  </td>
                </tr>
              ) : (
                absences.map((row) => (
                  <tr key={row.id} className="table-row">
                    <td className="p-4 font-medium text-foreground">{row.subjectName}</td>
                    <td className="p-4 text-muted-foreground">{row.bimesterName}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-medium ${
                          row.absences > 5
                            ? 'bg-destructive/10 text-destructive'
                            : row.absences > 2
                            ? 'bg-warning/10 text-warning'
                            : 'bg-success/10 text-success'
                        }`}
                      >
                        {row.absences}
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
