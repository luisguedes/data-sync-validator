import { Plus, Search, MoreHorizontal, FileText, Copy, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock data
const mockTemplates = [
  {
    id: '1',
    name: 'Migração Completa v2.1',
    description: 'Template completo para validação de migração de dados financeiros e operacionais',
    version: '2.1.0',
    sectionsCount: 5,
    itemsCount: 24,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Validação Financeira',
    description: 'Template focado em dados financeiros: saldos, movimentações, contas',
    version: '1.0.0',
    sectionsCount: 3,
    itemsCount: 12,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: '3',
    name: 'Conferência de Estoque',
    description: 'Validação de quantidades e valores de estoque por loja',
    version: '1.2.0',
    sectionsCount: 2,
    itemsCount: 8,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-12'),
  },
];

export default function Templates() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">
            Gerencie os modelos de checklist para conferências
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Importar JSON
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar templates..." className="pl-9" />
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {mockTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-secondary/10">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <Badge variant="outline">v{template.version}</Badge>
                  </div>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Editar</DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{template.sectionsCount}</span>
                  <span>seções</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{template.itemsCount}</span>
                  <span>itens</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Atualizado em</span>
                  <span className="font-medium text-foreground">
                    {template.updatedAt.toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
