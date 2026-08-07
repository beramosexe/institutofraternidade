import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SyncedTranscript, type Segment } from "@/components/app/SyncedTranscript";
import { getAudioStreamUrl } from "@/lib/audios.functions";
import { saveTranscription, markTranscriptionReviewed } from "@/lib/transcriptions.functions";
import { segmentsFromText } from "@/lib/transcript-segments";


export const Route = createFileRoute("/_authenticated/app/revisao/$id")({
  component: ReviewEditor,
});

function ReviewEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const streamFn = useServerFn(getAudioStreamUrl);
  const saveFn = useServerFn(saveTranscription);
  const markFn = useServerFn(markTranscriptionReviewed);

  const { data: audio, isLoading } = useQuery({
    queryKey: ["review-audio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audios")
        .select(`*, works(name), audio_transcriptions(id, text, segments, review_status, version, reviewed_at)`)
        .eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const t = audio ? (Array.isArray(audio.audio_transcriptions) ? audio.audio_transcriptions[0] : audio.audio_transcriptions) : null;
  const initialSegments = (t?.segments as Segment[] | null) ?? [];

  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t && segments.length === 0) setSegments((t.segments as Segment[] | null) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id]);

  const { data: stream } = useQuery({
    queryKey: ["audio-stream", id],
    queryFn: () => streamFn({ data: { audio_id: id } }),
    enabled: !!audio && audio.status === "ready",
    staleTime: 50 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (next: Segment[]) => {
      if (!t) return;
      await saveFn({ data: { transcription_id: t.id, segments: next } });
    },
  });

  function onChangeSegments(next: Segment[]) {
    setSegments(next);
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMutation.mutate(next, {
        onSuccess: () => setDirty(false),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
      });
    }, 1200);
  }

  // Provider may return text without timestamps: build evenly spread segments
  // from the real audio duration so the reviewer has something to adjust.
  function handleDurationKnown(duration: number) {
    if (!t?.text || segments.length > 0) return;
    if (autoTimedRef.current === t.id) return;
    const generated = segmentsFromText(t.text, duration);
    if (!generated.length) return;
    autoTimedRef.current = t.id;
    setSegments(generated);
    saveMutation.mutate(generated);
  }



  const markMutation = useMutation({
    mutationFn: async (reviewed: boolean) => {
      if (!t) return;
      // ensure latest saved
      if (dirty) await saveFn({ data: { transcription_id: t.id, segments } });
      await markFn({ data: { transcription_id: t.id, reviewed } });
    },
    onSuccess: () => {
      toast.success("Atualizado.");
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["review-audio", id] });
    },
  });

  if (isLoading || !audio) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!t) return <div className="p-10 text-muted-foreground">Transcrição ainda não disponível.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6 md:p-10">
      <Link to="/app/revisao" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar à fila
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Revisão</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">{audio.title}</h1>
          <p className="text-sm text-muted-foreground">
            {audio.message_source ?? "—"} {audio.works?.name ? ` · ${audio.works.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <Badge variant="outline" className="border-gold/40 bg-gold/10">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Salvando…
            </Badge>
          ) : saveMutation.isSuccess ? (
            <Badge variant="outline" className="border-brand/40 bg-brand/10">
              <Save className="mr-1 h-3 w-3" /> Salvo
            </Badge>
          ) : null}
          {t.review_status !== "reviewed" ? (
            <Button onClick={() => markMutation.mutate(true)} disabled={markMutation.isPending}>
              {markMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Marcar como revisada
            </Button>
          ) : (
            <Button variant="outline" onClick={() => markMutation.mutate(false)}>
              Pedir nova revisão
            </Button>
          )}
        </div>
      </div>

      {!stream ? (
        <Card className="p-6 text-muted-foreground">Preparando reprodução…</Card>
      ) : (
        <SyncedTranscript
          src={stream.url}
          segments={segments}
          editable
          editableTimestamps
          onChangeSegments={onChangeSegments}
          fallbackText={t?.text ?? undefined}
          onDurationKnown={handleDurationKnown}
        />

      )}
    </div>
  );
}
