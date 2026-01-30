import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Subject } from '@/data/mockData';
import { BookOpen, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const TeacherSubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('teachers')
          .select('teacher_subjects(subjects(id,name,workload))')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        const teacherSubjects = (
          (data as { teacher_subjects: Array<{ subjects: { id: string; name: string; workload: number } | null }> | null } | null)
            ?.teacher_subjects ?? []
        )
          .map((rel) => rel.subjects)
          .filter((s): s is { id: string; name: string; workload: number } => Boolean(s))
          .map((s) => ({ id: s.id, name: s.name, workload: s.workload }));

        if (!cancelled) {
          setSubjects(teacherSubjects);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar suas disciplinas do banco. Verifique as permissões (RLS).',
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
        title="Minhas Disciplinas"
        subtitle="Disciplinas que você leciona"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Carregando...</div>
        ) : subjects.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Nenhuma disciplina vinculada.</div>
        ) : (
          subjects.map((subject) => (
          <div
            key={subject.id}
            className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <BookOpen size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{subject.name}</h3>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={16} />
              <span>{subject.workload} horas</span>
            </div>
          </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherSubjectsPage;
