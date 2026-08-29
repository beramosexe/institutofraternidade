import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Headphones, Filter, Star, Clock, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AudioCard, type AudioCardData } from "@/components/app/AudioCard";

type Row = AudioCardData & { audio_transcriptions: unknown; published_at: string | null; created_at: string };

function reviewStatus(a: { audio_transcriptions: unknown }) {
  const t = a.audio_transcriptions;
  const one = Array.isArray(t) ? t[0] : t;
  return (one as { review_status?: AudioCardData["review_status"] } | null)?.review_status ?? null;
}
function transcriptText(a: { audio_transcriptions: unknown }) {
  const t = a.audio_transcriptions;
  const one = Array.isArray(t) ? t[0] : t;
  return (one as { text?: string } | null)?.text ?? "";
}

export const Route = createFileRoute("/_authenticated/app/audios/")({
  component: AudiosLibrary,
  head: () => ({
    meta: [
      { title: "Biblioteca de áudios | Instituto Fraternidade" },
      { name: "description", content: "Canalizações e mensagens dos trabalhos do Instituto Fraternidade, com resumo, palavras-chave e transcrição sincronizada." },
    ],
  }),
});

function AudiosLibrary() {
  const [q, setQ] = useState("");
  const [workFilter, setWorkFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [keyword, setKeyword] = useState<string | null>(null);

  const { data: works } = useQuery({
    queryKey: ["works-options"],
    queryFn: async () =>
      (await supabase.from("works").select("id, name, color").order("starts_at", { ascending: false })).data ?? [],
  });

  const { data: audios, isLoading } = useQuery({
    queryKey: ["library-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select(`
          id, title, message_source, audio_type, access_level, recorded_at, status,
          summary, keywords, play_count, is_featured, duration_seconds, created_at, published_at,
          work_id, works(name, color),
          audio_transcriptions(id, text, review_status)
        `)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Row[];
    },
  });

  const prepared = useMemo(
    () => (audios ?? []).map((a) => ({ ...a, review_status: reviewStatus(a) })),
    [audios],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return prepared.filter((a) => {
      if (workFilter !== "all" && a.work_id !== workFilter) return false;
      if (typeFilter !== "all" && a.audio_type !== typeFilter) return false;
      if (accessFilter !== "all" && a.access_level !== accessFilter) return false;
      if (keyword && !(a.keywords ?? []).some((k) => k.toLowerCase() === keyword.toLowerCase())) return false;
      if (!term) return true;
      return (
        a.title.toLowerCase().includes(term) ||
        (a.message_source ?? "").toLowerCase().includes(term) ||
        (a.summary ?? "").toLowerCase().includes(term) ||
        (a.keywords ?? []).some((k) => k.toLowerCase().includes(term)) ||
        transcriptText(a).toLowerCase().includes(term)
      );
    });
  }, [prepared, q, workFilter, typeFilter, accessFilter, keyword]);

  const hasFilters = q.trim() !== "" || workFilter !== "all" || typeFilter !== "all" || accessFilter !== "all" || !!keyword;

  const recent = filtered.slice(0, 6);
  const featured = useMemo(
    () =>
      filtered
        .filter((a) => a.is_featured || (a.play_count ?? 0) > 0)
        .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (b.play_count ?? 0) - (a.play_count ?? 0))
        .slice(0, 6),
    [filtered],
  );

  const topKeywords = useMemo(() => {
    const count = new Map<string, number>();
    prepared.forEach((a) => (a.keywords ?? []).forEach((k) => count.set(k, (count.get(k) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
  }, [prepared]);

  function clearFilters() {
    setQ(""); setWorkFilter("all"); setTypeFilter("all"); setAccessFilter("all"); setKeyword(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Biblioteca</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Áudios</h1>
        <p className="mt-1 text-muted-foreground">
          Mensagens recebidas em nossos trabalhos. Busque por título, resumo, palavras-chave ou
          qualquer trecho da transcrição.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_150px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
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
          <Select value={accessFilter} onValueChange={setAccessFilter}>
            <SelectTrigger><SelectValue placeholder="Acesso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os acessos</SelectItem>
              <SelectItem value="public">Público</SelectItem>
              <SelectItem value="associates">Associados</SelectItem>
              <SelectItem value="work_participants">Participantes do trabalho</SelectItem>
              <SelectItem value="attendees_only">Somente presentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {topKeywords.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Palavras-chave:</span>
            {topKeywords.map((k) => (
              <Badge
                key={k}
                variant={keyword === k ? "default" : "outline"}
                className="cursor-pointer text-[11px]"
                onClick={() => setKeyword(keyword === k ? null : k)}
              >
                {k}
              </Badge>
            ))}
          </div>
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" /> Limpar filtros
          </Button>
        )}
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Headphones className="mx-auto mb-3 h-6 w-6" />
          Nenhum áudio encontrado.
        </Card>
      ) : (
        <div className="space-y-8">
          <Section title="Recentes" icon={<Clock className="h-4 w-4" />}>
            {recent.map((a) => <AudioCard key={a.id} audio={a} onKeyword={setKeyword} />)}
          </Section>

          {featured.length > 0 && (
            <Section title="Mais ouvidos e destaques" icon={<Star className="h-4 w-4" />}>
              {featured.map((a) => <AudioCard key={a.id} audio={a} onKeyword={setKeyword} />)}
            </Section>
          )}

          <Section title={`Todos os áudios (${filtered.length})`} icon={<Headphones className="h-4 w-4" />}>
            {filtered.map((a) => <AudioCard key={a.id} audio={a} onKeyword={setKeyword} />)}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
        <span className="text-brand">{icon}</span>
        {title}
      </h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
