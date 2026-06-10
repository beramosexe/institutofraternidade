import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Headphones, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ACCESS_LEVEL_LABELS, REVIEW_STATUS_LABELS } from "@/lib/permissions";

type TranscriptionPreview = { id: string; text: string; review_status: "unreviewed" | "in_review" | "reviewed" } | null;
function getTranscription(a: { audio_transcriptions: unknown }): TranscriptionPreview {
  const t = a.audio_transcriptions;
  if (!t) return null;
  if (Array.isArray(t)) return (t[0] as TranscriptionPreview) ?? null;
  return t as TranscriptionPreview;
}

export const Route = createFileRoute("/_authenticated/app/audios/")({
  component: AudiosLibrary,
});

function AudiosLibrary() {
  const [q, setQ] = useState("");
  const [workFilter, setWorkFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: works } = useQuery({
    queryKey: ["works-options"],
    queryFn: async () => (await supabase.from("works").select("id, name").order("starts_at", { ascending: false })).data ?? [],
  });

  const { data: audios, isLoading } = useQuery({
    queryKey: ["library-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select(`
          id, title, message_source, audio_type, access_level, recorded_at, status,
          work_id, works(name),
          audio_transcriptions(id, text, review_status)
        `)
        .neq("status", "archived")
        .order("published_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!audios) return [];
    const term = q.trim().toLowerCase();
    return audios.filter((a) => {
      if (workFilter !== "all" && a.work_id !== workFilter) return false;
      if (typeFilter !== "all" && a.audio_type !== typeFilter) return false;
      if (!term) return true;
      return (
        a.title.toLowerCase().includes(term) ||
        a.message_source?.toLowerCase().includes(term) ||
        getTranscription(a)?.text?.toLowerCase().includes(term)
      );
    });
  }, [audios, q, workFilter, typeFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Biblioteca</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Áudios</h1>
        <p className="mt-1 text-muted-foreground">
          Mensagens recebidas em nossos trabalhos. Use os filtros e a busca por palavras
          na transcrição.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, autoria, palavras na transcrição…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={workFilter} onValueChange={setWorkFilter}>
            <SelectTrigger><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Trabalho" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os trabalhos</SelectItem>
              {works?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="canalizacao">Canalização</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-3">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Headphones className="mx-auto mb-3 h-6 w-6" />
            Nenhum áudio encontrado.
          </Card>
        ) : filtered.map((a) => {
          const transcription = getTranscription(a);
          return (
            <Link key={a.id} to="/app/audios/$id" params={{ id: a.id }}>
              <Card className="p-5 transition-colors hover:bg-accent/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl text-foreground">{a.title}</h2>
                    <p className="mt-1 text-sm text-brand">
                      {a.message_source ?? "—"}
                      {a.works?.name ? <span className="text-muted-foreground"> · {a.works.name}</span> : null}
                    </p>
                    {a.recorded_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Gravada em {format(new Date(a.recorded_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{ACCESS_LEVEL_LABELS[a.access_level]}</Badge>
                    {a.status !== "ready" && (
                      <Badge variant="outline">
                        {a.status === "transcribing" ? "Transcrevendo…" :
                          a.status === "error" ? "Erro" : a.status}
                      </Badge>
                    )}
                    {transcription && transcription.review_status !== "reviewed" && (
                      <Badge variant="outline" className="border-gold/40 bg-gold/10 text-foreground">
                        {REVIEW_STATUS_LABELS[transcription.review_status as keyof typeof REVIEW_STATUS_LABELS]}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
