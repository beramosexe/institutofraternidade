import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarClock, Check, Copy, Facebook, ImagePlus, Instagram, MessageCircle, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Send, Trash2, Youtube } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { deleteSocialPost, generateWorkReminders, getMetaConnectionStatus, listSocialCenter, publishSocialPost, saveSocialPost, updateSocialPostStatus } from "@/lib/social-media.functions";

export const Route = createFileRoute("/_authenticated/app/midias/redes")({
  head: () => ({ meta: [
    { title: "Central de Comunicações — Instituto Fraternidade" },
    { name: "description", content: "Organize publicações, avisos e comunicados do Instituto em todos os canais." },
    { property: "og:title", content: "Central de Comunicações — Instituto Fraternidade" },
    { property: "og:description", content: "Organize publicações, avisos e comunicados do Instituto em todos os canais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CommunicationsCenter,
});

type Center = Awaited<ReturnType<typeof listSocialCenter>>;
type Communication = Center["posts"][number];
type Status = "draft" | "pending_approval" | "scheduled" | "published" | "failed" | "cancelled";
type Channel = "instagram" | "facebook" | "whatsapp" | "email" | "telegram" | "youtube";
type Schedule = "one_off" | "recurring" | "automatic";
type Draft = {
  id?: string; title: string; content_text: string; media_url: string; channels: Channel[];
  scheduled_for: string; status: Status; schedule_type: Schedule; recurrence_weekday: number | null;
  recurrence_time: string; recurrence_ends_on: string;
};

const EMPTY: Draft = { title: "", content_text: "", media_url: "", channels: ["facebook"], scheduled_for: "", status: "draft", schedule_type: "one_off", recurrence_weekday: null, recurrence_time: "19:00", recurrence_ends_on: "" };
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const CHANNELS: { value: Channel; label: string; icon: typeof Facebook; ready?: keyof Awaited<ReturnType<typeof getMetaConnectionStatus>> }[] = [
  { value: "instagram", label: "Instagram", icon: Instagram, ready: "metaConfigured" },
  { value: "facebook", label: "Facebook", icon: Facebook, ready: "metaConfigured" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, ready: "whatsappConfigured" },
  { value: "youtube", label: "YouTube", icon: Youtube },
];
const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  pending_approval: { label: "Para aprovar", className: "bg-warning/15 text-warning" },
  scheduled: { label: "Agendada", className: "bg-brand/15 text-brand" },
  publishing: { label: "Enviando", className: "bg-brand/15 text-brand" },
  published: { label: "Publicada", className: "bg-success/15 text-success" },
  failed: { label: "Com erro", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

function CommunicationsCenter() {
  const load = useServerFn(listSocialCenter);
  const connection = useServerFn(getMetaConnectionStatus);
  const save = useServerFn(saveSocialPost);
  const remove = useServerFn(deleteSocialPost);
  const changeStatus = useServerFn(updateSocialPostStatus);
  const publish = useServerFn(publishSocialPost);
  const generate = useServerFn(generateWorkReminders);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["communications-center"], queryFn: () => load() });
  const { data: connections } = useQuery({ queryKey: ["communication-connections"], queryFn: () => connection() });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["communications-center"] });

  const saveMutation = useMutation({
    mutationFn: () => save({ data: {
      ...draft,
      media_url: draft.media_url || null,
      scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null,
      recurrence_time: draft.schedule_type === "recurring" ? `${draft.recurrence_time}:00` : null,
      recurrence_weekday: draft.schedule_type === "recurring" ? draft.recurrence_weekday : null,
      recurrence_ends_on: draft.schedule_type === "recurring" ? draft.recurrence_ends_on || null : null,
    } }),
    onSuccess: () => { toast.success(draft.schedule_type === "recurring" ? "Recorrência criada." : "Comunicação salva."); setDialogOpen(false); invalidate(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const actionMutation = useMutation({
    mutationFn: ({ action, post }: { action: string; post: Communication }) => action === "delete"
      ? remove({ data: { id: post.id } })
      : action === "publish" ? publish({ data: { id: post.id } }) : changeStatus({ data: { id: post.id, status: action as Status } }),
    onSuccess: (_, item) => { toast.success(item.action === "publish" ? "Envio processado." : "Comunicação atualizada."); invalidate(); },
    onError: (error) => { toast.error(error instanceof Error ? error.message : "A ação não pôde ser concluída."); invalidate(); },
  });
  const generateMutation = useMutation({
    mutationFn: () => generate({ data: {} }),
    onSuccess: (result) => { toast.success(result.created ? `${result.created} aviso(s) criado(s).` : "Os avisos já estão em dia."); invalidate(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar os avisos."),
  });

  const works = useMemo(() => new Map((data?.works ?? []).map((work) => [work.id, work.name])), [data?.works]);
  const posts = useMemo(() => (data?.posts ?? []).filter((post) => {
    const term = search.toLocaleLowerCase("pt-BR");
    return (status === "all" || post.status === status)
      && (channel === "all" || post.channels.includes(channel))
      && (!term || `${post.title ?? ""} ${post.content_text} ${post.work_id ? works.get(post.work_id) ?? "" : ""}`.toLocaleLowerCase("pt-BR").includes(term));
  }), [channel, data?.posts, search, status, works]);

  const openEditor = (post?: Communication) => {
    setDraft(post ? {
      id: post.id, title: post.title ?? "", content_text: post.content_text, media_url: post.media_url ?? "",
      channels: post.channels as Channel[], scheduled_for: post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : "",
      status: post.status as Status, schedule_type: post.schedule_type as Schedule,
      recurrence_weekday: post.recurrence_weekday, recurrence_time: post.recurrence_time?.slice(0, 5) ?? "19:00",
      recurrence_ends_on: post.recurrence_ends_on ?? "",
    } : EMPTY);
    setDialogOpen(true);
  };
  const duplicate = (post: Communication) => {
    setDraft({ ...EMPTY, title: `Cópia · ${post.title ?? "Comunicação"}`, content_text: post.content_text, media_url: post.media_url ?? "", channels: post.channels as Channel[] });
    setDialogOpen(true);
  };

  return <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Mídias</p><h1 className="font-display text-3xl text-foreground">Central de Comunicações</h1><p className="text-sm text-muted-foreground">Publicações, avisos dos trabalhos e comunicados em uma única agenda.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}><RefreshCw className="mr-2 h-4 w-4" />Atualizar avisos</Button><Button onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />Nova publicação</Button></div>
    </header>

    <div className="grid gap-2 sm:grid-cols-[minmax(15rem,1fr)_12rem_12rem]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título, texto ou trabalho" /></div>
      <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(STATUS).filter(([value]) => value !== "publishing").map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select>
      <Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os canais</SelectItem>{CHANNELS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
    </div>

    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead className="min-w-64">Comunicação</TableHead><TableHead>Trabalho</TableHead><TableHead>Canais</TableHead><TableHead>Envio</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Carregando comunicações…</TableCell></TableRow>}
            {!isLoading && posts.length === 0 && <TableRow><TableCell colSpan={7} className="h-40 text-center"><Send className="mx-auto mb-2 h-7 w-7 text-muted-foreground" /><p className="font-medium">Nenhuma comunicação encontrada.</p></TableCell></TableRow>}
            {posts.map((post) => <CommunicationRow key={post.id} post={post} workName={post.work_id ? works.get(post.work_id) : undefined} connections={connections} onEdit={() => openEditor(post)} onDuplicate={() => duplicate(post)} onAction={(action) => actionMutation.mutate({ action, post })} />)}
          </TableBody>
        </Table>
      </div>
    </Card>
    <p className="text-xs text-muted-foreground">WhatsApp ficará disponível após conectar a conta oficial. YouTube e outros canais podem ser adicionados sem mudar esta estrutura.</p>
    <CommunicationDialog open={dialogOpen} onOpenChange={setDialogOpen} draft={draft} setDraft={setDraft} saving={saveMutation.isPending} onSave={() => saveMutation.mutate()} />
  </div>;
}

function CommunicationRow({ post, workName, connections, onEdit, onDuplicate, onAction }: { post: Communication; workName?: string; connections?: Awaited<ReturnType<typeof getMetaConnectionStatus>>; onEdit: () => void; onDuplicate: () => void; onAction: (action: string) => void }) {
  const state = STATUS[post.status] ?? STATUS.draft;
  return <TableRow>
    <TableCell><div className="flex items-center gap-3">{post.media_url && <img src={post.media_url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />}<div className="min-w-0"><p className="truncate font-medium">{post.title || "Sem nome interno"}</p><p className="max-w-md truncate text-xs text-muted-foreground">{post.content_text}</p>{post.last_error && <p className="max-w-md truncate text-xs text-destructive">{post.last_error}</p>}</div></div></TableCell>
    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{workName ?? "—"}</TableCell>
    <TableCell><div className="flex gap-1">{post.channels.map((value) => { const item = CHANNELS.find((candidate) => candidate.value === value); if (!item) return <Badge key={value} variant="outline">{value}</Badge>; const Icon = item.icon; const ready = item.ready ? Boolean(connections?.[item.ready]) : false; return <span key={value} title={`${item.label}${ready ? " conectado" : " aguardando conexão"}`} className="relative"><Icon className="h-4 w-4" /><span className={`absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ${ready ? "bg-success" : "bg-muted-foreground"}`} /></span>; })}</div></TableCell>
    <TableCell className="whitespace-nowrap text-sm">{post.scheduled_for ? new Date(post.scheduled_for).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Sem horário"}</TableCell>
    <TableCell><Badge variant="outline">{post.schedule_type === "recurring" ? "Recorrente" : post.schedule_type === "automatic" ? "Automática" : "Pontual"}</Badge></TableCell>
    <TableCell><Badge className={state.className}>{state.label}</Badge></TableCell>
    <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem><DropdownMenuItem onClick={onDuplicate}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>{post.status === "draft" && <DropdownMenuItem onClick={() => onAction("scheduled")}><Check className="mr-2 h-4 w-4" />Aprovar e agendar</DropdownMenuItem>}{(post.status === "scheduled" || post.status === "failed") && <DropdownMenuItem onClick={() => onAction("publish")}><Send className="mr-2 h-4 w-4" />Enviar agora</DropdownMenuItem>}{post.status !== "published" && <DropdownMenuItem className="text-destructive" onClick={() => onAction("delete")}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
  </TableRow>;
}

function CommunicationDialog({ open, onOpenChange, draft, setDraft, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>; saving: boolean; onSave: () => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => { setUploading(true); try { const session = (await supabase.auth.getSession()).data.session; if (!session) throw new Error("Sessão expirada."); const extension = file.name.split(".").pop() || "jpg"; const path = `social-posts/${session.user.id}/${Date.now()}.${extension}`; const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type }); if (error) throw error; setDraft((old) => ({ ...old, media_url: supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl })); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar imagem."); } finally { setUploading(false); } };
  const toggle = (value: Channel) => setDraft((old) => ({ ...old, channels: old.channels.includes(value) ? old.channels.filter((item) => item !== value) : [...old.channels, value] }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{draft.id ? "Editar comunicação" : "Nova publicação"}</DialogTitle></DialogHeader><div className="space-y-4">
    <div><Label>Nome interno *</Label><Input value={draft.title} onChange={(event) => setDraft((old) => ({ ...old, title: event.target.value }))} placeholder="Ex.: Convite para o trabalho de quarta" /></div>
    <div><Label>Texto *</Label><Textarea rows={6} value={draft.content_text} onChange={(event) => setDraft((old) => ({ ...old, content_text: event.target.value }))} placeholder="Escreva a mensagem que as pessoas receberão…" /></div>
    <div><Label>Canais *</Label><div className="mt-1 flex flex-wrap gap-2">{CHANNELS.map((item) => { const Icon = item.icon; return <Button key={item.value} type="button" variant={draft.channels.includes(item.value) ? "default" : "outline"} onClick={() => toggle(item.value)}><Icon className="mr-2 h-4 w-4" />{item.label}</Button>; })}</div></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label>Quando</Label><Select value={draft.schedule_type} onValueChange={(value) => setDraft((old) => ({ ...old, schedule_type: value as Schedule }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="one_off">Uma vez</SelectItem><SelectItem value="recurring">Toda semana</SelectItem></SelectContent></Select></div>{draft.schedule_type === "one_off" && <div><Label>Data e hora</Label><Input type="datetime-local" value={draft.scheduled_for} onChange={(event) => setDraft((old) => ({ ...old, scheduled_for: event.target.value }))} /></div>}</div>
    {draft.schedule_type === "recurring" && <div className="rounded-md border p-4"><p className="mb-3 text-sm font-medium">Repetir toda semana</p><div className="grid gap-3 sm:grid-cols-3"><div><Label>Dia</Label><Select value={draft.recurrence_weekday == null ? "" : String(draft.recurrence_weekday)} onValueChange={(value) => setDraft((old) => ({ ...old, recurrence_weekday: Number(value) }))}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger><SelectContent>{WEEKDAYS.map((day, index) => <SelectItem key={day} value={String(index)}>{day}</SelectItem>)}</SelectContent></Select></div><div><Label>Horário</Label><Input type="time" value={draft.recurrence_time} onChange={(event) => setDraft((old) => ({ ...old, recurrence_time: event.target.value }))} /></div><div><Label>Termina em</Label><Input type="date" value={draft.recurrence_ends_on} onChange={(event) => setDraft((old) => ({ ...old, recurrence_ends_on: event.target.value }))} /></div></div><p className="mt-2 text-xs text-muted-foreground">Deixe a data final vazia para continuar sem término. As próximas semanas serão preparadas automaticamente.</p></div>}
    <div><Label>Imagem</Label><label className="mt-1 flex min-h-28 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted text-sm text-muted-foreground">{draft.media_url ? <img src={draft.media_url} alt="Prévia" className="max-h-52 w-full object-contain" /> : <><ImagePlus className="mr-2 h-5 w-5" />{uploading ? "Enviando…" : "Escolher imagem"}</>}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>{draft.channels.includes("instagram") && <p className="mt-1 text-xs text-muted-foreground">A imagem é obrigatória para Instagram.</p>}</div>
  </div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving || !draft.title.trim() || !draft.content_text.trim() || draft.channels.length === 0} onClick={onSave}>Salvar e preparar</Button></DialogFooter></DialogContent></Dialog>;
}