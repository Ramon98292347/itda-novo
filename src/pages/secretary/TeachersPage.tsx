import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Subject, Teacher } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { createAuthUserAsSecretary, supabase } from '@/lib/supabaseClient';

interface TeacherItem extends Omit<Teacher, 'subjectId' | 'subjectName'> {
  userId: string;
  subjectIds: string[];
  subjectNames?: string;
}

export const TeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subjectIds: [] as string[],
    password: '',
  });

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

  const loadSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('id,name,workload').order('name', { ascending: true });
    if (error) throw error;
    setSubjects((data ?? []).map((row) => ({ id: row.id, name: row.name, workload: row.workload })));
  };

  type TeacherDbRow = {
    id: string;
    user_id: string;
    users: { id: string; name: string; email: string } | null;
    teacher_subjects: Array<{ subjects: { id: string; name: string } | null }> | null;
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('id,user_id,users(id,name,email),teacher_subjects(subjects(id,name))')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped: TeacherItem[] = ((data ?? []) as TeacherDbRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.users?.name ?? '',
      email: row.users?.email ?? '',
      subjectIds: (row.teacher_subjects ?? [])
        .map((rel) => rel.subjects?.id)
        .filter((id): id is string => Boolean(id)),
      subjectNames: (row.teacher_subjects ?? [])
        .map((rel) => rel.subjects?.name)
        .filter((name): name is string => Boolean(name))
        .join(', ') || undefined,
    }));

    setTeachers(mapped);
  };

  const columns = [
    { key: 'name' as const, header: 'Nome' },
    { key: 'email' as const, header: 'Email' },
    { key: 'subjectNames' as const, header: 'Disciplinas' },
    { key: 'actions' as const, header: 'Ações' },
  ];

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadSubjects(), loadTeachers()]);
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: formatSupabaseError(
              err,
              'Falha ao carregar professores do banco. Verifique as variáveis do Supabase e as permissões (RLS).',
            ),
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

  const handleOpenModal = (teacher?: TeacherItem) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setFormData({
        name: teacher.name,
        email: teacher.email,
        subjectIds: teacher.subjectIds,
        password: '',
      });
    } else {
      setEditingTeacher(null);
      setFormData({ name: '', email: '', subjectIds: [], password: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || formData.subjectIds.length === 0 || (!editingTeacher && !formData.password)) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    void (async () => {
      const selectedSubjects = subjects.filter((s) => formData.subjectIds.includes(s.id));

      try {
        if (editingTeacher) {
          const { error: userError } = await supabase
            .from('users')
            .update({ name: formData.name, email: formData.email })
            .eq('id', editingTeacher.userId);

          if (userError) throw userError;

          const { data: teacherData, error: teacherFetchError } = await supabase
            .from('teachers')
            .select('id')
            .eq('user_id', editingTeacher.userId)
            .single();

          if (teacherFetchError) throw teacherFetchError;

          if (teacherData) {
            await supabase
              .from('teacher_subjects')
              .delete()
              .eq('teacher_id', teacherData.id);

            if (formData.subjectIds.length > 0) {
              const { error: subjectError } = await supabase
                .from('teacher_subjects')
                .insert(formData.subjectIds.map((subjectId) => ({ teacher_id: teacherData.id, subject_id: subjectId })));
              if (subjectError) throw subjectError;
            }
          }

          await loadTeachers();
          toast({ title: 'Sucesso', description: 'Professor atualizado com sucesso!' });
        } else {
          const { userId } = await createAuthUserAsSecretary({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: 'teacher',
            subjectId: formData.subjectIds[0],
          });

          const { error: insertUserErr } = await supabase
            .from('users')
            .insert({ id: userId, name: formData.name, email: formData.email, role: 'teacher' });
          if (insertUserErr && (insertUserErr as unknown as { code?: string }).code !== '23505') throw insertUserErr;

          const { error: insertTeacherErr } = await supabase.from('teachers').insert({ user_id: userId });
          if (insertTeacherErr && (insertTeacherErr as unknown as { code?: string }).code !== '23505') throw insertTeacherErr;

          const { data: teacherRow, error: teacherSelectErr } = await supabase
            .from('teachers')
            .select('id')
            .eq('user_id', userId)
            .single();
          if (teacherSelectErr || !teacherRow?.id) throw teacherSelectErr ?? new Error('Falha ao localizar professor');

          const { error: relDelErr } = await supabase.from('teacher_subjects').delete().eq('teacher_id', teacherRow.id);
          if (relDelErr) throw relDelErr;

          const { error: relInsErr } = await supabase
            .from('teacher_subjects')
            .insert(formData.subjectIds.map((subjectId) => ({ teacher_id: teacherRow.id, subject_id: subjectId })));
          if (relInsErr) throw relInsErr;

          await loadTeachers();
          toast({
            title: 'Sucesso',
            description: `Professor criado com sucesso.${selectedSubjects.length ? ` (${selectedSubjects.map((s) => s.name).join(', ')})` : ''}`,
          });
        }

        setIsModalOpen(false);
      } catch (err) {
        toast({
          title: 'Erro',
          description: formatSupabaseError(err, 'Falha ao salvar professor.'),
          variant: 'destructive',
        });
      }
    })();
  };

  const handleDelete = (teacher: TeacherItem) => {
    void (async () => {
      if (!window.confirm(`Deseja realmente excluir o professor "${teacher.name}"?`)) return;

      try {
        const { error: teacherErr } = await supabase.from('teachers').delete().eq('id', teacher.id);
        if (teacherErr) throw teacherErr;
        const { error: userErr } = await supabase.from('users').delete().eq('id', teacher.userId);
        if (userErr) throw userErr;
        await loadTeachers();
        toast({ title: 'Sucesso', description: 'Professor excluído com sucesso!' });
      } catch (err) {
        toast({
          title: 'Erro',
          description: formatSupabaseError(err, 'Falha ao excluir professor.'),
          variant: 'destructive',
        });
      }
    })();
  };

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <PageHeader
        title="Professores"
        subtitle="Gerencie o corpo docente"
        action={{ label: 'Adicionar Professor', onClick: () => handleOpenModal() }}
      />

      <DataTable
        data={teachers}
        columns={columns}
        keyExtractor={(item) => item.id}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTeacher ? 'Editar Professor' : 'Adicionar Professor'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="form-input"
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Disciplina
              </label>
              <select
                multiple
                value={formData.subjectIds}
                onChange={(e) => setFormData({ ...formData, subjectIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                className="form-input"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Segure Ctrl (Windows) ou Command (Mac) para selecionar mais de uma.
              </p>
            </div>

            {!editingTeacher && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            )}

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary">
                {editingTeacher ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TeachersPage;
