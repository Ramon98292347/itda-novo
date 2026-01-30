import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Class, Student } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { createAuthUserAsSecretary, supabase } from '@/lib/supabaseClient';

export const StudentsPage: React.FC = () => {
  type StudentItem = Student & { userId: string };
  type StudentDbRow = {
    id: string;
    user_id: string;
    cpf: string;
    birth_date: string;
    class_id: string;
    users?: { id: string; name: string; email: string } | null;
    classes?: { id: string; name: string } | null;
  };

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    cpf: '',
    birthDate: '',
    classId: '',
  });

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,academic_year')
      .order('name', { ascending: true });

    if (error) throw error;

    const mapped: Class[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      academicYear: row.academic_year,
    }));

    setClasses(mapped);
  };

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id,user_id,cpf,birth_date,class_id,users(id,name,email),classes(id,name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped: StudentItem[] = ((data ?? []) as StudentDbRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.users?.name ?? '',
      email: row.users?.email ?? '',
      cpf: row.cpf,
      birthDate: row.birth_date,
      classId: row.class_id,
      className: row.classes?.name ?? undefined,
    }));

    setStudents(mapped);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadClasses(), loadStudents()]);
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar dados do banco. Verifique as variáveis do Supabase e as permissões (RLS).',
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

  // Responsivo: no mobile mostramos "Aluno" com resumo e escondemos colunas secundárias.
  const columns = [
    {
      key: 'name' as const,
      header: 'Aluno',
      render: (item: StudentItem) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{item.name}</p>
          <div className="sm:hidden mt-1 space-y-0.5">
            <p className="text-xs text-muted-foreground truncate">{item.email}</p>
            <p className="text-xs text-muted-foreground">
              {item.className ?? '-'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'email' as const, header: 'Email', hideOnMobile: true, cellClassName: 'max-w-[260px] truncate' },
    { key: 'cpf' as const, header: 'CPF', hideOnMobile: true },
    {
      key: 'birthDate' as const,
      header: 'Nascimento',
      hideOnMobile: true,
      render: (item: Student) => {
        const date = new Date(item.birthDate);
        return date.toLocaleDateString('pt-BR');
      },
    },
    { key: 'className' as const, header: 'Turma', hideOnMobile: true },
    { key: 'actions' as const, header: 'Ações' },
  ];

  const handleOpenModal = (student?: StudentItem) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name,
        email: student.email,
        password: '',
        cpf: student.cpf,
        birthDate: student.birthDate,
        classId: student.classId,
      });
    } else {
      setEditingStudent(null);
      setFormData({ name: '', email: '', password: '', cpf: '', birthDate: '', classId: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.email ||
      (!editingStudent && !formData.password) ||
      !formData.cpf ||
      !formData.birthDate ||
      !formData.classId
    ) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    void (async () => {
      try {
        if (editingStudent) {
          const { error: userError } = await supabase
            .from('users')
            .update({ name: formData.name, email: formData.email })
            .eq('id', editingStudent.userId);

          if (userError) throw userError;

          const { error: studentError } = await supabase
            .from('students')
            .update({
              cpf: formData.cpf,
              birth_date: formData.birthDate,
              class_id: formData.classId,
            })
            .eq('user_id', editingStudent.userId);

          if (studentError) throw studentError;

          await loadStudents();
          toast({ title: 'Sucesso', description: 'Aluno atualizado com sucesso!' });
        } else {
          const { userId } = await createAuthUserAsSecretary({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: 'student',
            cpf: formData.cpf,
            birthDate: formData.birthDate,
            classId: formData.classId,
          });

          const { error: insertUserErr } = await supabase
            .from('users')
            .insert({ id: userId, name: formData.name, email: formData.email, role: 'student' });
          if (insertUserErr && (insertUserErr as unknown as { code?: string }).code !== '23505') throw insertUserErr;

          const { error: insertStudentErr } = await supabase.from('students').insert({
            user_id: userId,
            cpf: formData.cpf,
            birth_date: formData.birthDate,
            class_id: formData.classId,
          });
          if (insertStudentErr) throw insertStudentErr;

          await loadStudents();
          toast({ title: 'Sucesso', description: 'Aluno criado com sucesso!' });
        }

        setIsModalOpen(false);
      } catch (err) {
        toast({
          title: 'Erro',
          description: err instanceof Error ? err.message : 'Falha ao salvar aluno.',
          variant: 'destructive',
        });
      }
    })();
  };

  const handleDelete = (student: StudentItem) => {
    void (async () => {
      if (!window.confirm(`Deseja realmente excluir o aluno "${student.name}"?`)) return;

      try {
        const { error } = await supabase.from('users').delete().eq('id', student.userId);
        if (error) throw error;
        setStudents((prev) => prev.filter((s) => s.id !== student.id));
        toast({ title: 'Sucesso', description: 'Aluno excluído com sucesso!' });
      } catch (err) {
        toast({
          title: 'Erro',
          description: err instanceof Error ? err.message : 'Falha ao excluir aluno.',
          variant: 'destructive',
        });
      }
    })();
  };

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <PageHeader
        title="Alunos"
        subtitle="Gerencie os alunos matriculados"
        action={{ label: 'Adicionar Aluno', onClick: () => handleOpenModal() }}
      />

      <DataTable
        data={students}
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
              {editingStudent ? 'Editar Aluno' : 'Adicionar Aluno'}
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

            {!editingStudent && (
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

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                CPF
              </label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="form-input"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Data de Nascimento
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Turma
              </label>
              <select
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                className="form-input"
              >
                <option value="">Selecione uma turma</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="btn-primary"
              >
                {editingStudent ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentsPage;
