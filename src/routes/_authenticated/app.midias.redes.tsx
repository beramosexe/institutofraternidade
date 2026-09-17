import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarClock, Check, Copy, Facebook, ImagePlus, Instagram, Pencil, Plus, RefreshCw, Send, Settings2, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteSocialPost, generateWorkReminders, getMetaConnectionStatus, listSocialCenter,
  publishSocialPost, saveSocialPost, saveWorkSocialSetting, updateSocialPostStatus,
} from "@/lib/social-media.functions";

export const Route = createFileRoute("/_authenticated/app/midias/redes")({
  head: () => ({ meta: [
    { title: "Redes sociais — Instituto Fraternidade" },
    { name: "description", content: "Prepare, aprove e acompanhe publicações do Instituto nas redes sociais." },
    { property: "og:title", content: "Redes sociais — Instituto Fraternidade" },
    { property: "og:description", content: "Prepare, aprove e acompanhe publicações do Instituto nas redes sociais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SocialPage,
});

type Center = Awaited<ReturnType<typeof listSocialCenter>>;
type Post = Center["posts"][number];
type Work = Center["works"][number];
type PostStatus = "draft" | "pending_approval" | "scheduled" | "published" | "failed" | "cancelled";
type PostDraft = { id?: string; title: string; content_text: string; media_url: string; channels: string[]; scheduled_for: string; status: PostStatus };

const EMPTY_POST: PostDraft = { title: "", content_text: "", media_url: "", channels: ["instagram", "facebook"], scheduled_for: "", status: "draft" };
const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  pending_approval: { label: "Aguardando aprovação", className: "bg-warning/15 text-warning" },
  scheduled: { label: "Agendada", className: "bg-brand/15 text-brand" },
  publishing: { label: "Publicando", className: "bg-brand/15 text-brand" },
  published: { label: "Publicada", className: "bg-success/15 text-success" },
  failed: { label: "Com erro", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

function SocialPage() {
  const load = useServerFn(listSocialCenter);
  const connection = useServerFn(getMetaConnectionStatus);
  const save = useServerFn(saveSocialPost);
  const remove = useServerFn(deleteSocialPost);
  const changeStatus = useServerFn(updateSocialPostStatus);
  const publish = useServerFn(publishSocialPost);
  const generate = useServerFn(generateWorkReminders);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["social-center"], queryFn: () => load() });
  const { data: meta } = useQuery({ queryKey: ["meta-connection"], queryFn: () => connection() });
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<PostDraft>(EMPTY_POST);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["social-center"] });

  const saveMutation = useMutation({
    mutationFn: () => save({ data: {
      ...draft,
      title: draft.title || null,
      media_url: draft.media_url || null,
      scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null,
      channels: draft.channels as ("instagram" | "facebook")[],
    } }),
    onSuccess: () => { toast.success("Publicação salva."); setDialogOpen(false); invalidate(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ action, post }: { action: string; post: Post }) => {
      if (action === "delete") return remove({ data: { id: post.id } });
      if (action === "publish") return publish({ data: { id: post.id } });
      return changeStatus({ data: { id: post.id, status: action as PostStatus } });
    },
    onSuccess: (_, variables) => { toast.success(variables.action === "publish" ? "Publicação enviada." : "Publicação atualizada."); invalidate(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "A ação não pôde ser concluída."),
  });
  const generateMutation = useMutation({
    mutationFn: () => generate({ data: {} }),
    onSuccess: (result) => { toast.success(result.created ? `${result.created} lembrete(s) criado(s).` : "Nenhum lembrete novo agora."); invalidate(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível gerar lembretes."),
  });

  const posts = useMemo(() => (data?.posts ?? []).filter((post) => filter === "all" || post.status === filter), [data?.posts, filter]);
  const openEditor = (post?: Post) => {
    setDraft(post ? {
      id: post.id, title: post.title ?? "", content_text: post.content_text,
      media_url: post.media_url ?? "", channels: post.channels,
      scheduled_for: post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : "",
      status: post.status as PostStatus,
    } : EMPTY_POST);
    setDialogOpen(true);
  };
  const duplicate = (post: Post) => {
    setDraft({ title: post.title ? `Cópia · ${post.title}` : "", content_text: post.content_text, media_url: post.media_url ?? "", channels: post.channels, scheduled_for: "", status: "draft" });
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Mídias</p><h1 className="font-display text-3xl text-foreground">Redes sociais</h1><p className="text-sm text-muted-foreground">Planeje lembretes e acompanhe cada publicação em um só lugar.</p></div>
        <Button onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />Nova publicação</Button>
      </header>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-transparent p-0">
          <TabsTrigger value="posts" className="gap-2"><Send className="h-4 w-4" />Postagens</TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2"><CalendarClock className="h-4 w-4" />Lembretes</TabsTrigger>
          <TabsTrigger value="connection" className="gap-2"><Settings2 className="h-4 w-4" />Conexão Meta</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[['all','Todas'], ['draft','Rascunhos'], ['pending_approval','Para aprovar'], ['scheduled','Agendadas'], ['published','Publicadas'], ['failed','Com erro']].map(([value,label]) => (
              <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{label}</Button>
            ))}
          </div>
          {isLoading && <Card className="p-8 text-center text-sm text-muted-foreground">Carregando publicações…</Card>}
          {!isLoading && posts.length === 0 && <Card className="p-10 text-center"><Send className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhuma publicação nesta etapa.</p><p className="text-sm text-muted-foreground">Crie uma publicação ou gere lembretes dos trabalhos.</p></Card>}
          <div className="grid gap-4 lg:grid-cols-2">
            {posts.map((post) => <PostCard key={post.id} post={post} configured={Boolean(meta?.configured)} onEdit={() => openEditor(post)} onDuplicate={() => duplicate(post)} onAction={(action) => actionMutation.mutate({ action, post })} />)}
          </div>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl">Divulgação dos trabalhos</h2><p className="text-sm text-muted-foreground">Cada trabalho decide prazos, redes e se exige aprovação.</p></div><Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}><RefreshCw className="mr-2 h-4 w-4" />Gerar lembretes agora</Button></div>
          <div className="grid gap-3">{(data?.works ?? []).map((work) => <WorkReminderCard key={work.id} work={work} setting={data?.settings.find((item) => item.work_id === work.id)} onSaved={invalidate} />)}</div>
        </TabsContent>

        <TabsContent value="connection">
          <Card className="p-6"><div className="flex items-start gap-4"><div className="rounded-md bg-muted p-3">{meta?.configured ? <Check className="h-6 w-6 text-success" /> : <WifiOff className="h-6 w-6 text-muted-foreground" />}</div><div className="space-y-2"><h2 className="font-display text-xl">{meta?.configured ? "Instagram e Facebook conectados" : "Conexão ainda não ativada"}</h2><p className="max-w-2xl text-sm text-muted-foreground">{meta?.configured ? "A central está pronta para publicar nas contas oficiais vinculadas." : "A gestão e os lembretes já funcionam. Para publicar de verdade, confirme o Instagram profissional vinculado à Página e autorize o aplicativo do Instituto na Meta."}</p><div className="flex gap-2"><Badge variant="outline"><Instagram className="mr-1 h-3 w-3" />Instagram</Badge><Badge variant="outline"><Facebook className="mr-1 h-3 w-3" />Facebook</Badge></div></div></div></Card>
        </TabsContent>
      </Tabs>

      <PostDialog open={dialogOpen} onOpenChange={setDialogOpen} draft={draft} setDraft={setDraft} saving={saveMutation.isPending} onSave={() => saveMutation.mutate()} />
    </div>
  );
}

function PostCard({ post, configured, onEdit, onDuplicate, onAction }: { post: Post; configured: boolean; onEdit: () => void; onDuplicate: () => void; onAction: (action: string) => void }) {
  const state = STATUS[post.status] ?? STATUS.draft;
  return <Card className="overflow-hidden"><div className="grid min-h-52 grid-cols-[7rem_1fr] sm:grid-cols-[10rem_1fr]">
    <div className="flex items-center justify-center bg-muted">{post.media_url ? <img src={post.media_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7 text-muted-foreground" />}</div>
    <div className="flex min-w-0 flex-col p-4"><div className="flex flex-wrap items-center gap-2"><Badge className={state.className}>{state.label}</Badge>{post.source === "work_reminder" && <Badge variant="outline">Lembrete</Badge>}</div><h3 className="mt-2 truncate font-semibold">{post.title || "Publicação sem título"}</h3><p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{post.content_text}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{post.channels.includes("instagram") && <Instagram className="h-4 w-4" />}{post.channels.includes("facebook") && <Facebook className="h-4 w-4" />}{post.scheduled_for && <span>{new Date(post.scheduled_for).toLocaleString("pt-BR")}</span>}</div>{post.last_error && <p className="mt-2 line-clamp-2 text-xs text-destructive">{post.last_error}</p>}<div className="mt-auto flex flex-wrap gap-1 pt-3"><Button size="icon" variant="ghost" title="Editar" onClick={onEdit}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Duplicar" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>{post.status === "draft" && <Button size="sm" variant="outline" onClick={() => onAction("scheduled")}><Check className="mr-1 h-4 w-4" />Aprovar</Button>}{(post.status === "scheduled" || post.status === "failed") && <Button size="sm" disabled={!configured} title={!configured ? "Conecte a Meta para publicar" : "Publicar agora"} onClick={() => onAction("publish")}><Send className="mr-1 h-4 w-4" />Publicar</Button>}<Button size="icon" variant="ghost" title="Excluir" onClick={() => onAction("delete")}><Trash2 className="h-4 w-4" /></Button></div></div>
  </div></Card>;
}

function PostDialog({ open, onOpenChange, draft, setDraft, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; draft: PostDraft; setDraft: React.Dispatch<React.SetStateAction<PostDraft>>; saving: boolean; onSave: () => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => { setUploading(true); try { const session = (await supabase.auth.getSession()).data.session; if (!session) throw new Error("Sessão expirada."); const ext = file.name.split('.').pop() || 'jpg'; const path = `social-posts/${session.user.id}/${Date.now()}.${ext}`; const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type, upsert: false }); if (error) throw error; const url = supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl; setDraft((old) => ({ ...old, media_url: url })); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar imagem."); } finally { setUploading(false); } };
  const toggle = (channel: string) => setDraft((old) => ({ ...old, channels: old.channels.includes(channel) ? old.channels.filter((item) => item !== channel) : [...old.channels, channel] }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{draft.id ? "Editar publicação" : "Nova publicação"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-[1fr_12rem]"><div className="space-y-4"><div><Label>Título interno</Label><Input value={draft.title} onChange={(e) => setDraft((old) => ({ ...old, title: e.target.value }))} placeholder="Ex.: Lembrete da palestra" /></div><div><Label>Texto da publicação *</Label><Textarea rows={8} value={draft.content_text} onChange={(e) => setDraft((old) => ({ ...old, content_text: e.target.value }))} placeholder="Escreva a mensagem que será publicada…" /></div><div><Label>Redes</Label><div className="mt-1 flex gap-2"><Button type="button" variant={draft.channels.includes("instagram") ? "default" : "outline"} onClick={() => toggle("instagram")}><Instagram className="mr-2 h-4 w-4" />Instagram</Button><Button type="button" variant={draft.channels.includes("facebook") ? "default" : "outline"} onClick={() => toggle("facebook")}><Facebook className="mr-2 h-4 w-4" />Facebook</Button></div></div><div><Label>Data e hora</Label><Input type="datetime-local" value={draft.scheduled_for} onChange={(e) => setDraft((old) => ({ ...old, scheduled_for: e.target.value }))} /></div></div><div><Label>Imagem</Label><label className="mt-1 flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted text-center text-xs text-muted-foreground">{draft.media_url ? <img src={draft.media_url} alt="Prévia" className="h-full w-full object-cover" /> : <><ImagePlus className="mb-2 h-7 w-7" />{uploading ? "Enviando…" : "Escolher imagem"}</>}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} /></label><p className="mt-2 text-xs text-muted-foreground">Obrigatória para Instagram.</p></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving || !draft.content_text.trim() || draft.channels.length === 0} onClick={onSave}>Salvar publicação</Button></DialogFooter></DialogContent></Dialog>;
}

function WorkReminderCard({ work, setting, onSaved }: { work: Work; setting: Center["settings"][number] | undefined; onSaved: () => void }) {
  const save = useServerFn(saveWorkSocialSetting);
  const [enabled, setEnabled] = useState(setting?.enabled ?? false);
  const [channels, setChannels] = useState<string[]>(setting?.channels ?? ["instagram", "facebook"]);
  const [reminders, setReminders] = useState((setting?.reminder_minutes ?? [10080, 1440]).join(", "));
  const [template, setTemplate] = useState(setting?.template_text ?? "Participe do {{work_name}} em {{date}} às {{time}}. {{location}}");
  const [mode, setMode] = useState<"manual" | "automatic">((setting?.approval_mode as "manual" | "automatic") ?? "manual");
  const [open, setOpen] = useState(false);
  const mutation = useMutation({ mutationFn: () => save({ data: { work_id: work.id, enabled, channels: channels as ("instagram" | "facebook")[], reminder_minutes: reminders.split(',').map((value) => Number(value.trim())).filter(Boolean), template_text: template, media_url: setting?.media_url ?? null, approval_mode: mode } }), onSuccess: () => { toast.success("Divulgação salva."); setOpen(false); onSaved(); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar.") });
  return <Card className="p-4"><div className="flex items-center gap-3"><Switch checked={enabled} onCheckedChange={setEnabled} aria-label={`Ativar divulgação de ${work.name}`} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{work.name}</h3><p className="text-xs text-muted-foreground">{work.recurrence === "weekly" ? "Trabalho semanal" : new Date(work.starts_at).toLocaleString("pt-BR")}</p></div>{enabled && <Badge variant="outline">{mode === "automatic" ? "Automático" : "Com aprovação"}</Badge>}<Button size="icon" variant="ghost" onClick={() => setOpen(!open)} title="Configurar"><Settings2 className="h-4 w-4" /></Button></div>{open && <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2"><div><Label>Redes</Label><div className="mt-1 flex gap-2">{['instagram','facebook'].map((channel) => <Button key={channel} size="sm" variant={channels.includes(channel) ? "default" : "outline"} onClick={() => setChannels((old) => old.includes(channel) ? old.filter((item) => item !== channel) : [...old, channel])}>{channel}</Button>)}</div></div><div><Label>Fluxo</Label><Select value={mode} onValueChange={(value) => setMode(value as "manual" | "automatic")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Criar rascunho para aprovação</SelectItem><SelectItem value="automatic">Agendar automaticamente</SelectItem></SelectContent></Select></div><div><Label>Minutos antes</Label><Input value={reminders} onChange={(e) => setReminders(e.target.value)} placeholder="10080, 1440" /><p className="mt-1 text-xs text-muted-foreground">Ex.: 10080 = 7 dias; 1440 = 1 dia.</p></div><div className="sm:col-span-2"><Label>Texto-base</Label><Textarea rows={3} value={template} onChange={(e) => setTemplate(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Use: {'{{work_name}}'}, {'{{date}}'}, {'{{time}}'} e {'{{location}}'}.</p></div><div className="sm:col-span-2 flex justify-end"><Button disabled={mutation.isPending || channels.length === 0} onClick={() => mutation.mutate()}>Salvar divulgação</Button></div></div>}</Card>;
}