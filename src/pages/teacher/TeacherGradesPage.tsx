import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Bimester, Grade, Student, Subject, calculateAverage, calculateStatus } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export const TeacherGradesPage: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [bimesters, setBimesters] = useState<Bimester[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBimester, setSelectedBimester] = useState('');
  const [grades, setGrades] = useState<Record<string, { grade1?: string; grade2?: string; absences?: string }>>({});
  const [existingGrades, setExistingGrades] = useState<Record<string, GradeRow>>({});
  const [isLoading, setIsLoading] = useState(true);

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

  interface StudentItem extends Student {
    userId: string;
  }

  type GradeRow = {
    id: string;
    student_id: string;
    subject_id: string;
    bimester_id: string;
    grade1: number;
    grade2: number;
    absences: number;
    average: number;
    status: 'approved' | 'recovery' | 'failed';
  };

  const filteredBimesters = useMemo(() => bimesters.filter((b) => b.subjectId === selectedSubject), [bimesters, selectedSubject]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        const [{ data: teacherRow, error: teacherErr }, { data: studentsData, error: studentsErr }] = await Promise.all([
          supabase
            .from('teachers')
            .select('teacher_subjects(subjects(id,name,workload))')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('students')
            .select('id,user_id,cpf,birth_date,class_id,users(id,name,email),classes(id,name)')
            .order('created_at', { ascending: false }),
        ]);

        if (teacherErr) throw teacherErr;
        if (studentsErr) throw studentsErr;

        const teacherSubjects = (
          (teacherRow as { teacher_subjects: Array<{ subjects: { id: string; name: string; workload: number } | null }> | null } | null)
            ?.teacher_subjects ?? []
        )
          .map((rel) => rel.subjects)
          .filter((s): s is { id: string; name: string; workload: number } => Boolean(s))
          .map((s) => ({ id: s.id, name: s.name, workload: s.workload }));

        const mappedStudents: StudentItem[] = (studentsData ?? []).map((row: unknown) => {
          const studentRow = row as {
            id: string;
            user_id: string;
            cpf: string;
            birth_date: string;
            class_id: string;
            users: { id: string; name: string; email: string } | null;
            classes: { id: string; name: string } | null;
          };

          return {
            id: studentRow.id,
            userId: studentRow.user_id,
            name: studentRow.users?.name ?? '',
            email: studentRow.users?.email ?? '',
            cpf: studentRow.cpf,
            birthDate: studentRow.birth_date,
            classId: studentRow.class_id,
            className: studentRow.classes?.name ?? undefined,
          };
        });

        if (!cancelled) {
          setStudents(mappedStudents);
          setSubjects(teacherSubjects);
          setSelectedSubject((prev) => (teacherSubjects.some((s) => s.id === prev) ? prev : ''));
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar dados para lançamento de notas. Verifique as permissões (RLS).',
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
      if (!selectedSubject) {
        setBimesters([]);
        setSelectedBimester('');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('bimesters')
          .select('id,name,subject_id,start_date,end_date,status')
          .eq('subject_id', selectedSubject)
          .order('start_date', { ascending: true });

        if (error) throw error;

        const mapped: Bimester[] = (data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          subjectId: row.subject_id,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
        }));

        if (!cancelled) setBimesters(mapped);
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar bimestres da disciplina.',
            variant: 'destructive',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedSubject]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setExistingGrades({});
      setGrades({});

      if (!selectedSubject || !selectedBimester) return;

      try {
        const { data, error } = await supabase
          .from('grades')
          .select('id,student_id,subject_id,bimester_id,grade1,grade2,absences,average,status')
          .eq('subject_id', selectedSubject)
          .eq('bimester_id', selectedBimester);

        if (error) throw error;

        const byStudent: Record<string, GradeRow> = {};
        for (const row of (data ?? []) as GradeRow[]) {
          byStudent[row.student_id] = row;
        }

        if (!cancelled) setExistingGrades(byStudent);
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar notas existentes.',
            variant: 'destructive',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedSubject, selectedBimester]);

  const handleGradeChange = (studentId: string, field: 'grade1' | 'grade2' | 'absences', value: string) => {
    setGrades((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const getStudentGrade = (studentId: string) => {
    const existingGrade = existingGrades[studentId];
    const editedGrade = grades[studentId];

    const grade1 = editedGrade?.grade1 !== undefined ? Number(editedGrade.grade1) : (existingGrade?.grade1 || 0);
    const grade2 = editedGrade?.grade2 !== undefined ? Number(editedGrade.grade2) : (existingGrade?.grade2 || 0);
    const absences = editedGrade?.absences !== undefined ? Number(editedGrade.absences) : (existingGrade?.absences || 0);
    const average = calculateAverage(grade1, grade2);
    const status = calculateStatus(average);

    return { grade1, grade2, absences, average, status };
  };

  const handleSave = () => {
    if (!selectedSubject || !selectedBimester) return;

    const studentIds = Object.keys(grades);
    if (studentIds.length === 0) {
      toast({
        title: 'Info',
        description: 'Nenhuma alteração para salvar.',
      });
      return;
    }

    void (async () => {
      try {
        const toInsert: Array<{
          student_id: string;
          subject_id: string;
          bimester_id: string;
          grade1: number;
          grade2: number;
          absences: number;
          average: number;
          status: Grade['status'];
        }> = [];
        const toUpdate: Array<{
          id: string;
          grade1: number;
          grade2: number;
          absences: number;
          average: number;
          status: Grade['status'];
        }> = [];

        for (const studentId of studentIds) {
          const computed = getStudentGrade(studentId);
          const existing = existingGrades[studentId];
          if (existing?.id) {
            toUpdate.push({
              id: existing.id,
              grade1: computed.grade1,
              grade2: computed.grade2,
              absences: computed.absences,
              average: computed.average,
              status: computed.status,
            });
          } else {
            toInsert.push({
              student_id: studentId,
              subject_id: selectedSubject,
              bimester_id: selectedBimester,
              grade1: computed.grade1,
              grade2: computed.grade2,
              absences: computed.absences,
              average: computed.average,
              status: computed.status,
            });
          }
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from('grades').insert(toInsert);
          if (insErr) throw insErr;
        }

        for (const row of toUpdate) {
          const { error: updErr } = await supabase
            .from('grades')
            .update({
              grade1: row.grade1,
              grade2: row.grade2,
              absences: row.absences,
              average: row.average,
              status: row.status,
            })
            .eq('id', row.id);
          if (updErr) throw updErr;
        }

        toast({ title: 'Sucesso', description: 'Notas salvas com sucesso!' });

        const { data, error: reloadErr } = await supabase
          .from('grades')
          .select('id,student_id,subject_id,bimester_id,grade1,grade2,absences,average,status')
          .eq('subject_id', selectedSubject)
          .eq('bimester_id', selectedBimester);

        if (reloadErr) throw reloadErr;

        const byStudent: Record<string, GradeRow> = {};
        for (const row of (data ?? []) as GradeRow[]) {
          byStudent[row.student_id] = row;
        }
        setExistingGrades(byStudent);
        setGrades({});
      } catch (err) {
        toast({
          title: 'Erro',
          description: formatSupabaseError(err, 'Falha ao salvar notas.'),
          variant: 'destructive',
        });
      }
    })();
  };

  return (
    <DashboardLayout allowedRoles={['teacher']}>
      <PageHeader
        title="Lançar Notas"
        subtitle="Selecione a disciplina e o bimestre para lançar as notas"
      />

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Disciplina
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedBimester('');
              }}
              className="form-input"
            >
              <option value="">Selecione uma disciplina</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Bimestre
            </label>
            <select
              value={selectedBimester}
              onChange={(e) => setSelectedBimester(e.target.value)}
              className="form-input"
              disabled={!selectedSubject}
            >
              <option value="">Selecione um bimestre</option>
              {filteredBimesters.map((bimester) => (
                <option key={bimester.id} value={bimester.id}>
                  {bimester.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grades Table */}
      {selectedSubject && selectedBimester && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {/* Responsivo: em telas pequenas, a tabela pode rolar horizontalmente. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="table-header">
                      <th className="text-left p-4 font-semibold">Aluno</th>
                      <th className="text-center p-4 font-semibold w-24">Nota 1</th>
                      <th className="text-center p-4 font-semibold w-24">Nota 2</th>
                      <th className="text-center p-4 font-semibold w-24">Faltas</th>
                      <th className="text-center p-4 font-semibold w-24">Média</th>
                      <th className="text-center p-4 font-semibold w-32">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const gradeData = getStudentGrade(student.id);
                      const currentValues = grades[student.id];

                      return (
                        <tr key={student.id} className="table-row">
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-foreground">{student.name}</p>
                              <p className="text-sm text-muted-foreground">{student.className}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={currentValues?.grade1 ?? gradeData.grade1}
                              onChange={(e) => handleGradeChange(student.id, 'grade1', e.target.value)}
                              className="w-full px-3 py-2 text-center rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={currentValues?.grade2 ?? gradeData.grade2}
                              onChange={(e) => handleGradeChange(student.id, 'grade2', e.target.value)}
                              className="w-full px-3 py-2 text-center rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              value={currentValues?.absences ?? gradeData.absences}
                              onChange={(e) => handleGradeChange(student.id, 'absences', e.target.value)}
                              className="w-full px-3 py-2 text-center rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-lg font-bold text-foreground">{gradeData.average.toFixed(1)}</span>
                          </td>
                          <td className="p-4 text-center">
                            <StatusBadge status={gradeData.status} />
                          </td>
                        </tr>
                      );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          Nenhum aluno encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-border flex justify-end">
                <Button onClick={handleSave} className="btn-primary gap-2">
                  <Save size={20} />
                  Salvar Notas
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {(!selectedSubject || !selectedBimester) && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">
            Selecione uma disciplina e um bimestre para visualizar os alunos e lançar notas.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TeacherGradesPage;
