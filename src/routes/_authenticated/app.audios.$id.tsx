import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, ArrowLeft, Clock, Loader2, RefreshCw, Save, Sparkles,
  Star, ChevronDown, ChevronUp, Lock, Globe,
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
});

function AudioDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const streamFn = useServerFn(getAudioStreamUrl);
  const saveFn = useServerFn(saveTranscription);
  const failStaleFn = useServerFn(failStaleTranscriptions);
  const reprocessFn = useServerFn(reprocessAudio);
  const { data: access } = useMyAccess();

  const { data: audio, isLoading } = useQuery({
    queryKey: ["audio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audios")
        .select(`
          *, works(name),
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


  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <Link to="/app/audios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar à biblioteca
      </Link>

      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">{audio.message_source ?? "Mensagem"}</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">{audio.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {audio.works?.name && <span>{audio.works.name}</span>}
          {audio.recorded_at && (
            <span>· Gravada em {format(new Date(audio.recorded_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{ACCESS_LEVEL_LABELS[audio.access_level]}</Badge>
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
          <p className="mt-4 whitespace-pre-line text-muted-foreground">{audio.description}</p>
        )}
      </div>

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
        <>
          {transcription && transcription.review_status !== "reviewed" && (
            <div className="rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-foreground">
              ⚠ Esta transcrição foi gerada automaticamente e ainda não foi revisada. Pode conter erros.
            </div>
          )}

          {canEditTimestamps && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={editing ? "default" : "outline"}
                onClick={() => setEditing((v) => !v)}
              >
                <Clock className="mr-2 h-4 w-4" />
                {editing ? "Sair do ajuste de tempos" : "Ajustar tempos e texto"}
              </Button>
              {editing && (dirty ? (
                <Badge variant="outline" className="border-gold/40 bg-gold/10">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Salvando…
                </Badge>
              ) : saveMutation.isSuccess ? (
                <Badge variant="outline" className="border-brand/40 bg-brand/10">
                  <Save className="mr-1 h-3 w-3" /> Salvo
                </Badge>
              ) : null)}
            </div>
          )}

          <SyncedTranscript
            src={stream.url}
            segments={segments}
            editable={editing}
            editableTimestamps={editing}
            onChangeSegments={onChangeSegments}
            fallbackText={transcription?.text ?? undefined}
            onDurationKnown={handleDurationKnown}
          />

        </>
      )}
    </div>
  );
}
