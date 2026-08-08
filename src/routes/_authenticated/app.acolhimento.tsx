import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarCheck, Search } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listWorks } from "@/lib/works.functions";

export const Route = createFileRoute("/_authenticated/app/acolhimento")({
  head: () => ({
    meta: [
      { title: "Controle de presença — Instituto Fraternidade" },
      { name: "description", content: "Registre a presença dos participantes nos trabalhos do Instituto." },
      { property: "og:title", content: "Controle de presença — Instituto Fraternidade" },
      { property: "og:description", content: "Registre a presença dos participantes nos trabalhos do Instituto." },
    ],
  }),
  component: AcolhimentoPage,
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function AcolhimentoPage() {
  const list = useServerFn(listWorks);
  const { data: works, isLoading } = useQuery({ queryKey: ["acolhimento-works"], queryFn: () => list() });
  const [q, setQ] = useState("");

  const today = new Date();
  const active = useMemo(
    () => (works ?? []).filter((w) => w.status === "published" || w.status === "completed"),
    [works],
  );

  const todayWeekday = today.getDay();
  const nowList = active.filter(
    (w) =>
      (w.recurrence === "weekly" && w.recurrence_weekday === todayWeekday) ||
      isSameDay(new Date(w.starts_at), today) ||
      new Date(w.starts_at) > today,
  );

  const searchResults = q.trim().length > 1
    ? active.filter((w) => w.name.toLowerCase().includes(q.trim().toLowerCase()))
    : [];

  const when = (w: (typeof active)[number]) =>
    w.recurrence === "weekly" && w.recurrence_weekday != null && w.recurrence_time
      ? `Semanal · ${WEEKDAYS[w.recurrence_weekday]} às ${w.recurrence_time.slice(0, 5)}`
      : format(new Date(w.starts_at), "EEEE, d 'de' MMMM · HH:mm", { locale: ptBR });

  const Row = ({ w }: { w: (typeof active)[number] }) => (
    <Card key={w.id} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{w.name}</p>
          <p className="text-xs text-muted-foreground">
            {when(w)}
            {w.location ? ` · ${w.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {w.recurrence === "weekly" && <Badge variant="outline">Recorrente</Badge>}
          <Button asChild size="sm">
            <Link to="/app/trabalhos/$id/checkin" params={{ id: w.id }}>
              <CalendarCheck className="mr-2 h-4 w-4" /> Check-in
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Acolhimento</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Controle de presença</h1>
        <p className="mt-1 text-muted-foreground">
          Trabalhos de hoje e dos próximos dias. Use a busca para lançar presença retroativa.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Hoje e próximos</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : nowList.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">Nenhum trabalho previsto.</Card>
        ) : nowList.map((w) => <Row key={w.id} w={w} />)}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Buscar trabalho</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nome do trabalho…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {q.trim().length > 1 && (
          searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum trabalho encontrado.</p>
          ) : searchResults.map((w) => <Row key={w.id} w={w} />)
        )}
      </div>
    </div>
  );
}
