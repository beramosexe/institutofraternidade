import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Headphones, SlidersHorizontal, Star, Clock, X, LayoutGrid, Rows3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [view, setView] = useState<"grid" | "row">("grid");

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

  const activeFilterCount =
    (workFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (accessFilter !== "all" ? 1 : 0) + (keyword ? 1 : 0);
  const hasFilters = q.trim() !== "" || activeFilterCount > 0;

  const recent = filtered.slice(0, 8);
  const featured = useMemo(
    () =>
      filtered
        .filter((a) => a.is_featured || (a.play_count ?? 0) > 0)
        .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (b.play_count ?? 0) - (a.play_count ?? 0))
        .slice(0, 8),
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

  const filterFields = (
    <div className="grid gap-2 sm:grid-cols-3">
      <Select value={workFilter} onValueChange={setWorkFilter}>
        <SelectTrigger><SelectValue placeholder="Trabalho" /></SelectTrigger>
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
  );

  const keywordChips = topKeywords.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5">
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
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-8 md:py-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-brand">Biblioteca</p>
          <h1 className="font-display text-2xl text-foreground md:text-3xl">Áudios</h1>
        </div>
        <div className="hidden shrink-0 items-center gap-1 rounded-md border border-border p-0.5 md:flex">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={() => setView("grid")}
            aria-label="Visualizar em grade"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "row" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={() => setView("row")}
            aria-label="Visualizar em lista"
          >
            <Rows3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Barra de busca + filtros */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar título, resumo ou transcrição…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0 gap-2 md:hidden">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && <Badge className="h-5 min-w-5 px-1">{activeFilterCount}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 pb-6">
                {filterFields}
                {keywordChips}
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-1 h-3 w-3" /> Limpar filtros
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="hidden md:block">{filterFields}</div>
        <div className="hidden md:block">{keywordChips}</div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" /> Limpar filtros
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Headphones className="mx-auto mb-3 h-6 w-6" />
          Nenhum áudio encontrado.
        </Card>
      ) : (
        <div className="space-y-7">
          {!hasFilters && (
            <>
              <Rail title="Recentes" icon={<Clock className="h-4 w-4" />}>
                {recent.map((a) => <AudioCard key={a.id} audio={a} variant="compact" />)}
              </Rail>

              {featured.length > 0 && (
                <Rail title="Mais ouvidos e destaques" icon={<Star className="h-4 w-4" />}>
                  {featured.map((a) => <AudioCard key={a.id} audio={a} variant="compact" />)}
                </Rail>
              )}
            </>
          )}

          <section className="space-y-3">
            <SectionTitle icon={<Headphones className="h-4 w-4" />}>
              {hasFilters ? `Resultados (${filtered.length})` : `Todos os áudios (${filtered.length})`}
            </SectionTitle>
            <div
              className={
                view === "grid"
                  ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid gap-2"
              }
            >
              {filtered.map((a) => (
                <AudioCard key={a.id} audio={a} onKeyword={setKeyword} variant={view} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-base text-foreground md:text-lg">
      <span className="text-brand">{icon}</span>
      {children}
    </h2>
  );
}

function Rail({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <div className="scroll-momentum -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {children}
      </div>
    </section>
  );
}
