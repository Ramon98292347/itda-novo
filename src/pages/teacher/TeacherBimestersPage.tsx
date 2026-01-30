import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Bimester } from '@/data/mockData';
import { Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const TeacherBimestersPage: React.FC = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState<{ id: string; name: string } | null>(null);
  const [bimesters, setBimesters] = useState<Bimester[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const { data: teacherRow, error: teacherErr } = await supabase
          .from('teachers')
          .select('teacher_subjects(subjects(id,name))')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (teacherErr) throw teacherErr;

        const subjectData =
          (teacherRow as { teacher_subjects: Array<{ subjects: { id: string; name: string } | null }> | null } | null)
            ?.teacher_subjects?.[0]?.subjects ?? null;

        if (!subjectData) {
          if (!cancelled) {
            setSubject(null);
            setBimesters([]);
          }
          return;
        }

        const { data: bimestersData, error: bimestersErr } = await supabase
          .from('bimesters')
          .select('id,name,subject_id,start_date,end_date,status')
          .eq('subject_id', subjectData.id)
          .order('start_date', { ascending: true });

        if (bimestersErr) throw bimestersErr;

        const mapped: Bimester[] = (bimestersData ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          subjectId: row.subject_id,
          subjectName: subjectData.name,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
        }));

        if (!cancelled) {
          setSubject(subjectData);
          setBimesters(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar bimestres do banco. Verifique as permissões (RLS).',
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

  return (
    <DashboardLayout allowedRoles={['teacher']}>
      <PageHeader
        title="Bimestres"
        subtitle="Visualize os bimestres das suas disciplinas"
      />

      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Carregando...</div>
        ) : !subject ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Nenhuma disciplina vinculada.</div>
        ) : (
          <div key={subject.id} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                {subject.name}
              </h3>
            </div>
            
            {bimesters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                {bimesters.map((bimester) => (
                  <div
                    key={bimester.id}
                    className={`p-4 rounded-lg border ${
                      bimester.status === 'active'
                        ? 'border-success/30 bg-success/5'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <p className="font-medium text-foreground">{bimester.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(bimester.startDate).toLocaleDateString('pt-BR')} -{' '}
                      {new Date(bimester.endDate).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={bimester.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum bimestre cadastrado para esta disciplina.
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherBimestersPage;
