import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Subject } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    workload: '',
  });

  const loadSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('id,name,workload').order('name', { ascending: true });
    if (error) throw error;
    setSubjects((data ?? []).map((row) => ({ id: row.id, name: row.name, workload: row.workload })));
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        await loadSubjects();
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar disciplinas do banco. Verifique as variáveis do Supabase e as permissões (RLS).',
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
    { key: 'name' as const, header: 'Disciplina' },
    { key: 'workload' as const, header: 'Carga Horária', render: (item: Subject) => `${item.workload}h` },
    { key: 'actions' as const, header: 'Ações' },
  ];

  const handleOpenModal = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      setFormData({
        name: subject.name,
        workload: String(subject.workload),
      });
    } else {
      setEditingSubject(null);
      setFormData({ name: '', workload: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.workload) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    void (async () => {
      try {
        if (editingSubject) {
          const { error } = await supabase
            .from('subjects')
            .update({ name: formData.name, workload: Number(formData.workload) })
            .eq('id', editingSubject.id);
          if (error) throw error;
          await loadSubjects();
          toast({ title: 'Sucesso', description: 'Disciplina atualizada com sucesso!' });
        } else {
          const { error } = await supabase.from('subjects').insert({
            name: formData.name,
            workload: Number(formData.workload),
          });
          if (error) throw error;
          await loadSubjects();
          toast({ title: 'Sucesso', description: 'Disciplina cadastrada com sucesso!' });
        }

        setIsModalOpen(false);
      } catch (err) {
        toast({
          title: 'Erro',
          description: 'Falha ao salvar disciplina.',
          variant: 'destructive',
        });
      }
    })();
  };

  const handleDelete = (subject: Subject) => {
    void (async () => {
      if (!window.confirm(`Deseja realmente excluir a disciplina "${subject.name}"?`)) return;
      try {
        const { error } = await supabase.from('subjects').delete().eq('id', subject.id);
        if (error) throw error;
        setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
        toast({ title: 'Sucesso', description: 'Disciplina excluída com sucesso!' });
      } catch (err) {
        toast({
          title: 'Erro',
          description: 'Falha ao excluir disciplina.',
          variant: 'destructive',
        });
      }
    })();
  };

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <PageHeader
        title="Disciplinas"
        subtitle="Gerencie as disciplinas do curso"
        action={{ label: 'Adicionar Disciplina', onClick: () => handleOpenModal() }}
      />

      <DataTable
        data={subjects}
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
              {editingSubject ? 'Editar Disciplina' : 'Adicionar Disciplina'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome da Disciplina
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="Nome da disciplina"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Carga Horária (horas)
              </label>
              <input
                type="number"
                value={formData.workload}
                onChange={(e) => setFormData({ ...formData, workload: e.target.value })}
                className="form-input"
                placeholder="60"
                min="1"
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
                {editingSubject ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SubjectsPage;
