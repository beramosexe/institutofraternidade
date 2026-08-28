import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMaintenanceTicket, listMaintenanceTickets, updateMaintenanceTicket } from "@/lib/maintenance.functions";
import { listPurchaseRequests, updatePurchaseRequest } from "@/lib/purchases.functions";
import { MAINTENANCE_STATUS_LABELS, PRIORITY_LABELS, PURCHASE_REQUEST_STATUS_LABELS, type MaintenanceStatus } from "@/lib/permissions";
import { useMyAccess } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Instituto Fraternidade" },
      { name: "description", content: "Fila de aprovação financeira do Instituto Fraternidade: orçamentos de manutenção e pedidos de compra." },
      { property: "og:title", content: "Financeiro — Instituto Fraternidade" },
      { property: "og:description", content: "Aprovações de orçamentos e pedidos de compra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const FINANCE_STATUSES: MaintenanceStatus[] = ["sent_to_finance", "in_approval", "approved"];

function FinancePage() {
  const qc = useQueryClient();
  const { data: access } = useMyAccess();
  const canApprove = !!access?.isAdmin || (access?.permissions ?? []).includes("finance.approve");

  const ticketsFn = useServerFn(listMaintenanceTickets);
  const updateTicketFn = useServerFn(updateMaintenanceTicket);
  const requestsFn = useServerFn(listPurchaseRequests);
  const updateRequestFn = useServerFn(updatePurchaseRequest);

  const { data: tickets } = useQuery({ queryKey: ["maintenance-tickets"], queryFn: () => ticketsFn({ data: {} }), retry: false });
  const { data: requests } = useQuery({ queryKey: ["purchase-requests"], queryFn: () => requestsFn({ data: {} }), retry: false });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-tickets"] });
    qc.invalidateQueries({ queryKey: ["purchase-requests"] });
  };

  const decideTicket = useMutation({
    mutationFn: (v: { id: string; status: MaintenanceStatus; note?: string }) => updateTicketFn({ data: v }),
    onSuccess: () => { toast.success("Decisão registrada."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideRequest = useMutation({
    mutationFn: (v: { id: string; status: string; decision_note?: string }) => updateRequestFn({ data: v }),
    onSuccess: () => { toast.success("Decisão registrada."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const financeTickets = (tickets ?? []).filter((t) => FINANCE_STATUSES.includes(t.status as MaintenanceStatus));
  const financeRequests = (requests ?? []).filter((r) => r.needs_finance && ["open", "in_finance"].includes(r.status));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="font-serif text-2xl">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Orçamentos e pedidos aguardando decisão financeira.
        </p>
      </div>

      {!canApprove && (
        <Card className="p-4 text-sm text-muted-foreground">
          Você tem acesso de consulta. A aprovação depende da permissão "Aprovar financeiro".
        </Card>
      )}

      <Tabs defaultValue="manutencao">
        <TabsList>
          <TabsTrigger value="manutencao">Manutenção ({financeTickets.length})</TabsTrigger>
          <TabsTrigger value="compras">Compras ({financeRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="manutencao" className="mt-4 space-y-2">
          {financeTickets.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Banknote className="h-6 w-6" /> Nada aguardando aprovação.
            </Card>
          ) : financeTickets.map((t) => (
            <Card key={t.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to="/app/manutencao/$id" params={{ id: t.id }} className="font-medium hover:underline">
                    {t.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {t.created_by_name} • {dt(t.created_at)}{t.location ? ` • ${t.location}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]}</Badge>
                  <Badge>{MAINTENANCE_STATUS_LABELS[t.status as MaintenanceStatus] ?? t.status}</Badge>
                </div>
              </div>
              {canApprove && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => decideTicket.mutate({ id: t.id, status: "approved", note: "Aprovado pelo financeiro" })}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      const reason = prompt("Motivo da não aprovação:");
                      if (reason?.trim()) decideTicket.mutate({ id: t.id, status: "rejected", note: reason });
                    }}>
                    Não aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decideTicket.mutate({ id: t.id, status: "postponed", note: "Postergado pelo financeiro" })}>
                    Postergar
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => {
                      const reason = prompt("Motivo da devolução:");
                      if (reason?.trim()) decideTicket.mutate({ id: t.id, status: "returned", note: reason });
                    }}>
                    Devolver
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="compras" className="mt-4 space-y-2">
          {financeRequests.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">Nenhum pedido aguardando aprovação.</Card>
          ) : financeRequests.map((r) => (
            <Card key={r.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.requested_by_name} • {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge>{PURCHASE_REQUEST_STATUS_LABELS[r.status as keyof typeof PURCHASE_REQUEST_STATUS_LABELS] ?? r.status}</Badge>
              </div>
              <ul className="text-sm text-muted-foreground">
                {(r.items ?? []).map((i: { id: string; name: string; quantity: number; unit: string }) => (
                  <li key={i.id}>• {i.name} — {i.quantity} {i.unit}</li>
                ))}
              </ul>
              {r.justification && <p className="text-sm">{r.justification}</p>}
              {canApprove && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => decideRequest.mutate({ id: r.id, status: "approved" })}>Aprovar</Button>
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      const reason = prompt("Motivo da não aprovação:");
                      if (reason?.trim()) decideRequest.mutate({ id: r.id, status: "rejected", decision_note: reason });
                    }}>
                    Não aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decideRequest.mutate({ id: r.id, status: "postponed" })}>
                    Postergar
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => {
                      const reason = prompt("Motivo da devolução:");
                      if (reason?.trim()) decideRequest.mutate({ id: r.id, status: "returned", decision_note: reason });
                    }}>
                    Devolver
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
