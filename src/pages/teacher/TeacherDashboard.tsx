import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { User, BookOpen, Calendar, ClipboardList } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [teacher, setTeacher] = useState<{ name: string; email: string; subjects: Array<{ id: string; name: string; workload: number }> } | null>(null);
  const [bimesters, setBimesters] = useState<Array<{ id: string; name: string; startDate: string; endDate: string; status: 'active' | 'closed' }>>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;

      try {
        const { data: teacherRow, error: teacherErr } = await supabase
          .from('teachers')
          .select('id,user_id,users(id,name,email),teacher_subjects(subjects(id,name,workload))')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (teacherErr) throw teacherErr;

        const usersRow = (teacherRow as { users: { name: string; email: string } | null } | null)?.users ?? null;
        const subjectsRow = (
          (teacherRow as { teacher_subjects: Array<{ subjects: { id: string; name: string; workload: number } | null }> | null } | null)
            ?.teacher_subjects ?? []
        )
          .map((rel) => rel.subjects)
          .filter((s): s is { id: string; name: string; workload: number } => Boolean(s));
        const primarySubject = subjectsRow[0] ?? null;

        if (!primarySubject || !usersRow) {
          if (!cancelled) {
            setTeacher(null);
            setBimesters([]);
          }
          return;
        }

        const { data: bimestersData, error: bimestersErr } = await supabase
          .from('bimesters')
          .select('id,name,start_date,end_date,status')
          .eq('subject_id', primarySubject.id)
          .order('start_date', { ascending: true });

        if (bimestersErr) throw bimestersErr;

        if (!cancelled) {
          setTeacher({ name: usersRow.name, email: usersRow.email, subjects: subjectsRow });
          setBimesters(
            (bimestersData ?? []).map((b) => ({
              id: b.id,
              name: b.name,
              startDate: b.start_date,
              endDate: b.end_date,
              status: b.status,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar dados do professor. Verifique as permissões (RLS).',
            variant: 'destructive',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const activeBimesters = bimesters.filter((b) => b.status === 'active');

  const primarySubjectLabel = (() => {
    const list = teacher?.subjects ?? [];
    if (list.length === 0) return '-';
    if (list.length === 1) return list[0].name;
    return `${list[0].name} (+${list.length - 1})`;
  })();

  const stats = [
    { title: 'Minhas Disciplinas', value: primarySubjectLabel, icon: BookOpen, variant: 'primary' as const },
    { title: 'Carga Horária', value: `${teacher?.subjects?.[0]?.workload || 0}h`, icon: Calendar, variant: 'secondary' as const },
    { title: 'Bimestres Ativos', value: activeBimesters.length, icon: ClipboardList, variant: 'accent' as const },
  ];

  return (
    <DashboardLayout allowedRoles={['teacher']}>
      <div className="space-y-8">
        {/* Profile Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={40} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{teacher?.name || '-'}</h1>
              <p className="text-muted-foreground">{teacher?.email || '-'}</p>
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
                <BookOpen size={16} />
                {primarySubjectLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Bimesters Overview */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="section-title flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            Bimestres da Minha Disciplina
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <span
                  className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                    bimester.status === 'active'
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {bimester.status === 'active' ? 'Ativo' : 'Encerrado'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
