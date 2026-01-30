import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Bimester, Subject } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

export const BimestersPage: React.FC = () => {
  const [bimesters, setBimesters] = useState<Bimester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBimester, setEditingBimester] = useState<Bimester | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subjectId: '',
    startDate: '',
    endDate: '',
    status: 'active' as 'active' | 'closed',
  });

  const loadSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('id,name,workload').order('name', { ascending: true });
    if (error) throw error;
    setSubjects((data ?? []).map((row) => ({ id: row.id, name: row.name, workload: row.workload })));
  };

  type BimesterDbRow = {
    id: string;
    name: string;
    subject_id: string;
    start_date: string;
    end_date: string;
    status: 'active' | 'closed';
    subjects: { id: string; name: string } | null;
  };

  const loadBimesters = async () => {
    const { data, error } = await supabase
      .from('bimesters')
      .select('id,name,subject_id,start_date,end_date,status,subjects(id,name)')
      .order('start_date', { ascending: true });

    if (error) throw error;

    const mapped: Bimester[] = ((data ?? []) as BimesterDbRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      subjectId: row.subject_id,
      subjectName: row.subjects?.name ?? undefined,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
    }));

    setBimesters(mapped);
  };

  const columns = [
    { key: 'name' as const, header: 'Bimestre' },
    { key: 'subjectName' as const, header: 'Disciplina' },
    { key: 'startDate' as const, header: 'Início', render: (item: Bimester) => {
      const date = new Date(item.startDate);
      return date.toLocaleDateString('pt-BR');
    }},
    { key: 'endDate' as const, header: 'Fim', render: (item: Bimester) => {
      const date = new Date(item.endDate);
      return date.toLocaleDateString('pt-BR');
    }},
    { key: 'status' as const, header: 'Status', render: (item: Bimester) => (
      <StatusBadge status={item.status} />
    )},
    { key: 'actions' as const, header: 'Ações' },
  ];

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadSubjects(), loadBimesters()]);
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar bimestres do banco. Verifique as variáveis do Supabase e as permissões (RLS).',
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

  const handleOpenModal = (bimester?: Bimester) => {
    if (bimester) {
      setEditingBimester(bimester);
      setFormData({
        name: bimester.name,
        subjectId: bimester.subjectId,
        startDate: bimester.startDate,
        endDate: bimester.endDate,
        status: bimester.status,
      });
    } else {
      setEditingBimester(null);
      setFormData({ name: '', subjectId: '', startDate: '', endDate: '', status: 'active' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.subjectId || !formData.startDate || !formData.endDate) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    void (async () => {
      try {
        if (editingBimester) {
          const { error } = await supabase
            .from('bimesters')
            .update({
              name: formData.name,
              subject_id: formData.subjectId,
              start_date: formData.startDate,
              end_date: formData.endDate,
              status: formData.status,
            })
            .eq('id', editingBimester.id);

          if (error) throw error;
          await loadBimesters();
          toast({ title: 'Sucesso', description: 'Bimestre atualizado com sucesso!' });
        } else {
          const { error } = await supabase.from('bimesters').insert({
            name: formData.name,
            subject_id: formData.subjectId,
            start_date: formData.startDate,
            end_date: formData.endDate,
            status: formData.status,
          });

          if (error) throw error;
          await loadBimesters();
          toast({ title: 'Sucesso', description: 'Bimestre cadastrado com sucesso!' });
        }

        setIsModalOpen(false);
      } catch (err) {
        toast({
          title: 'Erro',
          description: 'Falha ao salvar bimestre.',
          variant: 'destructive',
        });
      }
    })();
  };

  const handleDelete = (bimester: Bimester) => {
    void (async () => {
      if (!window.confirm(`Deseja realmente excluir o bimestre "${bimester.name}"?`)) return;
      try {
        const { error } = await supabase.from('bimesters').delete().eq('id', bimester.id);
        if (error) throw error;
        setBimesters((prev) => prev.filter((b) => b.id !== bimester.id));
        toast({ title: 'Sucesso', description: 'Bimestre excluído com sucesso!' });
      } catch (err) {
        toast({
          title: 'Erro',
          description: 'Falha ao excluir bimestre.',
          variant: 'destructive',
        });
      }
    })();
  };

  const bimesterOptions = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'];

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <PageHeader
        title="Bimestres"
        subtitle="Gerencie os bimestres por disciplina"
        action={{ label: 'Adicionar Bimestre', onClick: () => handleOpenModal() }}
      />

      <DataTable
        data={bimesters}
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
              {editingBimester ? 'Editar Bimestre' : 'Adicionar Bimestre'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Bimestre
              </label>
              <select
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
              >
                <option value="">Selecione o bimestre</option>
                {bimesterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Disciplina
              </label>
              <select
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Data de Fim
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'closed' })}
                className="form-input"
              >
                <option value="active">Ativo</option>
                <option value="closed">Encerrado</option>
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
              <Button type="submit" className="btn-primary">
                {editingBimester ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BimestersPage;
