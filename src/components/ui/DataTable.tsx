import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

interface Column<T> {
  key: keyof T | 'actions';
  header: string;
  render?: (item: T) => React.ReactNode;
  // Quando true, a coluna some no mobile e aparece a partir de sm (>=640px).
  hideOnMobile?: boolean;
  // Classes extras para ajustar responsividade/estilo por coluna.
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  onEdit,
  onDelete,
  keyExtractor,
  isLoading = false,
}: DataTableProps<T>) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="table-header">
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={[
                    'font-semibold',
                    column.hideOnMobile ? 'hidden sm:table-cell' : '',
                    column.headerClassName ?? '',
                  ].filter(Boolean).join(' ')}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={keyExtractor(item)} className="table-row">
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={[
                        column.hideOnMobile ? 'hidden sm:table-cell' : '',
                        column.cellClassName ?? '',
                      ].filter(Boolean).join(' ')}
                    >
                      {column.key === 'actions' ? (
                        <div className="flex items-center gap-2">
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(item)}
                              className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil size={16} />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(item)}
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      ) : column.render ? (
                        column.render(item)
                      ) : (
                        String(item[column.key as keyof T] ?? '')
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
