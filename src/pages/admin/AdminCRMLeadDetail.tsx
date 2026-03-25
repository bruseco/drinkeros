import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  Mail,
  ExternalLink,
  MessageCircle,
  Plus,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CRMLead,
  CRM_STAGES,
  ALL_STAGES,
  useCRMLeadActivities,
  useCRMLeadTasks,
  useCreateCRMActivity,
  useCreateCRMTask,
  useToggleCRMTask,
  useUpdateCRMLead,
  useUpdateLeadStage,
} from '@/hooks/useCRMLeads';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface StageDefinition {
  key: string;
  label: string;
  color: string;
}

interface Props {
  lead: CRMLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages?: readonly StageDefinition[];
}

const activityIcons: Record<string, React.ReactNode> = {
  note: <FileText className="h-4 w-4 text-muted-foreground" />,
  stage_change: <ArrowRight className="h-4 w-4 text-blue-500" />,
  whatsapp_sent: <MessageCircle className="h-4 w-4 text-green-500" />,
  task: <CheckCircle2 className="h-4 w-4 text-primary" />,
};

export const AdminCRMLeadDetail: React.FC<Props> = ({ lead, open, onOpenChange, stages }) => {
  const activeStages = stages || CRM_STAGES;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const { data: activities = [] } = useCRMLeadActivities(lead?.id || null);
  const { data: tasks = [] } = useCRMLeadTasks(lead?.id || null);
  const createActivity = useCreateCRMActivity();
  const createTask = useCreateCRMTask();
  const toggleTask = useToggleCRMTask();
  const updateLead = useUpdateCRMLead();
  const updateStage = useUpdateLeadStage();

  if (!lead) return null;

  const currentStage = ALL_STAGES.find(s => s.key === lead.stage);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    createActivity.mutate({
      lead_id: lead.id,
      activity_type: 'note',
      description: noteText.trim(),
      created_by: user?.id,
    });
    setNoteText('');
  };

  const handleAddTask = () => {
    if (!taskTitle.trim() || !taskDueDate) return;
    createTask.mutate({
      lead_id: lead.id,
      title: taskTitle.trim(),
      due_date: new Date(taskDueDate).toISOString(),
      assigned_to: user?.id,
    });
    setTaskTitle('');
    setTaskDueDate('');
  };

  const handleStageChange = (newStage: string) => {
    updateStage.mutate(
      { id: lead.id, stage: newStage, userId: user?.id },
      { onSuccess: () => toast.success('Estágio atualizado com sucesso') }
    );
  };

  const handleMarkConverted = () => {
    updateStage.mutate(
      { id: lead.id, stage: 'convertido', userId: user?.id },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success('Lead marcado como Convertido!');
        },
      }
    );
  };

  const handleMarkLost = () => {
    updateStage.mutate(
      { id: lead.id, stage: 'perdido', userId: user?.id },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success('Lead marcado como Perdido');
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {lead.name}
          </SheetTitle>
          <div className="flex items-center gap-2">
            {currentStage && (
              <Badge className={`${currentStage.color} text-white`}>
                {currentStage.label}
              </Badge>
            )}
            {lead.stage === 'convertido' && (
              <Badge className="bg-green-500 text-white">Convertido</Badge>
            )}
            {lead.stage === 'perdido' && (
              <Badge variant="secondary">Perdido</Badge>
            )}
            {lead.source && (
              <Badge variant="outline">{lead.source}</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Contato</h4>
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{lead.phone}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/admin/whatsapp?phone=${lead.phone.replace(/\D/g, '')}&name=${encodeURIComponent(lead.name)}`);
                  }}
                >
                  <MessageCircle className="h-4 w-4 text-green-500" />
                </Button>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{lead.email}</span>
              </div>
            )}
            {lead.product_name && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Produto:</span>
                <span className="font-medium">{lead.product_name}</span>
              </div>
            )}
            {lead.sale_value && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-semibold text-green-600">
                  R$ {Number(lead.sale_value).toFixed(2)}
                </span>
              </div>
            )}
            {lead.recovery_url && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <a
                  href={lead.recovery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline truncate"
                >
                  Link de recuperação
                </a>
              </div>
            )}
          </div>

          <Separator />

          {/* Stage Change */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Mover Estágio</h4>
            <Select value={lead.stage} onValueChange={handleStageChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
              {activeStages.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={handleMarkConverted} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Convertido
              </Button>
              <Button size="sm" variant="secondary" onClick={handleMarkLost}>
                <XCircle className="h-4 w-4 mr-1" /> Perdido
              </Button>
            </div>
          </div>

          <Separator />

          {/* Tasks */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Tarefas</h4>
            {tasks.map(task => (
              <div key={task.id} className="flex items-start gap-2">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(checked) =>
                    toggleTask.mutate({ id: task.id, completed: !!checked })
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.due_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Nova tarefa..."
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                className="flex-1"
              />
              <Input
                type="datetime-local"
                value={taskDueDate}
                onChange={e => setTaskDueDate(e.target.value)}
                className="w-auto"
              />
              <Button size="icon" variant="outline" onClick={handleAddTask}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Add Note */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Adicionar Nota</h4>
            <div className="flex gap-2">
              <Textarea
                placeholder="Escreva uma nota..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button size="icon" variant="outline" onClick={handleAddNote} className="self-end">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Activity Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Timeline</h4>
            {activities.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
            )}
            <div className="space-y-3">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="mt-0.5">{activityIcons[a.activity_type] || activityIcons.note}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{a.description}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
