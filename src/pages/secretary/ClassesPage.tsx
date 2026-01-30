import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Class } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

export const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    academicYear: '',
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

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,academic_year')
      .order('name', { ascending: true });

    if (error) throw error;

    setClasses(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        academicYear: row.academic_year,
      })),
    );
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        await loadClasses();
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: formatSupabaseError(
              err,
              'Falha ao carregar turmas do banco. Verifique as variáveis do Supabase e as permissões (RLS).',
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

  const columns = [
    { key: 'name' as const, header: 'Nome da Turma' },
    { key: 'academicYear' as const, header: 'Ano Letivo' },
    { key: 'actions' as const, header: 'Ações' },
  ];

  const handleOpenModal = (classItem?: Class) => {
    if (classItem) {
      setEditingClass(classItem);
      setFormData({
        name: classItem.name,
        academicYear: classItem.academicYear,
      });
    } else {
      setEditingClass(null);
      setFormData({ name: '', academicYear: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.academicYear) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    void (async () => {
      try {
        if (editingClass) {
          const { error } = await supabase
            .from('classes')
            .update({ name: formData.name, academic_year: formData.academicYear })
            .eq('id', editingClass.id);

          if (error) throw error;
          await loadClasses();
          toast({ title: 'Sucesso', description: 'Turma atualizada com sucesso!' });
        } else {
          const { error } = await supabase.from('classes').insert({
            name: formData.name,
            academic_year: formData.academicYear,
          });

          if (error) throw error;
          await loadClasses();
          toast({ title: 'Sucesso', description: 'Turma cadastrada com sucesso!' });
        }

        setIsModalOpen(false);
      } catch (err) {
        toast({
          title: 'Erro',
          description: formatSupabaseError(err, 'Falha ao salvar turma.'),
          variant: 'destructive',
        });
      }
    })();
  };

  const handleDelete = (classItem: Class) => {
    void (async () => {
      if (!window.confirm(`Deseja realmente excluir a turma "${classItem.name}"?`)) return;
      try {
        const { error } = await supabase.from('classes').delete().eq('id', classItem.id);
        if (error) throw error;
        setClasses((prev) => prev.filter((c) => c.id !== classItem.id));
        toast({ title: 'Sucesso', description: 'Turma excluída com sucesso!' });
      } catch (err) {
        toast({
          title: 'Erro',
          description: formatSupabaseError(err, 'Falha ao excluir turma.'),
          variant: 'destructive',
        });
      }
    })();
  };

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <PageHeader
        title="Turmas"
        subtitle="Gerencie as turmas da escola"
        action={{ label: 'Adicionar Turma', onClick: () => handleOpenModal() }}
      />

      <DataTable
        data={classes}
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
              {editingClass ? 'Editar Turma' : 'Adicionar Turma'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome da Turma
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="Ex: Teologia Básica - Turma A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ano Letivo
              </label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="form-input"
                placeholder="2024"
              />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary">
                {editingClass ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ClassesPage;
