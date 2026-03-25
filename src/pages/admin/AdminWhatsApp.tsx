import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  useConversations, useMessages, useSendMessage, useMarkAsRead,
  useUpdateAgentMode, useAgentSettings, useUpdateAgentSettings,
  useConnections, useUpdateConversationConnection,
  WhatsAppConversation
} from '@/hooks/useWhatsApp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle, Send, User, Phone, X, RotateCcw, Search, Bot, UserCheck, Settings, AlertTriangle, AlertCircle, ListOrdered, Plug, Image, Volume2, Video, FileText, Link2, GraduationCap, BookOpen, Package, Calendar, Pencil, Save, Plus, Loader2, ExternalLink, DollarSign, ShoppingCart, Mic } from 'lucide-react';
import { CRM_STAGES, PICO_VENDAS_STAGES, ATENDIMENTO_STAGES, ALL_STAGES, CLOSED_STAGES, type CRMLead } from '@/hooks/useCRMLeads';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import OnboardingBatchSheet from '@/components/admin/OnboardingBatchSheet';
import { useUpdateUserProfile, useUpdateUserAccess } from '@/hooks/useAdminUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useCombos } from '@/hooks/useCombos';
import { useCourses } from '@/hooks/useCourses';
import { usePackages } from '@/hooks/usePackages';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const getProxiedUrl = (url: string) => {
  const needsProxy = ['waba-v1.era.com.br', 'lookaside.fbcdn.net', 'scontent.whatsapp.net', 'mmg.whatsapp.net']
    .some(host => url.includes(host));
  if (!needsProxy) return url;
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  if (!supabaseUrl) return url;
  return `${supabaseUrl}/functions/v1/media-proxy?url=${encodeURIComponent(url)}`;
};

const ImageWithFallback: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [failed, setFailed] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const proxiedSrc = getProxiedUrl(src);
  if (failed) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-sm">
        <Image className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="text-primary underline truncate">Abrir imagem</span>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
      </a>
    );
  }
  return (
    <>
      <img src={proxiedSrc} alt={alt} className={cn(className, "cursor-pointer hover:opacity-90 transition-opacity")} onClick={() => setLightboxOpen(true)} onError={() => setFailed(true)} />
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          <img src={proxiedSrc} alt={alt} className="w-full h-full object-contain max-h-[85vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
};

const WindowCountdown: React.FC<{ lastInboundAt: string | null }> = ({ lastInboundAt }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!lastInboundAt) {
    return <Badge variant="destructive" className="text-[10px]">Janela fechada</Badge>;
  }

  const expiresAt = new Date(new Date(lastInboundAt).getTime() + 24 * 60 * 60 * 1000);
  const remainingMs = expiresAt.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return <Badge variant="destructive" className="text-[10px]">Janela fechada</Badge>;
  }

  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);

  return (
    <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">
      Janela: {hours}h {minutes}min
    </Badge>
  );
};

const MemoizedWindowCountdown: React.FC<{ messages: any[] }> = React.memo(({ messages }) => {
  const lastInboundAt = useMemo(() => {
    return messages?.filter((m: any) => m.direction === 'inbound').at(-1)?.created_at ?? null;
  }, [messages]);
  return <WindowCountdown lastInboundAt={lastInboundAt} />;
});

const MessageContent: React.FC<{ msg: any; templates?: { name: string; components: any; status: string }[] }> = ({ msg, templates }) => {
  const meta = msg.metadata && typeof msg.metadata === 'object' ? msg.metadata : {};
  const isOutbound = msg.direction === 'outbound';

  if (msg.message_type === 'image' && msg.content) {
    return (
      <div className="space-y-1">
        <ImageWithFallback src={msg.content} alt="Imagem" className="max-w-full rounded-md max-h-80 object-cover" />
        {meta.ai_description && (
          <p className={cn('text-[11px] italic', isOutbound ? 'text-green-200' : 'text-muted-foreground')}>
            <Image className="h-3 w-3 inline mr-1" />
            {meta.ai_description}
          </p>
        )}
      </div>
    );
  }

  if (msg.message_type === 'sticker' && msg.content) {
    return (
      <div className="space-y-1">
        <ImageWithFallback src={msg.content} alt="Figurinha" className="max-w-[180px] rounded-md" />
        {meta.ai_description && (
          <p className={cn('text-[11px] italic', isOutbound ? 'text-green-200' : 'text-muted-foreground')}>
            <Image className="h-3 w-3 inline mr-1" />
            {meta.ai_description}
          </p>
        )}
      </div>
    );
  }

  if (msg.message_type === 'audio' && msg.content) {
    return (
      <div className="space-y-1">
        <audio controls className="max-w-full" preload="none">
          <source src={getProxiedUrl(msg.content)} />
        </audio>
        {meta.ai_transcription && (
          <p className={cn('text-[11px] italic', isOutbound ? 'text-green-200' : 'text-muted-foreground')}>
            <Volume2 className="h-3 w-3 inline mr-1" />
            {meta.ai_transcription}
          </p>
        )}
      </div>
    );
  }

  if (msg.message_type === 'video' && msg.content) {
    return (
      <div className="space-y-1">
        <video controls className="max-w-full rounded-md max-h-60" preload="none">
          <source src={getProxiedUrl(msg.content)} />
        </video>
      </div>
    );
  }

  if (msg.message_type === 'document' && msg.content) {
    return (
      <div className="space-y-1">
        <a
          href={getProxiedUrl(msg.content)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('flex items-center gap-2 underline text-sm', isOutbound ? 'text-green-100' : 'text-primary')}
        >
          <FileText className="h-4 w-4" />
          Abrir documento
        </a>
      </div>
    );
  }

  // Template message rendering
  if (msg.message_type === 'template' || (msg.content && msg.content.startsWith('[Template'))) {
    const templateBody = meta.template_body;
    const templateHeader = meta.template_header;
    const templateName = meta.template_name;

    if (templateBody) {
      // New format: rendered template body from metadata
      return (
        <div className="space-y-1">
          <div className={cn(
            'flex items-center gap-1 text-[10px] font-medium mb-1',
            isOutbound ? 'text-green-200' : 'text-muted-foreground'
          )}>
            <FileText className="h-3 w-3" />
            <span>Template</span>
            {templateName && (
              <span className="opacity-70">· {templateName}</span>
            )}
          </div>
          {templateHeader && (
            <p className="font-semibold text-xs">{templateHeader}</p>
          )}
          <p className="whitespace-pre-wrap break-words">{templateBody}</p>
        </div>
      );
    }

    // Fallback: parse old [Template name] param1, param2 format
    const match = msg.content?.match(/^\[Template:?\s+([^\]]+)\]\s*(.*)?$/s);
    if (match) {
      const tplName = match[1].trim();
      const params = match[2] || '';

      // Try to resolve body from approved templates list
      const tplData = templates?.find(t => t.name === tplName);
      if (tplData?.components && Array.isArray(tplData.components)) {
        const bodyComp = (tplData.components as any[]).find((c: any) => c.type === 'BODY');
        const headerComp = (tplData.components as any[]).find((c: any) => c.type === 'HEADER');
        if (bodyComp?.text) {
          let resolved = bodyComp.text as string;
          // Replace variables with params extracted from content
          const paramList = params.split(',').map((s: string) => s.trim()).filter(Boolean);
          paramList.forEach((p: string, i: number) => {
            resolved = resolved.replace(`{{${i + 1}}}`, p);
          });
          return (
            <div className="space-y-1">
              <div className={cn(
                'flex items-center gap-1 text-[10px] font-medium mb-1',
                isOutbound ? 'text-green-200' : 'text-muted-foreground'
              )}>
                <FileText className="h-3 w-3" />
                <span>Template</span>
                <span className="opacity-70">· {tplName}</span>
              </div>
              {headerComp?.text && (
                <p className="font-semibold text-xs">{headerComp.text}</p>
              )}
              <p className="whitespace-pre-wrap break-words">{resolved}</p>
            </div>
          );
        }
      }

      return (
        <div className="space-y-1">
          <div className={cn(
            'flex items-center gap-1 text-[10px] font-medium mb-1',
            isOutbound ? 'text-green-200' : 'text-muted-foreground'
          )}>
            <FileText className="h-3 w-3" />
            <span>Template</span>
          </div>
          <p className={cn(
            'text-xs font-mono',
            isOutbound ? 'text-green-100' : 'text-muted-foreground'
          )}>{tplName}</p>
          {params && <p className="whitespace-pre-wrap break-words">{params}</p>}
        </div>
      );
    }
  }

  return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
};

const AdminWhatsApp: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'ai' | 'human'>('all');
  const [search, setSearch] = useState('');
  const [activeConv, setActiveConv] = useState<WhatsAppConversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; components: any; varCount: number; bodyText: string } | null>(null);
  const [templateVarValues, setTemplateVarValues] = useState<string[]>([]);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [convLimit, setConvLimit] = useState(50);
  const [msgLimit, setMsgLimit] = useState(100);
  const debouncedSearch = useDebounce(search, 300);
  const { conversations, count: convCount, isLoading: loadingConvs } = useConversations(filter, debouncedSearch, convLimit);
  const { data: messages = [], isLoading: loadingMsgs } = useMessages(activeConv?.id || null);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const updateAgentMode = useUpdateAgentMode();
  const { data: connections = [] } = useConnections();
  const updateConnection = useUpdateConversationConnection();
  // Reset convLimit when filter/search changes
  useEffect(() => {
    setConvLimit(50);
  }, [filter, debouncedSearch]);

  // Reset msgLimit when conversation changes
  useEffect(() => {
    setMsgLimit(100);
  }, [activeConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeConv && activeConv.unread_count > 0) {
      markAsRead(activeConv.id);
    }
  }, [activeConv?.id]);

  // Keep activeConv in sync with conversations data (stable ref to avoid loops)
  const activeConvIdRef = useRef(activeConv?.id);
  activeConvIdRef.current = activeConv?.id;
  useEffect(() => {
    if (!activeConvIdRef.current) return;
    const updated = conversations.find(c => c.id === activeConvIdRef.current);
    if (updated && JSON.stringify(updated) !== JSON.stringify(activeConv)) {
      setActiveConv(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // Auto-select conversation from ?phone= URL param
  const phoneParam = searchParams.get('phone');
  const nameParam = searchParams.get('name');
  const lastHandledPhoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!phoneParam || loadingConvs) return;
    if (lastHandledPhoneRef.current === phoneParam) return;

    const normalized = phoneParam.replace(/\D/g, '');

    // 1. Try local match first (fast, within loaded conversations)
    const match = conversations.find(c => {
      const cDigits = c.phone.replace(/\D/g, '');
      return cDigits.endsWith(normalized) || normalized.endsWith(cDigits);
    });

    if (match) {
      setActiveConv(match);
      setPendingPhone(null);
      lastHandledPhoneRef.current = phoneParam;
      setSearchParams({}, { replace: true });
      return;
    }

    // 2. Fallback: search backend directly (handles 7k+ conversations)
    const searchBackend = async () => {
      const last10 = normalized.slice(-10);
      const variants = [normalized, `+${normalized}`];
      if (normalized.startsWith('55')) variants.push(`+${normalized}`, normalized.slice(2));
      if (!normalized.startsWith('55')) variants.push(`55${normalized}`, `+55${normalized}`);

      const { data, error } = await (supabase.from as any)('whatsapp_conversations')
        .select('*')
        .or(variants.map(v => `phone.ilike.%${last10}%`).slice(0, 1).join(','))
        .order('last_message_at', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) {
        setPendingPhone(normalized);
        setActiveConv(null);
        lastHandledPhoneRef.current = phoneParam;
        setSearchParams({}, { replace: true });
        return;
      }

      // Find best match by comparing digits
      const bestMatch = data.find((c: any) => {
        const cDigits = c.phone.replace(/\D/g, '');
        return cDigits.endsWith(normalized) || normalized.endsWith(cDigits);
      }) || data[0];

      setActiveConv(bestMatch as WhatsAppConversation);
      setPendingPhone(null);
      lastHandledPhoneRef.current = phoneParam;
      setSearchParams({}, { replace: true });
    };

    searchBackend();
  }, [phoneParam, conversations, loadingConvs]);

  const [invokingAI, setInvokingAI] = useState(false);

  // Calculate window closed state
  const isWindowClosed = useMemo(() => {
    if (!activeConv || messages.length === 0) return true;
    const lastInbound = messages.filter((m: any) => m.direction === 'inbound').at(-1);
    if (!lastInbound) return true;
    const expiresAt = new Date(new Date(lastInbound.created_at).getTime() + 24 * 60 * 60 * 1000);
    return expiresAt.getTime() <= Date.now();
  }, [activeConv, messages]);

  // Z-API connections bypass the 24h window restriction
  const isUsingZapi = useMemo(() => {
    if (!activeConv?.zapi_connection_id) return false;
    const conn = connections.find(c => c.id === activeConv.zapi_connection_id);
    return conn ? conn.provider !== 'era_cloud' : false;
  }, [activeConv, connections]);

  const effectiveWindowClosed = isWindowClosed && !isUsingZapi;
  // Template autocomplete query
  const { data: approvedTemplates = [] } = useQuery({
    queryKey: ['whatsapp-templates-approved'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('whatsapp_templates')
        .select('name, components, status, connection_id')
        .eq('status', 'APPROVED')
        .order('name');
      if (error) throw error;
      return data as { name: string; components: any; status: string; connection_id: string }[];
    },
  });

  const templateSearchTerm = messageText.startsWith('/') ? messageText.slice(1).split('|')[0].toLowerCase() : '';
  const filteredTemplates = useMemo(() => {
    if (!showTemplateDropdown) return [];
    return approvedTemplates.filter(t => t.name.toLowerCase().includes(templateSearchTerm));
  }, [showTemplateDropdown, approvedTemplates, templateSearchTerm]);

  const getTemplateBody = (components: any): string => {
    if (!Array.isArray(components)) return '';
    const body = components.find((c: any) => c.type === 'BODY');
    return body?.text || '';
  };

  const extractTemplateVars = (components: any): { varCount: number; bodyText: string } => {
    const bodyText = getTemplateBody(components);
    const matches = bodyText.match(/\{\{(\d+)\}\}/g);
    const varCount = matches ? new Set(matches).size : 0;
    return { varCount, bodyText };
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    // When window is closed, only allow typing if it starts with /
    if (effectiveWindowClosed && !val.startsWith('/') && val !== '') return;
    setMessageText(val);
    setShowTemplateDropdown(val.startsWith('/'));
  };

  // Auto-resize textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 6;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [messageText]);

  // Media upload states
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);
      return publicUrl;
    } catch (error: any) {
      toast.error(`Erro no upload: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    e.target.value = '';
    const previewUrl = URL.createObjectURL(file);
    setImagePreview({ file, url: previewUrl });
  };

  const handleImageConfirm = async () => {
    if (!imagePreview || !activeConv) return;
    const url = await uploadFile(imagePreview.file);
    URL.revokeObjectURL(imagePreview.url);
    setImagePreview(null);
    if (!url) return;
    sendMessage.mutate({
      phone: activeConv.phone,
      conversationId: activeConv.id,
      mediaUrl: url,
      mediaType: 'image',
    });
  };

  const handleImageCancel = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    setImagePreview(null);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    e.target.value = '';
    const url = await uploadFile(file);
    if (!url) return;
    sendMessage.mutate({
      phone: activeConv.phone,
      conversationId: activeConv.id,
      mediaUrl: url,
      mediaType: 'document',
      fileName: file.name,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
        if (!activeConv) return;
        const url = await uploadFile(file);
        if (!url) return;
        sendMessage.mutate({
          phone: activeConv.phone,
          conversationId: activeConv.id,
          mediaUrl: url,
          mediaType: 'audio',
        });
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
  };

  const handleTemplateSelect = (templateName: string, prefillValues?: string[]) => {
    const tpl = approvedTemplates.find(t => t.name === templateName);
    if (!tpl) return;
    const { varCount, bodyText } = extractTemplateVars(tpl.components);
    setShowTemplateDropdown(false);
    setMessageText('');

    if (varCount === 0) {
      // No variables, send directly
      if (!activeConv) return;
      sendMessage.mutate({
        phone: activeConv.phone,
        conversationId: activeConv.id,
        template: templateName,
      });
    } else {
      // Has variables, open inline form
      setSelectedTemplate({ name: templateName, components: tpl.components, varCount, bodyText });
      setTemplateVarValues(prefillValues || new Array(varCount).fill(''));
    }
  };

  const handleReopenConversation = () => {
    const contactName = activeConv?.contact_name || activeConv?.phone || '';
    const operatorName = profile?.full_name || 'Operador';
    handleTemplateSelect('reabertura_atendimento', [contactName, operatorName]);
  };

  const handleTemplateSend = () => {
    if (!selectedTemplate || !activeConv) return;
    const allFilled = templateVarValues.every(v => v.trim() !== '');
    if (!allFilled) return;

    sendMessage.mutate({
      phone: activeConv.phone,
      conversationId: activeConv.id,
      template: selectedTemplate.name,
      templateParams: templateVarValues.map(v => v.trim()),
    });
    setSelectedTemplate(null);
    setTemplateVarValues([]);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !activeConv) return;
    const text = messageText.trim();

    // Block free text when window is closed
    if (effectiveWindowClosed && !text.toLowerCase().startsWith('@ia')) {
      toast.error('Janela de 24h fechada. Use um template para enviar.');
      return;
    }

    // Detectar comando @ia
    if (text.toLowerCase().startsWith('@ia')) {
      const instruction = text.slice(3).trim();
      setMessageText('');
      setInvokingAI(true);
      toast.info('Acionando IA...');

      try {
        await supabase.functions.invoke('whatsapp-agent', {
          body: {
            conversationId: activeConv.id,
            forceInvoke: true,
            adminInstruction: instruction || undefined,
          },
        });
        toast.success('IA acionada com sucesso');
      } catch (err) {
        toast.error('Erro ao acionar IA');
      } finally {
        setInvokingAI(false);
      }
      return;
    }

    setMessageText('');
    sendMessage.mutate({
      phone: activeConv.phone,
      message: text,
      conversationId: activeConv.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleConvStatus = async () => {
    if (!activeConv) return;
    const newStatus = activeConv.status === 'open' ? 'closed' : 'open';
    await (supabase.from as any)('whatsapp_conversations')
      .update({ status: newStatus })
      .eq('id', activeConv.id);
    setActiveConv({ ...activeConv, status: newStatus });
  };

  const formatTime = (dateStr: string) => {
    try { return format(new Date(dateStr), 'HH:mm', { locale: ptBR }); } catch { return ''; }
  };

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return ''; }
  };

  const statusIcon = (status: string, metadata?: any) => {
    if (status === 'failed') {
      const errorMsg = metadata?.error_title || metadata?.error_message || 'Erro no envio';
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-red-400 flex items-center gap-0.5 cursor-help">
              <AlertCircle className="h-3 w-3" /> Erro
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">{errorMsg}</TooltipContent>
        </Tooltip>
      );
    }
    if (status === 'sending') return <span className="text-muted-foreground flex items-center gap-0.5"><Loader2 className="h-3 w-3 animate-spin" /> Enviando</span>;
    if (status === 'read') return <span className="text-blue-400">Lida ✓✓</span>;
    if (status === 'delivered') return <span>Entregue ✓✓</span>;
    if (status === 'sent') return <span>Enviada ✓</span>;
    return <span>⏳</span>;
  };

  const agentModeBadge = (mode: string, escalationReason?: string | null) => {
    if (mode === 'ai') return <Badge className="bg-emerald-600 text-white text-[10px]"><Bot className="h-3 w-3 mr-0.5" />IA</Badge>;
    if (mode === 'human') return (
      <Badge className="bg-orange-500 text-white text-[10px]" title={escalationReason || undefined}>
        <UserCheck className="h-3 w-3 mr-0.5" />Humano
      </Badge>
    );
    return <Badge variant="secondary" className="text-[10px]">Pausado</Badge>;
  };

  const isAiMessage = (msg: any) => msg.direction === 'outbound' && msg.metadata?.source === 'ai_agent';

  return (
    <TooltipProvider>
    <div className="flex h-[calc(100vh-4rem)] bg-background rounded-lg border overflow-hidden">
      {/* Left: Conversation List */}
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold text-foreground">WhatsApp</h2>
            </div>
            <div className="flex items-center gap-0">
              <Link to="/admin/whatsapp/fila">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Fila de envio">
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/admin/whatsapp/conexoes">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Conexões">
                  <Plug className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/admin/whatsapp/modelos">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Modelos">
                  <FileText className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/admin/whatsapp/associacoes">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Associações">
                  <Link2 className="h-4 w-4" />
                </Button>
              </Link>
              <OnboardingBatchSheet />
              <AgentConfigSheet />
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="w-full h-auto p-1 justify-start overflow-x-auto flex-nowrap">
              <TabsTrigger value="all" className="text-[11px] px-2.5 py-1.5 whitespace-nowrap shrink-0">Todas</TabsTrigger>
              <TabsTrigger value="unanswered" className="text-[11px] px-2.5 py-1.5 whitespace-nowrap shrink-0">S/ Resposta</TabsTrigger>
              <TabsTrigger value="open" className="text-[11px] px-2.5 py-1.5 whitespace-nowrap shrink-0">Abertas</TabsTrigger>
              <TabsTrigger value="closed" className="text-[11px] px-2.5 py-1.5 whitespace-nowrap shrink-0">Fechadas</TabsTrigger>
              <TabsTrigger value="ai" className="text-[11px] px-2.5 py-1.5 whitespace-nowrap shrink-0">IA</TabsTrigger>
              <TabsTrigger value="human" className="text-[11px] px-2.5 py-1.5 whitespace-nowrap shrink-0">Humano</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          {loadingConvs ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Nenhuma conversa</div>
          ) : (
            <>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={cn(
                    'w-full text-left p-3 border-b hover:bg-accent/50 transition-colors',
                    activeConv?.id === conv.id && 'bg-accent',
                    conv.agent_mode === 'human' && conv.escalated_at && 'border-l-2 border-l-orange-500'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {conv.profile_id && <User className="h-3 w-3 text-primary flex-shrink-0" />}
                        <span className="font-medium text-sm truncate text-foreground">
                          {conv.contact_name || conv.phone}
                        </span>
                        {agentModeBadge(conv.agent_mode)}
                        {(() => {
                          const conn = connections.find(c => c.id === conv.zapi_connection_id);
                          if (!conn) return null;
                          return (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-dashed">
                              {conn.provider === 'era_cloud' ? '☁' : '⚡'} {conn.phone_number.slice(-4)}
                            </Badge>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.last_message_preview || 'Sem mensagens'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                      </span>
                      {conv.unread_count > 0 && (
                        <Badge className="bg-green-600 text-white text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full px-1.5">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {convCount !== null && convCount > conversations.length && (
                <div className="p-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs w-full"
                    onClick={() => setConvLimit(prev => prev + 50)}
                  >
                    Mostrar mais {Math.min(convCount - conversations.length, 50)} de {convCount - conversations.length} restantes
                  </Button>
                </div>
              )}
              {convCount !== null && (
                <div className="px-3 py-1 text-center text-[10px] text-muted-foreground">
                  {conversations.length} de {convCount} conversas
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </div>

      {/* Right: Chat */}
      <div className="flex-1 flex flex-col">
        {!activeConv && !pendingPhone ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <p>Selecione uma conversa</p>
            </div>
          </div>
        ) : !activeConv && pendingPhone ? (
          <NewConversationPanel
            phone={pendingPhone}
            contactName={nameParam || ''}
            connections={connections}
            approvedTemplates={approvedTemplates}
            extractTemplateVars={extractTemplateVars}
            getTemplateBody={getTemplateBody}
            sendMessage={sendMessage}
            connectionId={pendingConnectionId}
            onConnectionChange={setPendingConnectionId}
            onSent={() => {
              setPendingPhone(null);
            }}
            operatorName={profile?.full_name || 'Operador'}
          />
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-600/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">
                    {activeConv.contact_name || activeConv.phone}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{activeConv.phone}</span>
                    <Badge variant={activeConv.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                      {activeConv.status === 'open' ? 'Aberta' : 'Fechada'}
                    </Badge>
                    {agentModeBadge(activeConv.agent_mode, activeConv.escalation_reason)}
                    {!isUsingZapi && <MemoizedWindowCountdown messages={messages} />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {activeConv.escalation_reason && (
                      <div className="flex items-center gap-1 text-[10px] text-orange-500">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{activeConv.escalation_reason}</span>
                      </div>
                    )}
                    <Select
                      value={activeConv.zapi_connection_id || 'auto'}
                      onValueChange={(val) => {
                        const newId = val === 'auto' ? null : val;
                        updateConnection.mutate({ conversationId: activeConv.id, connectionId: newId });
                        setActiveConv({ ...activeConv, zapi_connection_id: newId });
                      }}
                    >
                      <SelectTrigger className="h-6 w-auto min-w-[140px] text-[10px] gap-1 px-2 py-0 border-dashed">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        <SelectValue placeholder="Conexão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto" className="text-xs">
                          Auto (roteamento automático)
                        </SelectItem>
                        {connections.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id} className="text-xs">
                            <span className="flex items-center gap-1.5">
                              {conn.name}
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                {conn.provider === 'era_cloud' ? 'Cloud' : 'Z-API'}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <LeadStageBadge phone={activeConv.phone} />
                {activeConv.profile_id ? (
                  <UserProfileSheet profileId={activeConv.profile_id} />
                ) : (
                  <LeadProfileSheet phone={activeConv.phone} />
                )}
                {activeConv.agent_mode === 'ai' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => updateAgentMode.mutate({ conversationId: activeConv.id, agentMode: 'human' })}
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Assumir
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => updateAgentMode.mutate({ conversationId: activeConv.id, agentMode: 'ai' })}
                  >
                    <Bot className="h-3.5 w-3.5 mr-1" /> Devolver p/ IA
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={toggleConvStatus}>
                  {activeConv.status === 'open' ? (
                    <><X className="h-4 w-4 mr-1" /> Fechar</>
                  ) : (
                    <><RotateCcw className="h-4 w-4 mr-1" /> Reabrir</>
                  )}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2 max-w-2xl mx-auto">
                {loadingMsgs ? (
                  <div className="text-center text-muted-foreground text-sm">Carregando mensagens...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm">Nenhuma mensagem</div>
                ) : (
                  <>
                    {messages.length > msgLimit && (
                      <div className="text-center mb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setMsgLimit(prev => prev + 100)}
                        >
                          Carregar {Math.min(messages.length - msgLimit, 100)} mensagens anteriores
                        </Button>
                      </div>
                    )}
                    {messages.slice(-msgLimit).map((msg, i, visibleMsgs) => {
                      const showDate = i === 0 || formatDate(msg.created_at) !== formatDate(visibleMsgs[i - 1].created_at);
                      const isAi = isAiMessage(msg);
                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && (
                            <div className="flex justify-center my-3">
                              <span className="bg-muted text-muted-foreground text-[11px] px-3 py-1 rounded-full">
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                          )}
                          <div className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                            <div
                              className={cn(
                                'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                                msg.direction === 'outbound'
                                  ? msg.status === 'failed'
                                    ? 'bg-red-900/30 border border-red-500/50 text-white rounded-br-none'
                                    : isAi
                                      ? 'bg-emerald-700 text-white rounded-br-none'
                                      : 'bg-green-600 text-white rounded-br-none'
                                  : 'bg-muted text-foreground rounded-bl-none'
                              )}
                            >
                              {isAi && (
                                <div className="flex items-center gap-1 text-[10px] text-emerald-200 mb-1">
                                  <Bot className="h-3 w-3" /> Agente IA
                                </div>
                              )}
                              <MessageContent msg={msg} templates={approvedTemplates} />
                              <div className={cn(
                                'flex items-center justify-end gap-1 mt-1',
                                msg.direction === 'outbound' ? 'text-green-200' : 'text-muted-foreground'
                              )}>
                                <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                                {msg.direction === 'outbound' && (
                                  <span className="text-[10px] flex items-center">{statusIcon(msg.status, msg.metadata as any)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Template Form */}
            {selectedTemplate && (
              <div className="px-3 pt-3 pb-1 border-t bg-card">
                <div className="max-w-2xl mx-auto p-3 rounded-lg border bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm text-foreground">{selectedTemplate.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedTemplate(null); setTemplateVarValues([]); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-background rounded p-2 border">
                    {selectedTemplate.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => `【${n}】`)}
                  </p>
                  <div className="grid gap-2">
                    {templateVarValues.map((val, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap min-w-[80px]">Parâmetro {i + 1}</Label>
                        <Input
                          value={val}
                          onChange={(e) => {
                            const next = [...templateVarValues];
                            next[i] = e.target.value;
                            setTemplateVarValues(next);
                          }}
                          placeholder={`Valor para {{${i + 1}}}`}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleTemplateSend}
                    disabled={!templateVarValues.every(v => v.trim() !== '') || sendMessage.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Enviar Template
                  </Button>
                </div>
              </div>
            )}

            {/* Image Preview Bar */}
            {imagePreview && (
              <div className="px-3 pt-3 pb-1 border-t bg-card">
                <div className="flex items-end gap-3 max-w-2xl mx-auto p-2 rounded-lg border bg-muted/50">
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleImageCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                  <img src={imagePreview.url} alt="Preview" className="max-h-40 rounded-md object-contain flex-1 min-w-0" />
                  <Button size="icon" className="h-8 w-8 shrink-0 bg-green-600 hover:bg-green-700 text-white" onClick={handleImageConfirm} disabled={isUploading || sendMessage.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Closed Window Banner */}
            {effectiveWindowClosed && !selectedTemplate && (
              <div className="px-3 pt-3 pb-1 border-t bg-card">
                <div className="max-w-2xl mx-auto flex items-center gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-50 dark:bg-orange-950/20">
                  <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                  <p className="text-sm text-orange-700 dark:text-orange-300 flex-1">
                    Janela de 24h fechada. Use <code className="font-mono text-xs bg-orange-100 dark:bg-orange-900/30 px-1 rounded">/template</code> ou clique em Reabrir conversa.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-orange-500 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    onClick={handleReopenConversation}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Reabrir conversa
                  </Button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t bg-card relative">
              {/* Template autocomplete dropdown */}
              {showTemplateDropdown && filteredTemplates.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 mb-1 max-h-60 overflow-y-auto bg-popover border rounded-md shadow-lg z-50">
                  {filteredTemplates.map((tpl) => {
                    const body = getTemplateBody(tpl.components);
                    return (
                      <button
                        key={tpl.name}
                        className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b last:border-b-0"
                        onClick={() => handleTemplateSelect(tpl.name)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm text-foreground">{tpl.name}</span>
                        </div>
                        {body && (
                          <p className="text-xs text-muted-foreground mt-0.5 pl-5 line-clamp-2">{body}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} />
              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.csv,.pptx" className="hidden" onChange={handleDocUpload} />
              <div className="flex gap-2 max-w-2xl mx-auto items-end">
                {isRecording ? (
                  <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-md border border-red-500 bg-red-50 dark:bg-red-950/30">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-red-600 dark:text-red-400">Gravando áudio...</span>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="sm" onClick={cancelRecording} className="h-7 px-2 text-red-600">
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={stopRecording} className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Textarea
                    ref={textareaRef}
                    placeholder={effectiveWindowClosed ? "Janela fechada — use /template para enviar" : "Digite uma mensagem... (@ia para IA, / para templates)"}
                    value={messageText}
                    onChange={handleMessageChange}
                    onKeyDown={handleKeyDown}
                    className="flex-1 min-h-[40px] max-h-[120px] resize-none py-2"
                    rows={1}
                    disabled={sendMessage.isPending || isUploading}
                  />
                )}
                {!isRecording && (
                  <>
                    <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={() => imageInputRef.current?.click()} disabled={sendMessage.isPending || isUploading || effectiveWindowClosed}>
                      <Image className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={() => docInputRef.current?.click()} disabled={sendMessage.isPending || isUploading || effectiveWindowClosed}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={startRecording} disabled={sendMessage.isPending || isUploading || effectiveWindowClosed}>
                      <Mic className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {!isRecording && (
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sendMessage.isPending || isUploading}
                    className="bg-green-600 hover:bg-green-700 shrink-0"
                  >
                    {(sendMessage.isPending || isUploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
};

// New Conversation Panel — shown when ?phone= has no existing conversation
const NewConversationPanel: React.FC<{
  phone: string;
  contactName: string;
  connections: { id: string; name: string; phone_number: string; provider: string; is_active: boolean; connection_status: string }[];
  approvedTemplates: { name: string; components: any; status: string; connection_id: string }[];
  extractTemplateVars: (components: any) => { varCount: number; bodyText: string };
  getTemplateBody: (components: any) => string;
  sendMessage: any;
  connectionId: string | null;
  onConnectionChange: (id: string | null) => void;
  onSent: () => void;
  operatorName: string;
}> = ({ phone, contactName, connections, approvedTemplates, extractTemplateVars, getTemplateBody, sendMessage, connectionId, onConnectionChange, onSent, operatorName }) => {
  // Filter templates by selected connection
  const templatesForConnection = useMemo(() => {
    if (!connectionId) return approvedTemplates;
    return approvedTemplates.filter(t => t.connection_id === connectionId);
  }, [approvedTemplates, connectionId]);

  const [selectedTemplateName, setSelectedTemplateName] = useState('reabertura_atendimento');
  const [varValues, setVarValues] = useState<string[]>([]);

  // Reset template selection when connection changes and current template is not available
  useEffect(() => {
    if (templatesForConnection.length > 0 && !templatesForConnection.find(t => t.name === selectedTemplateName)) {
      const reabertura = templatesForConnection.find(t => t.name === 'reabertura_atendimento');
      setSelectedTemplateName(reabertura ? reabertura.name : templatesForConnection[0].name);
    }
  }, [templatesForConnection, selectedTemplateName]);

  const selectedTpl = templatesForConnection.find(t => t.name === selectedTemplateName);
  const { varCount, bodyText } = selectedTpl ? extractTemplateVars(selectedTpl.components) : { varCount: 0, bodyText: '' };

  // Pre-fill variables when template changes
  useEffect(() => {
    if (selectedTemplateName === 'reabertura_atendimento') {
      setVarValues([contactName || '', operatorName || '']);
    } else {
      setVarValues(new Array(varCount).fill(''));
    }
  }, [selectedTemplateName, varCount, contactName, operatorName]);

  const previewText = useMemo(() => {
    let text = bodyText;
    varValues.forEach((v, i) => {
      text = text.replace(`{{${i + 1}}}`, v || `{{${i + 1}}}`);
    });
    return text;
  }, [bodyText, varValues]);

  const handleSend = () => {
    const allFilled = varValues.every(v => v.trim() !== '');
    if (varCount > 0 && !allFilled) {
      toast.error('Preencha todas as variáveis do template');
      return;
    }

    sendMessage.mutate(
      {
        phone,
        template: selectedTemplateName,
        templateParams: varCount > 0 ? varValues.map(v => v.trim()) : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Template enviado! Conversa criada.');
          onSent();
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-600/10 flex items-center justify-center">
            <Phone className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Nova conversa</h3>
            <p className="text-sm text-muted-foreground">{phone}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Nenhuma conversa encontrada para este número. Envie um template para iniciar.
            </p>
          </div>

          {/* Connection selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Conexão</Label>
            <Select value={connectionId || 'auto'} onValueChange={(val) => onConnectionChange(val === 'auto' ? null : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conexão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (roteamento automático)</SelectItem>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    <span className="flex items-center gap-1.5">
                      {conn.name}
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        {conn.provider === 'era_cloud' ? 'Cloud' : 'Z-API'}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Template</Label>
            <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {templatesForConnection.map((tpl) => (
                  <SelectItem key={tpl.name} value={tpl.name}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variable fields */}
          {varCount > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Variáveis</Label>
              {varValues.map((val, i) => (
                <Input
                  key={i}
                  placeholder={`Variável {{${i + 1}}}`}
                  value={val}
                  onChange={(e) => {
                    const updated = [...varValues];
                    updated[i] = e.target.value;
                    setVarValues(updated);
                  }}
                />
              ))}
            </div>
          )}

          {/* Preview */}
          {previewText && (
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Preview</Label>
              <div className="rounded-lg bg-green-600 text-white p-3 text-sm whitespace-pre-wrap">
                {previewText}
              </div>
            </div>
          )}

          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleSend}
            disabled={sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Template
          </Button>
        </div>
      </div>
    </div>
  );
};

// Agent Configuration Sheet
const AgentConfigSheet: React.FC = () => {
  const { data: settings, isLoading } = useAgentSettings();
  const updateSettings = useUpdateAgentSettings();
  const [localPrompt, setLocalPrompt] = useState('');
  const [localContext, setLocalContext] = useState('');
  const [localKeywords, setLocalKeywords] = useState('');
  const [localDelay, setLocalDelay] = useState(5);
  const [localMaxMsgs, setLocalMaxMsgs] = useState(50);

  useEffect(() => {
    if (settings) {
      setLocalPrompt(settings.system_prompt);
      setLocalContext(settings.business_context);
      setLocalKeywords((settings.escalation_keywords || []).join(', '));
      setLocalDelay(settings.auto_reply_delay_seconds);
      setLocalMaxMsgs(settings.max_messages_per_conversation);
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      system_prompt: localPrompt,
      business_context: localContext,
      escalation_keywords: localKeywords.split(',').map(k => k.trim()).filter(Boolean),
      auto_reply_delay_seconds: localDelay,
      max_messages_per_conversation: localMaxMsgs,
    });
  };

  const handleToggle = (enabled: boolean) => {
    if (!settings) return;
    updateSettings.mutate({ id: settings.id, is_enabled: enabled });
  };

  if (isLoading) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[450px] sm:max-w-[450px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Agente IA WhatsApp
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Agente Ativo</Label>
              <p className="text-xs text-muted-foreground">Responder automaticamente via IA</p>
            </div>
            <Switch checked={settings?.is_enabled || false} onCheckedChange={handleToggle} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Boas-vindas WhatsApp</Label>
              <p className="text-xs text-muted-foreground">Enviar mensagem de boas-vindas automaticamente pelo WhatsApp ao cadastrar alunos</p>
            </div>
            <Switch
              checked={(settings as any)?.whatsapp_welcome_enabled ?? true}
              onCheckedChange={(enabled) => {
                if (!settings) return;
                updateSettings.mutate({ id: settings.id, whatsapp_welcome_enabled: enabled } as any);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Prompt do Sistema</Label>
            <Textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              rows={6}
              className="text-sm"
              placeholder="Instruções para a IA..."
            />
          </div>

          <div className="space-y-2">
            <Label>Contexto da Empresa</Label>
            <Textarea
              value={localContext}
              onChange={(e) => setLocalContext(e.target.value)}
              rows={4}
              className="text-sm"
              placeholder="Informações sobre a empresa..."
            />
          </div>

          <div className="space-y-2">
            <Label>Palavras-chave de Escalação</Label>
            <Textarea
              value={localKeywords}
              onChange={(e) => setLocalKeywords(e.target.value)}
              rows={3}
              className="text-sm"
              placeholder="atendente, humano, reclamação..."
            />
            <p className="text-[10px] text-muted-foreground">Separadas por vírgula. Se o aluno usar essas palavras, a conversa escala para humano.</p>
          </div>

          <div className="space-y-2">
            <Label>Delay de Resposta: {localDelay}s</Label>
            <Slider
              value={[localDelay]}
              onValueChange={([v]) => setLocalDelay(v)}
              min={0}
              max={30}
              step={1}
            />
            <p className="text-[10px] text-muted-foreground">Tempo de espera antes de enviar resposta (parecer mais humano)</p>
          </div>

          <div className="space-y-2">
            <Label>Máximo de Mensagens Automáticas</Label>
            <Input
              type="number"
              value={localMaxMsgs}
              onChange={(e) => setLocalMaxMsgs(parseInt(e.target.value) || 50)}
              className="w-24"
            />
            <p className="text-[10px] text-muted-foreground">Após esse limite, escala para humano automaticamente</p>
          </div>

          <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
            Salvar Configurações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// User Profile Sheet
const UserProfileSheet: React.FC<{ profileId: string }> = ({ profileId }) => {
  const queryClient = useQueryClient();
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['whatsapp-profile', profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, avatar_url, created_at')
        .eq('id', profileId)
        .maybeSingle();
      return data;
    },
    enabled: !!profileId,
  });

  const userId = profile?.user_id;

  const { data: combos = [] } = useQuery({
    queryKey: ['whatsapp-user-combos', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_combos')
        .select('purchased_at, combos:combo_id(id, name)')
        .eq('user_id', userId!);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['whatsapp-user-courses', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_courses')
        .select('purchased_at, courses:course_id(id, name)')
        .eq('user_id', userId!);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: userPackages = [] } = useQuery({
    queryKey: ['whatsapp-user-packages', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_packages')
        .select('purchased_at, packages:package_id(id, name)')
        .eq('user_id', userId!);
      return data || [];
    },
    enabled: !!userId,
  });

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Catalog data for adding enrollments
  const { data: allCombos = [] } = useCombos();
  const { data: allCourses = [] } = useCourses();
  const { data: allPackages = [] } = usePackages();

  // Mutations
  const updateProfile = useUpdateUserProfile();
  const updateAccess = useUpdateUserAccess();

  // Add enrollment dialog state
  const [addDialogType, setAddDialogType] = useState<'combo' | 'course' | 'package' | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addSearch, setAddSearch] = useState('');

  const startEditing = () => {
    setEditName(profile?.full_name || '');
    setEditPhone(profile?.phone || '');
    setEditEmail(profile?.email || '');
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!userId || !profile) return;
    try {
      await updateProfile.mutateAsync({
        userId,
        fullName: editName,
        phone: editPhone,
        email: editEmail,
        originalEmail: profile.email,
      });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-profile', profileId] });
      setIsEditing(false);
    } catch {
      // error handled by mutation
    }
  };

  const invalidateEnrollments = () => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-user-combos', userId] });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-user-courses', userId] });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-user-packages', userId] });
  };

  const handleRemoveEnrollment = async (type: 'combo' | 'course' | 'package', removeId: string) => {
    if (!userId) return;
    const currentComboIds = combos.map((c: any) => (c.combos as any)?.id).filter(Boolean);
    const currentCourseIds = courses.map((c: any) => (c.courses as any)?.id).filter(Boolean);
    const currentPackageIds = userPackages.map((p: any) => (p.packages as any)?.id).filter(Boolean);

    try {
      await updateAccess.mutateAsync({
        userId,
        currentComboIds,
        newComboIds: type === 'combo' ? currentComboIds.filter((id: string) => id !== removeId) : currentComboIds,
        currentCourseIds,
        newCourseIds: type === 'course' ? currentCourseIds.filter((id: string) => id !== removeId) : currentCourseIds,
        currentPackageIds,
        newPackageIds: type === 'package' ? currentPackageIds.filter((id: string) => id !== removeId) : currentPackageIds,
      });
      invalidateEnrollments();
    } catch {
      // error handled by mutation
    }
  };

  const openAddDialog = (type: 'combo' | 'course' | 'package') => {
    setAddDialogType(type);
    setSelectedIds([]);
    setAddSearch('');
  };

  const handleAddEnrollment = async () => {
    if (!userId || !addDialogType || selectedIds.length === 0) return;
    const currentComboIds = combos.map((c: any) => (c.combos as any)?.id).filter(Boolean);
    const currentCourseIds = courses.map((c: any) => (c.courses as any)?.id).filter(Boolean);
    const currentPackageIds = userPackages.map((p: any) => (p.packages as any)?.id).filter(Boolean);

    try {
      await updateAccess.mutateAsync({
        userId,
        currentComboIds,
        newComboIds: addDialogType === 'combo' ? [...currentComboIds, ...selectedIds] : currentComboIds,
        currentCourseIds,
        newCourseIds: addDialogType === 'course' ? [...currentCourseIds, ...selectedIds] : currentCourseIds,
        currentPackageIds,
        newPackageIds: addDialogType === 'package' ? [...currentPackageIds, ...selectedIds] : currentPackageIds,
      });
      invalidateEnrollments();
      setAddDialogType(null);
    } catch {
      // error handled by mutation
    }
  };

  const getAvailableItems = () => {
    if (!addDialogType) return [];
    const enrolledIds = new Set(
      addDialogType === 'combo' ? combos.map((c: any) => (c.combos as any)?.id) :
      addDialogType === 'course' ? courses.map((c: any) => (c.courses as any)?.id) :
      userPackages.map((p: any) => (p.packages as any)?.id)
    );
    const items = addDialogType === 'combo' ? allCombos : addDialogType === 'course' ? allCourses : allPackages;
    return items
      .filter(item => !enrolledIds.has(item.id))
      .filter(item => !addSearch || item.name.toLowerCase().includes(addSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  };

  const dialogTitle = addDialogType === 'combo' ? 'Adicionar Combos' : addDialogType === 'course' ? 'Adicionar Cursos' : 'Adicionar Módulos';

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return ''; }
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <>
    <Sheet>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <User className="h-3.5 w-3.5 mr-1" /> Perfil
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent>Ver perfil do aluno</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Perfil do Aluno
            </SheetTitle>
            {profile && !isEditing && (
              <Button variant="ghost" size="sm" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
            )}
          </div>
          <SheetDescription>Dados e matrículas do aluno vinculado a esta conversa</SheetDescription>
        </SheetHeader>

        {loadingProfile ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground mt-6">Perfil não encontrado.</p>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Profile Header */}
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome completo"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Telefone"
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProfile} disabled={updateProfile.isPending} className="h-7 text-xs">
                        {updateProfile.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs">
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-foreground truncate">{profile.full_name || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                  </>
                )}
              </div>
            </div>

            {/* Basic Info */}
            {!isEditing && (
              <div className="space-y-2 text-sm">
                {profile.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>Cadastro: {formatDate(profile.created_at)}</span>
                </div>
              </div>
            )}

            {/* Combos */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm text-foreground flex-1">Combos ({combos.length})</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAddDialog('combo')}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {combos.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6">Nenhum combo matriculado</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {combos.map((c: any, i: number) => {
                    const comboData = c.combos as any;
                    return (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5 text-sm group">
                        <span className="truncate text-foreground">{comboData?.name || 'Combo'}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDate(c.purchased_at)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => comboData?.id && handleRemoveEnrollment('combo', comboData.id)}
                            disabled={updateAccess.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Courses */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm text-foreground flex-1">Cursos ({courses.length})</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAddDialog('course')}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {courses.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6">Nenhum curso matriculado</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {courses.map((c: any, i: number) => {
                    const courseData = c.courses as any;
                    return (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5 text-sm group">
                        <span className="truncate text-foreground">{courseData?.name || 'Curso'}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDate(c.purchased_at)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => courseData?.id && handleRemoveEnrollment('course', courseData.id)}
                            disabled={updateAccess.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Packages/Modules */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm text-foreground flex-1">Módulos ({userPackages.length})</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAddDialog('package')}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {userPackages.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-6">Nenhum módulo matriculado</p>
              ) : (
                <div className="space-y-1 pl-6">
                  {userPackages.map((p: any, i: number) => {
                    const pkgData = p.packages as any;
                    return (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5 text-sm group">
                        <span className="truncate text-foreground">{pkgData?.name || 'Módulo'}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDate(p.purchased_at)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => pkgData?.id && handleRemoveEnrollment('package', pkgData.id)}
                            disabled={updateAccess.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* Add Enrollment Dialog */}
    <Dialog open={!!addDialogType} onOpenChange={(open) => !open && setAddDialogType(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Buscar por nome..."
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            className="h-9"
          />
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {getAvailableItems().map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={(checked) => {
                      setSelectedIds(prev =>
                        checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                      );
                    }}
                  />
                  <span className="truncate">{item.name}</span>
                </label>
              ))}
              {getAvailableItems().length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item disponível</p>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAddDialogType(null)}>Cancelar</Button>
          <Button onClick={handleAddEnrollment} disabled={selectedIds.length === 0 || updateAccess.isPending}>
            {updateAccess.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Adicionar ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

// Lead Stage Badge (shown in chat header) - clickable with CRM Dialog
const LeadStageBadge: React.FC<{ phone: string }> = ({ phone }) => {
  const normalizedPhone = phone.replace(/\D/g, '');
  const phoneWithPlus = `+${normalizedPhone}`;
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedFunnel, setSelectedFunnel] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadFunnel, setNewLeadFunnel] = useState('atendimento');
  const [creating, setCreating] = useState(false);

  const { data: lead } = useQuery({
    queryKey: ['whatsapp-lead-by-phone', normalizedPhone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .or(`phone.eq.${normalizedPhone},phone.eq.${phoneWithPlus}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CRMLead | null;
    },
    enabled: !!normalizedPhone,
  });

  // Sync state when dialog opens
  useEffect(() => {
    if (open && lead) {
      setSelectedFunnel(lead.funnel || 'recovery');
      setSelectedStage(lead.stage || '');
      setShowLostReason(false);
      setLostReason('');
    }
  }, [open, lead]);

  const invalidateLeadQueries = () => {
    qc.invalidateQueries({ queryKey: ['whatsapp-lead-by-phone', normalizedPhone] });
    qc.invalidateQueries({ queryKey: ['crm-leads'] });
  };

  const handleStageChange = async (newStage: string) => {
    if (!lead) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = { stage: newStage, updated_at: new Date().toISOString() };
      if (newStage === 'convertido') updateData.converted_at = new Date().toISOString();
      if (selectedFunnel && selectedFunnel !== lead.funnel) updateData.funnel = selectedFunnel;
      const { error } = await supabase.from('crm_leads').update(updateData).eq('id', lead.id);
      if (error) throw error;
      await supabase.from('crm_lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'stage_change',
        description: `Estágio alterado para: ${newStage} (via WhatsApp)`,
        created_by: user?.id || null,
      });
      invalidateLeadQueries();
      toast.success('Estágio atualizado');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar estágio');
    } finally {
      setSaving(false);
    }
  };

  const handleLost = async () => {
    if (!lead || !lostReason.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('crm_leads').update({
        stage: 'perdido',
        lost_reason: lostReason.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);
      if (error) throw error;
      await supabase.from('crm_lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'stage_change',
        description: `Marcado como perdido: ${lostReason.trim()} (via WhatsApp)`,
        created_by: user?.id || null,
      });
      invalidateLeadQueries();
      toast.success('Lead marcado como perdido');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao marcar como perdido');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLead = async () => {
    if (!newLeadName.trim()) return;
    setCreating(true);
    try {
      const initialStages = getStagesForFunnel(newLeadFunnel);
      const { error } = await supabase.from('crm_leads').insert({
        name: newLeadName.trim(),
        phone: phoneWithPlus,
        funnel: newLeadFunnel,
        stage: initialStages[0]?.key || 'carrinho_abandonado_1',
        source: 'whatsapp',
      });
      if (error) throw error;
      invalidateLeadQueries();
      toast.success('Lead criado no CRM');
      setOpen(false);
      setNewLeadName('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar lead');
    } finally {
      setCreating(false);
    }
  };

  const stageInfo = lead ? ALL_STAGES.find(s => s.key === lead.stage) : null;
  const availableStages = getStagesForFunnel(selectedFunnel);

  const badgeContent = !lead ? (
    <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-accent">CRM</Badge>
  ) : lead.stage === 'convertido' ? (
    <Badge className="text-[10px] bg-green-600 text-white cursor-pointer hover:bg-green-700">Convertido</Badge>
  ) : lead.stage === 'perdido' ? (
    <Badge variant="destructive" className="text-[10px] cursor-pointer hover:opacity-80">Perdido</Badge>
  ) : stageInfo ? (
    <Badge className={cn('text-[10px] text-white cursor-pointer hover:opacity-80', stageInfo.color)}>{stageInfo.label}</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-accent">CRM</Badge>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{badgeContent}</div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Lead no CRM</DialogTitle>
        </DialogHeader>

        {!lead ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Nenhum lead encontrado para este telefone. Criar um novo?</p>
            <div className="space-y-2">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Nome do lead"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Funil</Label>
              <Select value={newLeadFunnel} onValueChange={setNewLeadFunnel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNNEL_OPTIONS.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreateLead} disabled={!newLeadName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar Lead
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm"><span className="text-muted-foreground">Lead:</span> {lead.name}</div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Funil</Label>
              <Select value={selectedFunnel} onValueChange={(v) => { setSelectedFunnel(v); setSelectedStage(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNNEL_OPTIONS.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Estágio</Label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger><SelectValue placeholder="Selecione o estágio" /></SelectTrigger>
                <SelectContent>
                  {availableStages.map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStage && selectedStage !== lead.stage && (
              <Button
                className="w-full"
                onClick={() => handleStageChange(selectedStage)}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Mover para: {availableStages.find(s => s.key === selectedStage)?.label || selectedStage}
              </Button>
            )}

            <div className="flex gap-2 pt-2 border-t">
              {lead.stage !== 'convertido' && (
                <Button
                  variant="outline"
                  className="flex-1 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                  onClick={() => handleStageChange('convertido')}
                  disabled={saving}
                >
                  <DollarSign className="h-4 w-4 mr-1" /> Convertido
                </Button>
              )}
              {lead.stage !== 'perdido' && !showLostReason && (
                <Button
                  variant="outline"
                  className="flex-1 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowLostReason(true)}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1" /> Perdido
                </Button>
              )}
            </div>

            {showLostReason && (
              <div className="space-y-2">
                <Label className="text-xs">Motivo da perda</Label>
                <Input
                  placeholder="Ex: Comprou concorrente, sem interesse..."
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowLostReason(false)}>Cancelar</Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLost}
                    disabled={!lostReason.trim() || saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Confirmar perda
                  </Button>
                </div>
              </div>
            )}

            {/* Also update funnel if changed */}
            {selectedFunnel !== lead.funnel && selectedStage && (
              <p className="text-xs text-muted-foreground">O funil também será alterado para {FUNNEL_OPTIONS.find(f => f.key === selectedFunnel)?.label}.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Helper to get stages by funnel
const getStagesForFunnel = (funnel: string) => {
  switch (funnel) {
    case 'pico_vendas': return PICO_VENDAS_STAGES;
    case 'atendimento': return ATENDIMENTO_STAGES;
    default: return CRM_STAGES;
  }
};

const FUNNEL_OPTIONS = [
  { key: 'recovery', label: 'Recuperação' },
  { key: 'pico_vendas', label: 'Pico de Vendas' },
  { key: 'atendimento', label: 'Atendimento' },
];

// Lead Profile Sheet (for contacts without profile_id)
const LeadProfileSheet: React.FC<{ phone: string }> = ({ phone }) => {
  const normalizedPhone = phone.replace(/\D/g, '');
  const phoneWithPlus = `+${normalizedPhone}`;
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: lead, isLoading } = useQuery({
    queryKey: ['whatsapp-lead-by-phone', normalizedPhone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .or(`phone.eq.${normalizedPhone},phone.eq.${phoneWithPlus}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CRMLead | null;
    },
    enabled: !!normalizedPhone,
  });

  // State for CRM actions
  const [changingStage, setChangingStage] = useState(false);
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState('');
  // State for create lead form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadFunnel, setNewLeadFunnel] = useState('atendimento');

  const handleStageChange = async (newStage: string) => {
    if (!lead) return;
    setChangingStage(true);
    try {
      const { error: updateError } = await supabase
        .from('crm_leads')
        .update({
          stage: newStage,
          ...(newStage === 'convertido' ? { converted_at: new Date().toISOString() } : {}),
        } as any)
        .eq('id', lead.id);
      if (updateError) throw updateError;

      const stageLabel = ALL_STAGES.find(s => s.key === newStage)?.label || newStage;
      await supabase.from('crm_lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'stage_change',
        description: `Movido para: ${stageLabel} (via WhatsApp)`,
        created_by: user?.id || null,
      } as any);

      qc.invalidateQueries({ queryKey: ['whatsapp-lead-by-phone', normalizedPhone] });
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-lead', lead.id] });
      toast.success(`Lead movido para ${stageLabel}`);
    } catch (err: any) {
      toast.error('Erro ao mudar estágio: ' + err.message);
    } finally {
      setChangingStage(false);
    }
  };

  const handleMarkLost = async () => {
    if (!lead || !lostReason.trim()) return;
    setChangingStage(true);
    try {
      const { error } = await supabase
        .from('crm_leads')
        .update({ stage: 'perdido', lost_reason: lostReason.trim() } as any)
        .eq('id', lead.id);
      if (error) throw error;

      await supabase.from('crm_lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'stage_change',
        description: `Marcado como perdido: ${lostReason.trim()} (via WhatsApp)`,
        created_by: user?.id || null,
      } as any);

      qc.invalidateQueries({ queryKey: ['whatsapp-lead-by-phone', normalizedPhone] });
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Lead marcado como perdido');
      setShowLostReason(false);
      setLostReason('');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setChangingStage(false);
    }
  };

  const handleCreateLead = async () => {
    if (!newLeadName.trim()) return;
    setChangingStage(true);
    try {
      const initialStage = getStagesForFunnel(newLeadFunnel)[0].key;
      const { error } = await supabase.from('crm_leads').insert({
        name: newLeadName.trim(),
        phone: phoneWithPlus,
        funnel: newLeadFunnel,
        stage: initialStage,
        source: 'whatsapp',
      } as any);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['whatsapp-lead-by-phone', normalizedPhone] });
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Lead criado com sucesso');
      setShowCreateForm(false);
      setNewLeadName('');
    } catch (err: any) {
      toast.error('Erro ao criar lead: ' + err.message);
    } finally {
      setChangingStage(false);
    }
  };

  const stageInfo = lead ? ALL_STAGES.find(s => s.key === lead.stage) : null;
  const initials = lead?.name
    ? lead.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const formatDateStr = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return ''; }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const isClosed = lead ? CLOSED_STAGES.includes(lead.stage as any) : false;
  const funnelStages = lead ? getStagesForFunnel(lead.funnel || 'recovery') : [];

  return (
    <Sheet>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs border-orange-500/50 text-orange-600 hover:bg-orange-50">
                <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Lead
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent>Ver dados do lead no CRM</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Dados do Lead
          </SheetTitle>
          <SheetDescription>Informações e ações CRM para esta conversa</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !lead ? (
          <div className="space-y-4 mt-6">
            <p className="text-sm text-muted-foreground">Nenhum lead encontrado no CRM para este telefone.</p>
            {!showCreateForm ? (
              <Button onClick={() => setShowCreateForm(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Criar Lead no CRM
              </Button>
            ) : (
              <div className="space-y-3 border rounded-lg p-4">
                <h4 className="font-medium text-sm">Novo Lead</h4>
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={newLeadName}
                    onChange={e => setNewLeadName(e.target.value)}
                    placeholder="Nome do contato"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Funil</Label>
                  <Select value={newLeadFunnel} onValueChange={setNewLeadFunnel}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNNEL_OPTIONS.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateLead} disabled={changingStage || !newLeadName.trim()} className="flex-1">
                    {changingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Lead Header */}
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg bg-orange-100 text-orange-700">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{lead.name}</p>
                {stageInfo && (
                  <Badge className={cn('text-[10px] text-white mt-1', stageInfo.color)}>
                    {stageInfo.label}
                  </Badge>
                )}
                {lead.stage === 'convertido' && (
                  <Badge className="text-[10px] bg-green-600 text-white mt-1">Convertido</Badge>
                )}
                {lead.stage === 'perdido' && (
                  <Badge variant="destructive" className="text-[10px] mt-1">Perdido</Badge>
                )}
              </div>
            </div>

            {/* CRM Stage Actions */}
            {!isClosed && (
              <div className="space-y-3 border rounded-lg p-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-primary" /> Mover no Funil
                </h4>
                <Select
                  value={lead.stage}
                  onValueChange={handleStageChange}
                  disabled={changingStage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {funnelStages.map(s => (
                      <SelectItem key={s.key} value={s.key}>
                        <span className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', s.color)} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={changingStage}
                    onClick={() => handleStageChange('convertido')}
                  >
                    {changingStage ? <Loader2 className="h-3 w-3 animate-spin" /> : '✅ Convertido'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={changingStage}
                    onClick={() => setShowLostReason(true)}
                  >
                    ❌ Perdido
                  </Button>
                </div>
                {showLostReason && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Motivo da perda..."
                      value={lostReason}
                      onChange={e => setLostReason(e.target.value)}
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleMarkLost} disabled={changingStage || !lostReason.trim()} className="flex-1">
                        Confirmar Perda
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowLostReason(false); setLostReason(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contact Info */}
            <div className="space-y-2 text-sm">
              {lead.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs">✉️</span>
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{lead.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>Criado em: {formatDateStr(lead.created_at)}</span>
              </div>
            </div>

            {/* Product Info */}
            {lead.product_name && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Produto de Interesse
                </h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  <p className="text-sm font-medium text-foreground">{lead.product_name}</p>
                  {lead.sale_value && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>{formatCurrency(lead.sale_value)}</span>
                    </div>
                  )}
                  {lead.source && (
                    <p className="text-xs text-muted-foreground">Origem: {lead.source}</p>
                  )}
                </div>
              </div>
            )}

            {/* Recovery URL */}
            {lead.recovery_url && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" /> Link de Recuperação
                </h4>
                <a
                  href={lead.recovery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline truncate"
                >
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{lead.recovery_url}</span>
                </a>
              </div>
            )}

            {/* Lost reason */}
            {lead.lost_reason && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-foreground">Motivo da perda</h4>
                <p className="text-sm text-muted-foreground">{lead.lost_reason}</p>
              </div>
            )}

            {/* CRM Link */}
            <Link to={`/admin/crm?lead=${lead.id}`}>
              <Button variant="outline" className="w-full mt-2">
                <ExternalLink className="h-4 w-4 mr-2" /> Ver no CRM
              </Button>
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AdminWhatsApp;
