import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, ArrowLeft, Clock, Loader2, RefreshCw, Save, Sparkles,
  Star, ChevronDown, ChevronUp, Lock, Globe, Settings2, FileText, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SyncedTranscript, type Segment } from "@/components/app/SyncedTranscript";
import { useMyAccess } from "@/components/app/AppShell";
import {
  getAudioStreamUrl, failStaleTranscriptions, reprocessAudio,
  registerAudioPlay, setAudioFeatured, updateAudio,
} from "@/lib/audios.functions";
import { generateAudioInsights } from "@/lib/audio-insights.functions";
import { normalizeTranscription, saveTranscription } from "@/lib/transcriptions.functions";
import { segmentsFromText } from "@/lib/transcript-segments";

import { ACCESS_LEVEL_LABELS, AUDIO_STATUS_LABELS, REVIEW_STATUS_LABELS } from "@/lib/permissions";


export const Route = createFileRoute("/_authenticated/app/audios/$id")({
  component: AudioDetail,
  head: () => ({
    meta: [
      { title: "Ouvir áudio | Instituto Fraternidade" },
      { name: "description", content: "Ouça uma mensagem do Instituto Fraternidade e acompanhe sua transcrição sincronizada." },
      { property: "og:title", content: "Ouvir áudio | Instituto Fraternidade" },
      { property: "og:description", content: "Ouça uma mensagem do Instituto Fraternidade e acompanhe sua transcrição sincronizada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AudioDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const streamFn = useServerFn(getAudioStreamUrl);
  const saveFn = useServerFn(saveTranscription);
  const normalizeFn = useServerFn(normalizeTranscription);
  const failStaleFn = useServerFn(failStaleTranscriptions);
  const reprocessFn = useServerFn(reprocessAudio);
  const insightsFn = useServerFn(generateAudioInsights);
  const playFn = useServerFn(registerAudioPlay);
  const featuredFn = useServerFn(setAudioFeatured);
  const updateAudioFn = useServerFn(updateAudio);
  const [metadataEditOpen, setMetadataEditOpen] = useState(false);
  const [metadataForm, setMetadataForm] = useState({
    title: "",
    description: "",
    access_level: "associates" as "public" | "associates" | "work_participants" | "attendees_only",
    audio_type: "canalizacao" as "canalizacao" | "outro",
    message_source: "",
    recorded_at: "",
    work_id: "",
  });
  const { data: access } = useMyAccess();
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const { data: audio, isLoading } = useQuery({
    queryKey: ["audio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audios")
        .select(`
          *, works(name, color),
          audio_transcriptions(id, text, segments, raw_text, raw_segments, normalized_text, normalized_segments, normalization_status, review_status, reviewed_at)
        `)

        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    // While transcribing, poll so the transcript appears without a reload.
    refetchInterval: (q) => (q.state.data?.status === "transcribing" ? 8000 : false),
  });

  // A job that never finished must not keep the audio stuck on "Transcrevendo…".
  useEffect(() => {
    if (audio?.status !== "transcribing") return;
    const stuckSince = Date.now() - new Date(audio.updated_at).getTime();
    if (stuckSince < 15 * 60 * 1000) return;
    failStaleFn({ data: { audio_id: id } })
      .then((r) => { if (r.failed) qc.invalidateQueries({ queryKey: ["audio", id] }); })
      .catch(() => { /* non-blocking */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio?.status, audio?.updated_at, id]);

  const reprocessMutation = useMutation({
    mutationFn: () => reprocessFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Transcrição reiniciada. Isso pode levar alguns minutos.");
      qc.invalidateQueries({ queryKey: ["audio", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao reprocessar"),
  });

  const insightsMutation = useMutation({
    mutationFn: (force: boolean) => insightsFn({ data: { audio_id: id, force } }),
    onSuccess: (r) => {
      if (!r.skipped) toast.success("Resumo e palavras-chave gerados pela IA.");
      qc.invalidateQueries({ queryKey: ["audio", id] });
      qc.invalidateQueries({ queryKey: ["library-audios"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar resumo"),
  });

  const metadataMutation = useMutation({
    mutationFn: () =>
      updateAudioFn({
        data: {
          id,
          patch: {
            title: metadataForm.title.trim(),
            description: metadataForm.description.trim() || null,
            access_level: metadataForm.access_level,
            audio_type: metadataForm.audio_type,
            message_source: metadataForm.message_source.trim() || null,
            recorded_at: metadataForm.recorded_at || null,
            work_id: metadataForm.work_id || null,
          },
        },
      }),
    onSuccess: () => {
      setMetadataEditOpen(false);
      qc.invalidateQueries({ queryKey: ["audio", id] });
      qc.invalidateQueries({ queryKey: ["library-audios"] });
      toast.success("Informações do áudio atualizadas.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar o áudio"),
  });

  const featuredMutation = useMutation({
    mutationFn: (featured: boolean) => featuredFn({ data: { id, featured } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audio", id] });
      qc.invalidateQueries({ queryKey: ["library-audios"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao destacar"),
  });

  // Gera o resumo automaticamente na primeira vez que a transcrição fica pronta.
  const insightsTriedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!audio || audio.status !== "ready" || audio.summary) return;
    const t = Array.isArray(audio.audio_transcriptions) ? audio.audio_transcriptions[0] : audio.audio_transcriptions;
    const text = (t as { text?: string; raw_text?: string; normalized_text?: string | null } | null)?.normalized_text
      ?? (t as { text?: string; raw_text?: string } | null)?.raw_text
      ?? (t as { text?: string } | null)?.text;
    if (!text || text.trim().length < 40) return;
    if (insightsTriedRef.current === id) return;
    insightsTriedRef.current = id;
    insightsMutation.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio?.status, audio?.summary, id]);


  const { data: stream } = useQuery({
    queryKey: ["audio-stream", id],
    queryFn: () => streamFn({ data: { audio_id: id } }),
    enabled: !!audio && audio.status === "ready",
    staleTime: 50 * 60 * 1000,
  });


  const transcription = audio
    ? (Array.isArray(audio.audio_transcriptions) ? audio.audio_transcriptions[0] : audio.audio_transcriptions)
    : null;

  const transcriptionData = transcription as {
    id: string;
    text?: string | null;
    segments?: unknown;
    raw_text?: string | null;
    raw_segments?: unknown;
    normalized_text?: string | null;
    normalized_segments?: unknown;
    normalization_status?: string | null;
    review_status: string;
  } | null;

  const displayText = transcriptionData?.normalized_text ?? transcriptionData?.raw_text ?? transcriptionData?.text ?? "";
  const displaySegments = (transcriptionData?.normalized_segments ?? transcriptionData?.raw_segments ?? transcriptionData?.segments ?? []) as Segment[];

  const [editing, setEditing] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // durationchange can fire repeatedly; only auto-generate timings once.
  const autoTimedRef = useRef<string | null>(null);

  useEffect(() => {
    setSegments(displaySegments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptionData?.id, transcriptionData?.normalized_segments, transcriptionData?.raw_segments, transcriptionData?.segments]);


  const saveMutation = useMutation({
    mutationFn: async (next: Segment[]) => {
      if (!transcription) return;
      await saveFn({ data: { transcription_id: transcription.id, segments: next } });
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["audio", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });


  const normalizeMutation = useMutation({
    mutationFn: () => {
      if (!transcription) throw new Error("Transcrição não disponível.");
      return normalizeFn({ data: { transcription_id: transcription.id } });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["audio", id] });
      setEditing(false);
      setDirty(false);
      toast.success(
        `Normalização concluída: ${result.sourceSegments} segmentos RAW → ${result.normalizedSegments} segmentos.`,
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao normalizar"),
  });

  function onChangeSegments(next: Segment[]) {
    setSegments(next);
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMutation.mutate(next), 1200);
  }

  // Provider may return text without timestamps: build evenly spread segments
  // from the real audio duration so the synced view (and editor) still works.
  function handleDurationKnown(duration: number) {
    if (!displayText || segments.length > 0) return;
    if (autoTimedRef.current === transcription.id) return;
    const generated = segmentsFromText(displayText, duration);
    if (!generated.length) return;
    autoTimedRef.current = transcription.id;
    setSegments(generated);
    saveMutation.mutate(generated);
  }



  if (isLoading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!audio) return <div className="p-10 text-muted-foreground">Áudio não encontrado.</div>;

  const perms: string[] = (access?.permissions as string[] | undefined) ?? [];
  const isOwner = !!access?.userId && audio.uploaded_by === access.userId;
  const canEditTimestamps =
    !!transcription &&
    (perms.includes("transcription.review") ||
      perms.includes("audio.edit_any") ||
      isOwner);
  const canReprocess = perms.includes("audio.reprocess") || perms.includes("audio.edit_any") || isOwner;
  const canFeature = perms.includes("audio.edit_any");
  const accent = (audio.works as { color?: string | null } | null)?.color || "hsl(var(--brand))";
  const restricted = audio.access_level !== "public";
  const canEditMetadata = isOwner || perms.includes("audio.edit_any");
  const keywords = (audio.keywords as string[] | null) ?? [];

  function openMetadataEditor() {
    setMetadataForm({
      title: audio.title,
      description: audio.description ?? "",
      access_level: audio.access_level,
      audio_type: audio.audio_type,
      message_source: audio.message_source ?? "",
      recorded_at: audio.recorded_at ?? "",
      work_id: audio.work_id ?? "",
    });
    setMetadataEditOpen(true);
  }
  const summaryIsLong = (audio.summary?.length ?? 0) > 360;

  const showManagement = canEditTimestamps || canReprocess || canFeature;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:px-8 md:py-7">
      <Link to="/app/audios" className="inline-flex min-h-9 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar à biblioteca
      </Link>

      <header className="border-l-4 pl-4" style={{ borderColor: accent }}>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: accent }}>
          {audio.message_source ?? "Mensagem"}
        </p>
        <h1 className="mt-1 font-display text-2xl text-foreground md:text-4xl">{audio.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {audio.works?.name && <span>{audio.works.name}</span>}
          {audio.recorded_at && (
            <span>· Gravada em {format(new Date(`${audio.recorded_at}T12:00:00`), "d 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
          )}
          {(audio.play_count ?? 0) > 0 && <span>· {audio.play_count} reproduções</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant={restricted ? "secondary" : "outline"} className="gap-1">
            {restricted ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {ACCESS_LEVEL_LABELS[audio.access_level]}
          </Badge>
          <Badge variant="outline">{AUDIO_STATUS_LABELS[audio.status]}</Badge>
          {transcription && (
            <Badge
              variant="outline"
              className={transcription.review_status === "reviewed"
                ? "border-brand/40 bg-brand/10 text-foreground"
                : "border-gold/40 bg-gold/10 text-foreground"}
            >
              Transcrição: {REVIEW_STATUS_LABELS[transcription.review_status as keyof typeof REVIEW_STATUS_LABELS]}
            </Badge>
          )}
        </div>

        {audio.description && (
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{audio.description}</p>
        )}
      </header>

      {canEditMetadata && (
        <div className="-mt-1 flex justify-end">
          <Button size="sm" variant="outline" onClick={openMetadataEditor}>
            <Pencil className="mr-2 h-4 w-4" /> Editar informações
          </Button>
        </div>
      )}

      <Dialog open={metadataEditOpen} onOpenChange={setMetadataEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar informações do áudio</DialogTitle>
            <DialogDescription>
              Altere os dados editoriais do áudio. O arquivo original no R2 não será reenviado nem reprocessado.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!metadataForm.title.trim() || metadataMutation.isPending) return;
              metadataMutation.mutate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="audio-title">Título</Label>
              <Input
                id="audio-title"
                value={metadataForm.title}
                onChange={(event) => setMetadataForm((current) => ({ ...current, title: event.target.value }))}
                maxLength={200}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="audio-description">Descrição</Label>
              <Textarea
                id="audio-description"
                value={metadataForm.description}
                onChange={(event) => setMetadataForm((current) => ({ ...current, description: event.target.value }))}
                maxLength={2000}
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={metadataForm.audio_type}
                  onValueChange={(value) => setMetadataForm((current) => ({ ...current, audio_type: value as typeof current.audio_type }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="canalizacao">Canalização</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Acesso</Label>
                <Select
                  value={metadataForm.access_level}
                  onValueChange={(value) => setMetadataForm((current) => ({ ...current, access_level: value as typeof current.access_level }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="associates">Associados</SelectItem>
                    <SelectItem value="work_participants">Participantes do trabalho</SelectItem>
                    <SelectItem value="attendees_only">Somente presentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="audio-message-source">Fonte da mensagem</Label>
                <Input
                  id="audio-message-source"
                  value={metadataForm.message_source}
                  onChange={(event) => setMetadataForm((current) => ({ ...current, message_source: event.target.value }))}
                  maxLength={200}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="audio-recorded-at">Data da gravação</Label>
                <Input
                  id="audio-recorded-at"
                  type="date"
                  value={metadataForm.recorded_at}
                  onChange={(event) => setMetadataForm((current) => ({ ...current, recorded_at: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Trabalho</Label>
              <WorkSelector
                value={metadataForm.work_id}
                onChange={(value) => setMetadataForm((current) => ({ ...current, work_id: value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMetadataEditOpen(false)} disabled={metadataMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={metadataMutation.isPending || !metadataForm.title.trim()}>
                {metadataMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {audio.status !== "ready" ? (
        audio.status === "error" ? (
          <Card className="space-y-3 p-6">
            <div className="flex items-start gap-3 text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-gold" />
              <div className="space-y-1">
                <p className="font-medium">Não foi possível transcrever este áudio.</p>
                <p className="text-sm text-muted-foreground">
                  {audio.error_message ?? "Ocorreu um erro no processamento."}
                </p>
              </div>
            </div>
            {canReprocess && (
              <Button
                size="sm"
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending}
              >
                {reprocessMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <RefreshCw className="mr-2 h-4 w-4" />}
                Transcrever novamente
              </Button>
            )}
          </Card>
        ) : (
          <Card className="space-y-3 p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {audio.status === "transcribing"
                ? "Transcrevendo automaticamente. Esta página atualiza sozinha quando terminar…"
                : "Áudio em processamento."}
            </div>
            {canReprocess && audio.status === "transcribing" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending}
              >
                {reprocessMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <RefreshCw className="mr-2 h-4 w-4" />}
                Reiniciar transcrição
              </Button>
            )}
          </Card>
        )
      ) : !stream ? (

        <Card className="p-6 text-muted-foreground">Preparando reprodução…</Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
          <main className="min-w-0 space-y-3">
            <SyncedTranscript
              src={stream.url}
              segments={segments}
              editable={editing}
              editableTimestamps={editing}
              onChangeSegments={onChangeSegments}
              fallbackText={displayText || undefined}
              onDurationKnown={handleDurationKnown}
              onFirstPlay={() => { playFn({ data: { id } }).catch(() => {}); }}
              accentColor={accent}
              compactTranscript={!transcriptExpanded}
              listMaxHeight={transcriptExpanded ? "none" : "56vh"}
              transcriptHeader={(
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
                      <FileText className="h-4 w-4" style={{ color: accent }} /> Transcrição sincronizada
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => setTranscriptExpanded((value) => !value)}
                    >
                      {transcriptExpanded ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
                      {transcriptExpanded ? "Recolher" : "Ver completa"}
                    </Button>
                  </div>
                  {transcription && transcription.review_status !== "reviewed" && (
                    <p className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-gold" />
                      Transcrição automática ainda não revisada; pode conter erros.
                    </p>
                  )}
                </div>
              )}
            />
          </main>

          <aside className="space-y-4 lg:sticky lg:top-5">
            {(audio.summary || keywords.length > 0 || canReprocess) && (
              <section className="space-y-3 border-t-2 border-border pt-4" style={{ borderTopColor: accent }}>
                <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
                  <Sparkles className="h-4 w-4" style={{ color: accent }} /> Sobre este áudio
                </h2>
                {audio.summary ? (
                  <div className="space-y-1.5">
                    <p className={`whitespace-pre-line text-sm leading-relaxed text-foreground ${summaryIsLong && !summaryExpanded ? "line-clamp-6" : ""}`}>
                      {audio.summary}
                    </p>
                    {summaryIsLong && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1 text-xs text-muted-foreground"
                        onClick={() => setSummaryExpanded((value) => !value)}
                      >
                        {summaryExpanded ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
                        {summaryExpanded ? "Ler menos" : "Ler mais"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {insightsMutation.isPending ? "Gerando resumo…" : "Resumo ainda não disponível."}
                  </p>
                )}
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((keyword) => <Badge key={keyword} variant="outline" className="text-[11px]">{keyword}</Badge>)}
                  </div>
                )}
              </section>
            )}

            {showManagement && (
              <section className="border-t border-border pt-3">
                <Button
                  variant="ghost"
                  className="h-9 w-full justify-between px-1"
                  onClick={() => setManagementOpen((value) => !value)}
                >
                  <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Ferramentas de gestão</span>
                  {managementOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {managementOpen && (
                  <div className="mt-2 grid gap-2">
                    {canEditTimestamps && (
                      <Button size="sm" variant={editing ? "default" : "outline"} className="justify-start" onClick={() => setEditing((value) => !value)}>
                        <Clock className="mr-2 h-4 w-4" /> {editing ? "Encerrar revisão" : "Revisar texto e tempos"}
                      </Button>
                    )}
                    {editing && (dirty ? (
                      <Badge variant="outline" className="justify-center border-gold/40 bg-gold/10"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Salvando…</Badge>
                    ) : saveMutation.isSuccess ? (
                      <Badge variant="outline" className="justify-center border-brand/40 bg-brand/10"><Save className="mr-1 h-3 w-3" /> Salvo</Badge>
                    ) : null)}
                    {canEditTimestamps && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="justify-start"
                        disabled={normalizeMutation.isPending || !transcriptionData?.raw_segments}
                        onClick={() => normalizeMutation.mutate()}
                      >
                        {normalizeMutation.isPending
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Sparkles className="mr-2 h-4 w-4" />}
                        {normalizeMutation.isPending
                          ? "Normalizando com IA…"
                          : transcriptionData?.normalization_status === "normalized"
                            ? "Re-normalizar com IA"
                            : "Normalizar com IA"}
                      </Button>
                    )}
                    {canReprocess && (
                      <Button size="sm" variant="outline" className="justify-start" disabled={insightsMutation.isPending} onClick={() => insightsMutation.mutate(true)}>
                        {insightsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {audio.summary ? "Gerar novo resumo" : "Gerar resumo"}
                      </Button>
                    )}
                    {canFeature && (
                      <Button size="sm" variant={audio.is_featured ? "secondary" : "outline"} className="justify-start" disabled={featuredMutation.isPending} onClick={() => featuredMutation.mutate(!audio.is_featured)}>
                        <Star className="mr-2 h-4 w-4" /> {audio.is_featured ? "Remover dos destaques" : "Adicionar aos destaques"}
                      </Button>
                    )}
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>
      )}
    </div>

  );
}


function WorkSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: works = [], isLoading } = useQuery({
    queryKey: ["works-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("id, name")
        .order("starts_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
      <SelectTrigger disabled={isLoading}>
        <SelectValue placeholder={isLoading ? "Carregando…" : "Nenhum trabalho"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Nenhum trabalho</SelectItem>
        {works.map((work) => (
          <SelectItem key={work.id} value={work.id}>{work.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
