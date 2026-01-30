import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { FileText, Download, TrendingUp, Users, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';

export const ReportsPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    subjectsCount: 0,
    approvalRate: '-',
    averageGrade: '-',
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [studentsRes, subjectsRes, gradesRes] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase.from('grades').select('average,status'),
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (subjectsRes.error) throw subjectsRes.error;

        let approvalRate = '-';
        let averageGrade = '-';

        if (!gradesRes.error) {
          const grades = (gradesRes.data ?? []) as Array<{ average: number; status: 'approved' | 'recovery' | 'failed' }>;
          const totalGrades = grades.length;
          if (totalGrades > 0) {
            const approved = grades.reduce((acc, g) => acc + (g.status === 'approved' ? 1 : 0), 0);
            const avg = grades.reduce((acc, g) => acc + (g.average ?? 0), 0) / totalGrades;
            approvalRate = ((approved / totalGrades) * 100).toFixed(1);
            averageGrade = avg.toFixed(1);
          }
        }

        if (!cancelled) {
          setStats({
            totalStudents: studentsRes.count ?? 0,
            subjectsCount: subjectsRes.count ?? 0,
            approvalRate,
            averageGrade,
          });
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description: 'Falha ao carregar dados de relatórios. Verifique as variáveis do Supabase e as permissões (RLS).',
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

  const reports = [
    {
      id: 1,
      title: 'Relatório de Alunos Matriculados',
      description: 'Lista completa de todos os alunos com suas informações',
      icon: Users,
    },
    {
      id: 2,
      title: 'Relatório de Notas por Bimestre',
      description: 'Notas de todos os alunos separadas por bimestre',
      icon: FileText,
    },
    {
      id: 3,
      title: 'Relatório de Aprovação',
      description: 'Taxa de aprovação e reprovação por disciplina',
      icon: TrendingUp,
    },
    {
      id: 4,
      title: 'Relatório de Disciplinas',
      description: 'Lista de disciplinas com carga horária',
      icon: BookOpen,
    },
  ];

  const handleDownload = (reportId: number) => {
    // Simulate download
    const report = reports.find(r => r.id === reportId);
    alert(`Download do relatório "${report?.title}" iniciado!`);
  };

  return (
    <DashboardLayout allowedRoles={['secretary']}>
      <PageHeader
        title="Relatórios"
        subtitle="Gere e baixe relatórios do sistema"
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-primary">{stats.totalStudents}</p>
          <p className="text-sm text-muted-foreground">Alunos</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-success">{stats.approvalRate}%</p>
          <p className="text-sm text-muted-foreground">Aprovação</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-accent">{stats.averageGrade}</p>
          <p className="text-sm text-muted-foreground">Média Geral</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{stats.subjectsCount}</p>
          <p className="text-sm text-muted-foreground">Disciplinas</p>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <report.icon size={24} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">{report.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {report.description}
                </p>
                <Button
                  onClick={() => handleDownload(report.id)}
                  variant="outline"
                  className="gap-2"
                >
                  <Download size={16} />
                  Baixar PDF
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
