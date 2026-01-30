import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Bimester, Student, Subject } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export const TeacherAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [bimesters, setBimesters] = useState<Bimester[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBimester, setSelectedBimester] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [existingAttendance, setExistingAttendance] = useState<Record<string, AttendanceRow>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyStudentId, setHistoryStudentId] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<Array<{ date: string; present: boolean; subjectName: string; bimesterName: string }>>([]);

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

  type AttendanceRow = {
    id: string;
    student_id: string;
    subject_id: string;
    bimester_id: string;
    date: string;
    present: boolean;
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
          setSubjects(teacherSubjects);
          setSelectedSubject((prev) => (teacherSubjects.some((s) => s.id === prev) ? prev : ''));
          setStudents(mappedStudents);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: formatSupabaseError(err, 'Falha ao carregar dados para presença. Verifique as permissões (RLS).'),
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
            description: formatSupabaseError(err, 'Falha ao carregar bimestres da disciplina.'),
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
      setExistingAttendance({});
      setAttendance({});

      if (!selectedSubject || !selectedBimester || !selectedDate) return;

      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('id,student_id,subject_id,bimester_id,date,present')
          .eq('subject_id', selectedSubject)
          .eq('bimester_id', selectedBimester)
          .eq('date', selectedDate);

        if (error) throw error;

        const byStudent: Record<string, AttendanceRow> = {};
        const current: Record<string, boolean> = {};
        for (const row of (data ?? []) as AttendanceRow[]) {
          byStudent[row.student_id] = row;
          current[row.student_id] = row.present;
        }

        if (!cancelled) {
          setExistingAttendance(byStudent);
          setAttendance(current);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: formatSupabaseError(err, 'Falha ao carregar presenças existentes.'),
            variant: 'destructive',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedSubject, selectedBimester, selectedDate]);

  const toggleAttendance = (studentId: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const markAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    students.forEach((student) => {
      allPresent[student.id] = true;
    });
    setAttendance(allPresent);
  };

  const handleSave = () => {
    if (!selectedSubject || !selectedBimester || !selectedDate) return;

    void (async () => {
      try {
        const rows: Array<Partial<AttendanceRow> & { student_id: string; subject_id: string; bimester_id: string; date: string; present: boolean }> = [];

        for (const student of students) {
          const present = attendance[student.id] ?? false;
          rows.push({
            student_id: student.id,
            subject_id: selectedSubject,
            bimester_id: selectedBimester,
            date: selectedDate,
            present,
          });
        }

        const { error } = await supabase
          .from('attendance')
          .upsert(rows, { onConflict: 'student_id,subject_id,bimester_id,date' });
        if (error) throw error;

        toast({ title: 'Sucesso', description: 'Presença registrada com sucesso!' });

        const { data, error: reloadErr } = await supabase
          .from('attendance')
          .select('id,student_id,subject_id,bimester_id,date,present')
          .eq('subject_id', selectedSubject)
          .eq('bimester_id', selectedBimester)
          .eq('date', selectedDate);

        if (reloadErr) throw reloadErr;

        const byStudent: Record<string, AttendanceRow> = {};
        for (const row of (data ?? []) as AttendanceRow[]) {
          byStudent[row.student_id] = row;
        }
        setExistingAttendance(byStudent);
      } catch (err) {
        toast({
          title: 'Erro',
          description: formatSupabaseError(err, 'Falha ao salvar presença.'),
          variant: 'destructive',
        });
      }
    })();
  };

  const loadHistory = (studentId: string) => {
    if (!studentId || !selectedSubject || !selectedBimester) return;

    setHistoryLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('date,present,subjects(name),bimesters(name)')
          .eq('student_id', studentId)
          .eq('subject_id', selectedSubject)
          .eq('bimester_id', selectedBimester)
          .order('date', { ascending: false });

        if (error) throw error;

        const mapped = (data ?? []).map((row: unknown) => {
          const item = row as {
            date: string;
            present: boolean;
            subjects: { name: string } | null;
            bimesters: { name: string } | null;
          };

          return {
            date: item.date,
            present: item.present,
            subjectName: item.subjects?.name ?? '-',
            bimesterName: item.bimesters?.name ?? '-',
          };
        });

        setHistoryRows(mapped);
      } catch (err) {
        toast({
          title: 'Erro',
          description: formatSupabaseError(err, 'Falha ao carregar histórico de presenças.'),
          variant: 'destructive',
        });
      } finally {
        setHistoryLoading(false);
      }
    })();
  };

  const openHistory = (studentId: string) => {
    setHistoryStudentId(studentId);
    setIsHistoryOpen(true);
    loadHistory(studentId);
  };

  return (
    <DashboardLayout allowedRoles={['teacher']}>
      <PageHeader
        title="Lançar Presença"
        subtitle="Registre a presença dos alunos"
      />

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      {selectedSubject && selectedBimester && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <>
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-muted-foreground">
              Data: <span className="font-medium text-foreground">
                {new Date(selectedDate).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => openHistory(historyStudentId || students[0]?.id || '')} disabled={!students.length}>
                Ver Presenças
              </Button>
              <Button variant="outline" onClick={markAllPresent}>
                Marcar Todos Presentes
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="text-left p-4 font-semibold">Aluno</th>
                  <th className="text-left p-4 font-semibold">Turma</th>
                  <th className="text-center p-4 font-semibold w-32">Presença</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const isPresent = attendance[student.id] ?? false;

                  return (
                    <tr key={student.id} className="table-row">
                      <td className="p-4">
                        <button type="button" onClick={() => openHistory(student.id)} className="text-left">
                          <p className="font-medium text-foreground">{student.name}</p>
                        </button>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {student.className}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => toggleAttendance(student.id)}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            isPresent
                              ? 'bg-success/10 text-success hover:bg-success/20'
                              : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                          }`}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            {isPresent ? <CheckCircle key="present" size={18} /> : <XCircle key="absent" size={18} />}
                            <span>{isPresent ? 'Presente' : 'Ausente'}</span>
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-muted-foreground">
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
              Salvar Presença
            </Button>
          </div>
            </>
          )}
        </div>
      )}

      {(!selectedSubject || !selectedBimester) && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">
            Selecione uma disciplina e um bimestre para registrar a presença.
          </p>
        </div>
      )}

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Presenças do aluno</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Aluno</label>
                <select
                  value={historyStudentId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setHistoryStudentId(next);
                    loadHistory(next);
                  }}
                  className="form-input"
                >
                  <option value="">Selecione um aluno</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-muted/30 rounded-lg border border-border p-3">
                <p className="text-sm text-muted-foreground">Filtros</p>
                <p className="text-sm text-foreground mt-1">
                  {subjects.find((s) => s.id === selectedSubject)?.name ?? '-'} /{' '}
                  {filteredBimesters.find((b) => b.id === selectedBimester)?.name ?? '-'}
                </p>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 bg-muted/30 text-sm font-medium text-foreground">
                <div className="p-3">Data</div>
                <div className="p-3">Bimestre</div>
                <div className="p-3 text-right">Status</div>
              </div>

              {historyLoading ? (
                <div className="p-6 text-center text-muted-foreground">Carregando...</div>
              ) : historyStudentId && historyRows.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Nenhum registro encontrado.</div>
              ) : (
                historyRows.map((r) => (
                  <div key={r.date} className="grid grid-cols-3 border-t border-border text-sm">
                    <div className="p-3">{new Date(r.date).toLocaleDateString('pt-BR')}</div>
                    <div className="p-3">{r.bimesterName}</div>
                    <div className={`p-3 text-right font-medium ${r.present ? 'text-success' : 'text-destructive'}`}>
                      {r.present ? 'Presente' : 'Ausente'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setIsHistoryOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TeacherAttendancePage;
