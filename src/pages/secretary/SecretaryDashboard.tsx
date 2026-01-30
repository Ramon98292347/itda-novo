import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { Users, GraduationCap, BookOpen, School, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const SecretaryDashboard: React.FC = () => {
  const [totalStudents, setTotalStudents] = useState(0);
  const [teachersCount, setTeachersCount] = useState(0);
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, number>>({});
  const [activeBimestersCount, setActiveBimestersCount] = useState(0);

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
        const [
          teachersRes,
          subjectsRes,
          classesRes,
          studentsRes,
          activeBimestersRes,
        ] = await Promise.all([
          supabase.from('teachers').select('id', { count: 'exact' }),
          supabase.from('subjects').select('id', { count: 'exact' }),
          supabase.from('classes').select('id,name').order('name', { ascending: true }),
          supabase.from('students').select('id,class_id'),
          supabase.from('bimesters').select('id', { count: 'exact' }).eq('status', 'active'),
        ]);

        if (teachersRes.error) throw teachersRes.error;
        if (subjectsRes.error) throw subjectsRes.error;
        if (classesRes.error) throw classesRes.error;
        if (studentsRes.error) throw studentsRes.error;
        if (activeBimestersRes.error) throw activeBimestersRes.error;

        const studentsData = (studentsRes.data ?? []) as Array<{ id: string; class_id: string | null }>;
        const byClass: Record<string, number> = {};
        for (const student of studentsData) {
          if (!student.class_id) continue;
          byClass[student.class_id] = (byClass[student.class_id] ?? 0) + 1;
        }

        if (!cancelled) {
          setTeachersCount(teachersRes.count ?? 0);
          setSubjectsCount(subjectsRes.count ?? 0);
          setClasses((classesRes.data ?? []).map((row) => ({ id: row.id, name: row.name })));
          setTotalStudents(studentsData.length);
          setStudentsByClass(byClass);
          setActiveBimestersCount(activeBimestersRes.count ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: formatSupabaseError(
              err,
              'Falha ao carregar métricas do dashboard. Verifique as variáveis do Supabase e as permissões (RLS).',
            ),
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

  const stats = [
    { title: 'Total de Alunos', value: totalStudents, icon: Users, variant: 'primary' as const },
    { title: 'Professores', value: teachersCount, icon: GraduationCap, variant: 'secondary' as const },
    { title: 'Disciplinas', value: subjectsCount, icon: BookOpen, variant: 'accent' as const },
    { title: 'Turmas', value: classes.length, icon: School, variant: 'primary' as const },
    { title: 'Bimestres Ativos', value: activeBimestersCount, icon: Calendar, variant: 'success' as const },
    { title: 'Taxa de Aprovação', value: '78%', icon: TrendingUp, variant: 'secondary' as const },
  ];

  const recentActivities = [
    { id: 1, action: 'Novo aluno matriculado', description: 'Pedro Almeida - Teologia Básica', time: '2 horas atrás' },
    { id: 2, action: 'Notas lançadas', description: '1º Bimestre - Antigo Testamento', time: '4 horas atrás' },
    { id: 3, action: 'Nova turma criada', description: 'Ministério Pastoral - Turma D', time: '1 dia atrás' },
    { id: 4, action: 'Professor cadastrado', description: 'Prof. Maria Santos', time: '2 dias atrás' },
  ];

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="page-title">Dashboard da Secretaria</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao painel administrativo do sistema ETDA
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="section-title">Atividades Recentes</h2>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{activity.action}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats by Class */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="section-title">Alunos por Turma</h2>
            <div className="space-y-4">
              {classes.map((cls) => {
                const studentCount = studentsByClass[cls.id] ?? 0;
                const percentage = totalStudents > 0 ? (studentCount / totalStudents) * 100 : 0;
                
                return (
                  <div key={cls.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-foreground">{cls.name}</span>
                      <span className="text-muted-foreground">{studentCount} alunos</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SecretaryDashboard;
