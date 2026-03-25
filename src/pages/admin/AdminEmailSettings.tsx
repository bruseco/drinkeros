import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Mail, FileText, ArrowLeft, Eye, Info } from 'lucide-react';
import {
  useEmailSettings,
  useUpdateEmailSettings,
  useEmailTemplates,
  useUpdateEmailTemplate,
  type EmailTemplate,
} from '@/hooks/useEmailSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const AdminEmailSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações de Email</h1>
        <p className="text-muted-foreground">Gerencie o remetente e os templates de email do sistema.</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <Mail className="h-4 w-4" />
            Remetente
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <EmailSettingsTab />
        </TabsContent>
        <TabsContent value="templates">
          <EmailTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ─── Settings Tab ─── */
const EmailSettingsTab: React.FC = () => {
  const { data: settings, isLoading } = useEmailSettings();
  const updateSettings = useUpdateEmailSettings();

  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');

  useEffect(() => {
    if (settings) {
      setSenderName(settings.sender_name);
      setSenderEmail(settings.sender_email);
      setReplyToEmail(settings.reply_to_email || '');
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      sender_name: senderName,
      sender_email: senderEmail,
      reply_to_email: replyToEmail || null,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Remetente</CardTitle>
        <CardDescription>
          Defina o nome e email que aparecerão como remetente nos emails enviados pelo sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="senderName">Nome do remetente</Label>
            <Input
              id="senderName"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Criminal Lab"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senderEmail">Email do remetente</Label>
            <Input
              id="senderEmail"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="noreply@seudominio.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="replyTo">Email de resposta (opcional)</Label>
          <Input
            id="replyTo"
            type="email"
            value={replyToEmail}
            onChange={(e) => setReplyToEmail(e.target.value)}
            placeholder="contato@seudominio.com"
          />
          <p className="text-xs text-muted-foreground">
            Se preenchido, as respostas dos alunos serão direcionadas para este email.
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            A chave da API de envio (Resend) está configurada de forma segura no backend e não é exibida aqui por segurança.
          </AlertDescription>
        </Alert>

        <Button onClick={handleSave} disabled={updateSettings.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {updateSettings.isPending ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </CardContent>
    </Card>
  );
};

/* ─── Templates Tab ─── */
const EmailTemplatesTab: React.FC = () => {
  const { data: templates, isLoading } = useEmailTemplates();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onBack={() => setEditingTemplate(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Clique em um template para editar o assunto e o conteúdo HTML do email.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {templates?.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer transition-colors hover:border-primary/50"
            onClick={() => setEditingTemplate(template)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {template.slug}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Assunto: <span className="text-foreground">{template.subject}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

/* ─── Template Editor ─── */
const TemplateEditor: React.FC<{
  template: EmailTemplate;
  onBack: () => void;
}> = ({ template, onBack }) => {
  const updateTemplate = useUpdateEmailTemplate();
  const [subject, setSubject] = useState(template.subject);
  const [htmlBody, setHtmlBody] = useState(template.html_body);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (previewRef.current && showPreview) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlBody);
        doc.close();
      }
    }
  }, [htmlBody, showPreview]);

  const handleSave = () => {
    updateTemplate.mutate(
      { id: template.id, subject, html_body: htmlBody },
      { onSuccess: () => onBack() }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{template.name}</h2>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto do email</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Variáveis disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {template.available_variables.map((v) => (
                <Badge key={v} variant="outline" className="font-mono text-xs">
                  {v}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Use essas variáveis no HTML e elas serão substituídas automaticamente ao enviar.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="htmlBody">Conteúdo HTML</Label>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-3 w-3" />
                {showPreview ? 'Ocultar preview' : 'Ver preview'}
              </Button>
            </div>
            <Textarea
              id="htmlBody"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              className="min-h-[300px] font-mono text-xs"
            />
          </div>

          {showPreview && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="overflow-hidden rounded-lg border border-border bg-white">
                <iframe
                  ref={previewRef}
                  title="Email Preview"
                  className="h-[500px] w-full"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={updateTemplate.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {updateTemplate.isPending ? 'Salvando...' : 'Salvar template'}
            </Button>
            <Button variant="outline" onClick={onBack}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailSettings;
