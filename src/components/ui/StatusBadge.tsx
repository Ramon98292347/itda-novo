import React from 'react';

interface StatusBadgeProps {
  status: 'approved' | 'recovery' | 'failed' | 'active' | 'closed';
}

const statusConfig = {
  approved: {
    label: 'Aprovado',
    className: 'badge-approved',
  },
  recovery: {
    label: 'Recuperação',
    className: 'badge-recovery',
  },
  failed: {
    label: 'Reprovado',
    className: 'badge-failed',
  },
  active: {
    label: 'Ativo',
    className: 'badge-approved',
  },
  closed: {
    label: 'Encerrado',
    className: 'bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-medium',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  
  return (
    <span className={config.className}>
      {config.label}
    </span>
  );
};
