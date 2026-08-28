import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMaintenanceTickets } from "@/lib/maintenance.functions";
import { MAINTENANCE_STATUS_LABELS, PRIORITY_LABELS, type MaintenanceStatus } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/manutencao/")({
  head: () => ({
    meta: [
      { title: "Manutenção — Instituto Fraternidade" },
      { name: "description", content: "Gestão dos chamados de manutenção do Instituto Fraternidade: análise, orçamentos, aprovação e execução." },
      { property: "og:title", content: "Manutenção — Instituto Fraternidade" },
      { property: "og:description", content: "Chamados, orçamentos e execução de manutenções." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaintenanceList,
});

const OPEN_STATUSES: MaintenanceStatus[] = [
  "open", "analysis", "awaiting_quote", "quote_received", "sent_to_finance",
  "in_approval", "approved", "in_progress", "returned", "postponed",
];

const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function MaintenanceList() {
  const fn = useServerFn(listMaintenanceTickets);
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["maintenance-tickets"], queryFn: () => fn({ data: {} }), retry: false,
  });
  const [tab, setTab] = useState<"abertos" | "todos">("abertos");

  const rows = (tickets ?? []).filter((t) =>
    tab === "todos" ? true : OPEN_STATUSES.includes(t.status as MaintenanceStatus));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Manutenção</h1>
          <p className="text-sm text-muted-foreground">
            Chamados da casa, orçamentos e acompanhamento até a conclusão.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "abertos" ? "default" : "outline"} size="sm" onClick={() => setTab("abertos")}>
            Em andamento
          </Button>
          <Button variant={tab === "todos" ? "default" : "outline"} size="sm" onClick={() => setTab("todos")}>
            Todos
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <Wrench className="h-6 w-6" />
          Nenhum chamado {tab === "abertos" ? "em andamento" : "registrado"}.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <Link
              key={t.id}
              to="/app/manutencao/$id"
              params={{ id: t.id }}
              className="block"
            >
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-accent/40">
                <div className="min-w-0">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.location ? `${t.location} • ` : ""}
                    {t.created_by_name} • {dt(t.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]}</Badge>
                  <Badge>{MAINTENANCE_STATUS_LABELS[t.status as MaintenanceStatus] ?? t.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
