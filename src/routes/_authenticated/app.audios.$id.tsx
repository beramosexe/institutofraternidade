import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SyncedTranscript } from "@/components/app/SyncedTranscript";
import { getAudioStreamUrl } from "@/lib/audios.functions";
import { ACCESS_LEVEL_LABELS, AUDIO_STATUS_LABELS, REVIEW_STATUS_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/audios/$id")({
  component: AudioDetail,
});

function AudioDetail() {
  const { id } = Route.useParams();
  const streamFn = useServerFn(getAudioStreamUrl);

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
  });

  const { data: stream } = useQuery({
    queryKey: ["audio-stream", id],
    queryFn: () => streamFn({ data: { audio_id: id } }),
    enabled: !!audio && audio.status === "ready",
    staleTime: 50 * 60 * 1000,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!audio) return <div className="p-10 text-muted-foreground">Áudio não encontrado.</div>;

  const transcription = Array.isArray(audio.audio_transcriptions) ? audio.audio_transcriptions[0] : audio.audio_transcriptions;
  const segments = (transcription?.segments as { start: number; end: number; text: string }[] | null) ?? [];

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
        <Card className="flex items-center gap-3 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {audio.status === "transcribing" ? "Transcrevendo automaticamente. Aguarde alguns instantes…" :
           audio.status === "error" ? `Erro no processamento: ${audio.error_message ?? "tente novamente."}` :
           "Áudio em processamento."}
        </Card>
      ) : !stream ? (
        <Card className="p-6 text-muted-foreground">Preparando reprodução…</Card>
      ) : (
        <>
          {transcription && transcription.review_status !== "reviewed" && (
            <div className="rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-foreground">
              ⚠ Esta transcrição foi gerada automaticamente e ainda não foi revisada. Pode conter erros.
            </div>
          )}
          <SyncedTranscript src={stream.url} segments={segments} />
        </>
      )}
    </div>
  );
}
