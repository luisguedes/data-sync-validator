import { useState } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ImportTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (json: string) => { success: boolean; error?: string };
}

export function ImportTemplateModal({
  open,
  onOpenChange,
  onImport,
}: ImportTemplateModalProps) {
  const [jsonContent, setJsonContent] = useState('');
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonContent(content);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!jsonContent.trim()) {
      setResult({ success: false, error: 'Cole ou carregue um arquivo JSON' });
      return;
    }

    const importResult = onImport(jsonContent);
    setResult(importResult);

    if (importResult.success) {
      setTimeout(() => {
        setJsonContent('');
        setResult(null);
        onOpenChange(false);
      }, 1500);
    }
  };

  const handleClose = () => {
    setJsonContent('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Importar Template JSON
          </DialogTitle>
          <DialogDescription>
            Cole o conteúdo JSON ou faça upload de um arquivo .json com a estrutura do template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="flex items-center gap-4">
            <Label
              htmlFor="json-file"
              className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Carregar arquivo .json
            </Label>
            <input
              id="json-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* JSON Textarea */}
          <div className="space-y-2">
            <Label>Conteúdo JSON</Label>
            <Textarea
              value={jsonContent}
              onChange={(e) => {
                setJsonContent(e.target.value);
                setResult(null);
              }}
              placeholder={`{
  "name": "Meu Template",
  "description": "Descrição do template",
  "version": "1.0.0",
  "expected_inputs": [...],
  "sections": [...]
}`}
              className="font-mono text-sm min-h-[200px]"
            />
          </div>

          {/* Result Message */}
          {result && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                result.success
                  ? 'bg-status-completed/20 text-status-completed'
                  : 'bg-status-divergent/20 text-status-divergent'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="text-sm">
                {result.success ? 'Template importado com sucesso!' : result.error}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleImport}>Importar Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
