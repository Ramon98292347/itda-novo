import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { User, BookOpen, Calendar, CheckCircle } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [student, setStudent] = useState<StudentItem | null>(null);
  const [grades, setGrades] = useState<GradeItem[]>([]);

  interface StudentItem {
    id: string;
    userId: string;
    name: string;
    email: string;
    cpf: string;
    classId: string;
    className?: string;
  }

  interface GradeItem {
    id: string;
    average: number;
    status: 'approved' | 'recovery' | 'failed';
    absences: number;
    subjectName?: string;
    bimesterName?: string;
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;

      try {
        const { data: studentRow, error: studentErr } = await supabase
          .from('students')
          .select('id,user_id,cpf,class_id,birth_date,users(id,name,email),classes(id,name)')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (studentErr) throw studentErr;

        const row = studentRow as unknown as {
          id: string;
          user_id: string;
          cpf: string;
          class_id: string;
          users: { id: string; name: string; email: string } | null;
          classes: { id: string; name: string } | null;
        } | null;

        const mappedStudent: StudentItem | null = row
          ? {
              id: row.id,
              userId: row.user_id,
              name: row.users?.name ?? '',
              email: row.users?.email ?? '',
              cpf: row.cpf,
              classId: row.class_id,
              className: row.classes?.name ?? undefined,
            }
          : null;

        if (!mappedStudent) {
          if (!cancelled) {
            setStudent(null);
            setGrades([]);
          }
          return;
        }

        const { data: gradesData, error: gradesErr } = await supabase
          .from('grades')
          .select('id,average,status,absences,subjects(name),bimesters(name)')
          .eq('student_id', mappedStudent.id)
          .order('created_at', { ascending: false });

        if (gradesErr) throw gradesErr;

        const mappedGrades: GradeItem[] = (gradesData ?? []).map((g: unknown) => {
          const gradeRow = g as {
            id: string;
            average: number | null;
            status: 'approved' | 'recovery' | 'failed';
            absences: number | null;
            subjects: { name: string } | null;
            bimesters: { name: string } | null;
          };

          return {
            id: gradeRow.id,
            average: gradeRow.average ?? 0,
            absences: gradeRow.absences ?? 0,
            status: gradeRow.status,
            subjectName: gradeRow.subjects?.name ?? undefined,
            bimesterName: gradeRow.bimesters?.name ?? undefined,
          };
        });

        if (!cancelled) {
          setStudent(mappedStudent);
          setGrades(mappedGrades);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar dados do aluno. Verifique as permissões (RLS).',
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

  const totalAbsences = useMemo(() => grades.reduce((sum, g) => sum + (g.absences ?? 0), 0), [grades]);
  const averageGrade = useMemo(() => (grades.length > 0 ? grades.reduce((sum, g) => sum + (g.average ?? 0), 0) / grades.length : 0), [grades]);

  const stats = [
    { title: 'Minha Turma', value: student?.className || '-', icon: BookOpen, variant: 'primary' as const },
    { title: 'Média Geral', value: averageGrade.toFixed(1), icon: CheckCircle, variant: 'success' as const },
    { title: 'Total de Faltas', value: totalAbsences, icon: Calendar, variant: 'accent' as const },
  ];

  return (
    <DashboardLayout allowedRoles={['student']}>
      <div className="space-y-8">
        {/* Profile Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={40} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{student?.name || '-'}</h1>
              <p className="text-muted-foreground">{student?.email || '-'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <BookOpen size={16} />
                  {student?.className || '-'}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                  CPF: {student?.cpf || '-'}
                </span>
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

        {/* Recent Grades */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="section-title">Últimas Notas</h2>
          {grades.length > 0 ? (
            <div className="space-y-4">
              {grades.slice(0, 4).map((grade) => {
                return (
                  <div
                    key={grade.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-muted/30 gap-4"
                  >
                    <div>
                      <p className="font-medium text-foreground">{grade.subjectName || '-'}</p>
                      <p className="text-sm text-muted-foreground">{grade.bimesterName || '-'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Média</p>
                        <p className="text-xl font-bold text-foreground">{(grade.average ?? 0).toFixed(1)}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          grade.status === 'approved'
                            ? 'bg-success/10 text-success'
                            : grade.status === 'recovery'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {grade.status === 'approved' ? 'Aprovado' : grade.status === 'recovery' ? 'Recuperação' : 'Reprovado'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma nota registrada ainda.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
