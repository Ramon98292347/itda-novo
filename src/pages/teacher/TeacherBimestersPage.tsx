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
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
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

        const teacherSubjects = (
          (teacherRow as { teacher_subjects: Array<{ subjects: { id: string; name: string } | null }> | null } | null)
            ?.teacher_subjects ?? []
        )
          .map((rel) => rel.subjects)
          .filter((s): s is { id: string; name: string } => Boolean(s))
          .map((s) => ({ id: s.id, name: s.name }));

        if (!cancelled) {
          setSubjects(teacherSubjects);
          setSelectedSubjectId((prev) => (teacherSubjects.some((s) => s.id === prev) ? prev : teacherSubjects[0]?.id ?? ''));
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setBimesters([]);
      if (!selectedSubjectId) return;

      try {
        const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

        const { data: bimestersData, error: bimestersErr } = await supabase
          .from('bimesters')
          .select('id,name,subject_id,start_date,end_date,status')
          .eq('subject_id', selectedSubjectId)
          .order('start_date', { ascending: true });

        if (bimestersErr) throw bimestersErr;

        const mapped: Bimester[] = (bimestersData ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          subjectId: row.subject_id,
          subjectName: selectedSubject?.name,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
        }));

        if (!cancelled) setBimesters(mapped);
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar bimestres do banco. Verifique as permissões (RLS).',
            variant: 'destructive',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedSubjectId, subjects]);

  return (
    <DashboardLayout allowedRoles={['teacher']}>
      <PageHeader
        title="Bimestres"
        subtitle="Visualize os bimestres das suas disciplinas"
      />

      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Carregando...</div>
        ) : subjects.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Nenhuma disciplina vinculada.</div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                Bimestres por disciplina
              </h3>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="form-input sm:max-w-[320px]"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
