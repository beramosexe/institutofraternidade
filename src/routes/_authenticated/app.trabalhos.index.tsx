import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listWorks } from "@/lib/works.functions";

export const Route = createFileRoute("/_authenticated/app/trabalhos/")({
  head: () => ({
    meta: [
      { title: "Trabalhos — Instituto Fraternidade" },
      { name: "description", content: "Agenda dos trabalhos e encontros do Instituto Fraternidade." },
      { property: "og:title", content: "Trabalhos — Instituto Fraternidade" },
      { property: "og:description", content: "Agenda dos trabalhos e encontros do Instituto Fraternidade." },
    ],
  }),
  component: WorksAgenda,
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MODALITY_LABELS: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
  hibrido: "Híbrido",
  externo: "Externo (fora da sede)",
};

function WorksAgenda() {
  const list = useServerFn(listWorks);
  const { data: works, isLoading } = useQuery({ queryKey: ["works-agenda"], queryFn: () => list() });

  const visible = (works ?? [])
    .filter((w) => w.status === "published" || w.status === "completed")
    .sort((a, b) => (a.recurrence === "weekly" ? -1 : 0) - (b.recurrence === "weekly" ? -1 : 0));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Geral</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Trabalhos</h1>
        <p className="mt-1 text-muted-foreground">Agenda dos trabalhos do Instituto.</p>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : visible.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-3 h-6 w-6" />
            Nenhum trabalho na agenda.
          </Card>
        ) : visible.map((w) => (
          <Card key={w.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl text-foreground">{w.name}</h2>
                <p className="text-sm text-brand">
                  {w.recurrence === "weekly" && w.recurrence_weekday != null && w.recurrence_time
                    ? `Semanal · ${WEEKDAYS[w.recurrence_weekday]} às ${w.recurrence_time.slice(0, 5)}`
                    : format(new Date(w.starts_at), "EEEE, d 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}
                </p>
                {w.location && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {w.location}
                  </p>
                )}
                {w.description && <p className="mt-3 text-sm text-muted-foreground">{w.description}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {w.modality && <Badge variant="outline">{MODALITY_LABELS[w.modality] ?? w.modality}</Badge>}
                {w.visibility === "public" && <Badge variant="secondary">Aberto</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Precisa criar ou editar um trabalho? Acesse{" "}
        <Link to="/app/admin/trabalhos" className="text-brand hover:underline">
          Gestão dos trabalhos e eventos
        </Link>
        .
      </p>
    </div>
  );
}
