import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, ArrowLeft, Clock, Loader2, RefreshCw, Save, Sparkles,
  Star, ChevronDown, ChevronUp, Lock, Globe, Settings2, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SyncedTranscript, type Segment } from "@/components/app/SyncedTranscript";
import { useMyAccess } from "@/components/app/AppShell";
import {
  getAudioStreamUrl, failStaleTranscriptions, reprocessAudio,
  registerAudioPlay, setAudioFeatured,
} from "@/lib/audios.functions";
import { generateAudioInsights } from "@/lib/audio-insights.functions";
import { saveTranscription } from "@/lib/transcriptions.functions";
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
  const failStaleFn = useServerFn(failStaleTranscriptions);
  const reprocessFn = useServerFn(reprocessAudio);
  const insightsFn = useServerFn(generateAudioInsights);
  const playFn = useServerFn(registerAudioPlay);
  const featuredFn = useServerFn(setAudioFeatured);
  const { data: access } = useMyAccess();
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);

  const { data: audio, isLoading } = useQuery({
    queryKey: ["audio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audios")
        .select(`
          *, works(name, color),
          audio_transcriptions(id, text, segments, review_status, reviewed_at)
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
    const text = (t as { text?: string } | null)?.text;
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

  const [editing, setEditing] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // durationchange can fire repeatedly; only auto-generate timings once.
  const autoTimedRef = useRef<string | null>(null);

  useEffect(() => {
    setSegments((transcription?.segments as Segment[] | null) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription?.id]);


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

  function onChangeSegments(next: Segment[]) {
    setSegments(next);
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMutation.mutate(next), 1200);
  }

  // Provider may return text without timestamps: build evenly spread segments
  // from the real audio duration so the synced view (and editor) still works.
  function handleDurationKnown(duration: number) {
    if (!transcription?.text || segments.length > 0) return;
    if (autoTimedRef.current === transcription.id) return;
    const generated = segmentsFromText(transcription.text, duration);
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
  const keywords = (audio.keywords as string[] | null) ?? [];

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
              fallbackText={transcription?.text ?? undefined}
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
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{audio.summary}</p>
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
