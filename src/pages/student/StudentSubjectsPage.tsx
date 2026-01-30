import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Subject } from '@/data/mockData';
import { BookOpen, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const StudentSubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('subjects').select('id,name,workload').order('name', { ascending: true });
        if (error) throw error;
        if (!cancelled) setSubjects((data ?? []).map((row) => ({ id: row.id, name: row.name, workload: row.workload })));
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar disciplinas do banco. Verifique as permissões (RLS).',
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
  }, []);

  return (
    <DashboardLayout allowedRoles={['student']}>
      <PageHeader
        title="Minhas Disciplinas"
        subtitle="Disciplinas do seu curso"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Carregando...</div>
        ) : subjects.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">Nenhuma disciplina encontrada.</div>
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

export default StudentSubjectsPage;
