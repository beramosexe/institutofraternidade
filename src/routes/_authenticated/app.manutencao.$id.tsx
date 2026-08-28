import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Banknote, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addMaintenanceQuote, deleteMaintenanceQuote, getMaintenanceTicket,
  sendQuoteToFinance, updateMaintenanceTicket,
} from "@/lib/maintenance.functions";
import { MAINTENANCE_STATUS_LABELS, PRIORITY_LABELS, type MaintenanceStatus } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/manutencao/$id")({
  head: () => ({
    meta: [
      { title: "Chamado de manutenção — Instituto Fraternidade" },
      { name: "description", content: "Detalhes do chamado de manutenção: orçamentos, decisões e histórico completo." },
      { property: "og:title", content: "Chamado de manutenção — Instituto Fraternidade" },
      { property: "og:description", content: "Orçamentos, decisões e histórico do chamado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketDetail,
});

const money = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const NEXT_STATUSES: MaintenanceStatus[] = [
  "analysis", "awaiting_quote", "in_progress", "done", "postponed", "returned", "cancelled",
];

function TicketDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getMaintenanceTicket);
  const updateFn = useServerFn(updateMaintenanceTicket);
  const quoteFn = useServerFn(addMaintenanceQuote);
  const delQuoteFn = useServerFn(deleteMaintenanceQuote);
  const financeFn = useServerFn(sendQuoteToFinance);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-ticket", id], queryFn: () => getFn({ data: { id } }), retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-ticket", id] });
    qc.invalidateQueries({ queryKey: ["maintenance-tickets"] });
  };

  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<MaintenanceStatus>("analysis");
  const [note, setNote] = useState("");

  const update = useMutation({
    mutationFn: () => updateFn({ data: { id, status: newStatus, note: note || undefined } }),
    onSuccess: () => {
      toast.success("Chamado atualizado.");
      setStatusOpen(false); setNote("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [qDescription, setQDescription] = useState("");

  const addQuote = useMutation({
    mutationFn: () => quoteFn({
      data: {
        ticket_id: id, supplier, amount: Number(amount) || 0,
        deadline: deadline || undefined, description: qDescription || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Orçamento registrado.");
      setQuoteOpen(false); setSupplier(""); setAmount(""); setDeadline(""); setQDescription("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendFinance = useMutation({
    mutationFn: () => financeFn({ data: { ticket_id: id } }),
    onSuccess: () => { toast.success("Enviado ao financeiro."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeQuote = useMutation({
    mutationFn: (quoteId: string) => delQuoteFn({ data: { id: quoteId } }),
    onSuccess: () => { toast.success("Orçamento removido."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="p-6 text-muted-foreground">Chamado não encontrado.</div>;

  const { ticket, quotes, events } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link to="/app/manutencao" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar aos chamados
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">{ticket.title}</h1>
          <p className="text-sm text-muted-foreground">
            Aberto por {ticket.created_by_name} em {dt(ticket.created_at)}
            {ticket.location ? ` • ${ticket.location}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{PRIORITY_LABELS[ticket.priority as keyof typeof PRIORITY_LABELS]}</Badge>
          <Badge>{MAINTENANCE_STATUS_LABELS[ticket.status as MaintenanceStatus] ?? ticket.status}</Badge>
        </div>
      </div>

      {ticket.description && (
        <Card className="p-4 text-sm whitespace-pre-wrap">{ticket.description}</Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setStatusOpen(true)}>Atualizar situação</Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setQuoteOpen(true)}>
          <Plus className="h-4 w-4" /> Registrar orçamento
        </Button>
        {quotes.length > 0 && (
          <Button size="sm" variant="outline" className="gap-2" onClick={() => sendFinance.mutate()} disabled={sendFinance.isPending}>
            <Banknote className="h-4 w-4" /> Enviar ao financeiro
          </Button>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Orçamentos ({quotes.length})</h2>
        {quotes.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum orçamento registrado.</Card>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <Card key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{q.supplier} — {money(q.amount)}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.deadline ? `Prazo: ${q.deadline} • ` : ""}Registrado por {q.created_by_name}
                  </div>
                  {q.description && <div className="mt-1 text-sm">{q.description}</div>}
                  {q.decision_note && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Decisão: {q.status} — {q.decision_note}
                      {q.decided_by_name ? ` (${q.decided_by_name})` : ""}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{q.status}</Badge>
                  <Button
                    size="sm" variant="ghost" title="Remover orçamento"
                    onClick={() => { if (confirm(`Remover o orçamento de ${q.supplier}?`)) removeQuote.mutate(q.id); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Histórico</h2>
        <Card className="divide-y divide-border">
          {events.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Sem movimentações.</div>
          ) : events.map((e) => (
            <div key={e.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {e.to_status ? (MAINTENANCE_STATUS_LABELS[e.to_status as MaintenanceStatus] ?? e.to_status) : "Atualização"}
                </span>
                <span className="text-xs text-muted-foreground">{dt(e.created_at)} • {e.actor_name}</span>
              </div>
              {e.note && <p className="mt-1 text-muted-foreground">{e.note}</p>}
            </div>
          ))}
        </Card>
      </section>

      {/* Dialog status */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atualizar situação do chamado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nova situação</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as MaintenanceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NEXT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{MAINTENANCE_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="st-note">
                Observação {newStatus === "returned" ? "(obrigatória ao devolver)" : "(opcional)"}
              </Label>
              <Textarea id="st-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => update.mutate()}
              disabled={update.isPending || (newStatus === "returned" && note.trim().length < 3)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog orçamento */}
      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar orçamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="q-sup">Fornecedor *</Label>
              <Input id="q-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="q-amount">Valor (R$) *</Label>
                <Input id="q-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="q-deadline">Prazo</Label>
                <Input id="q-deadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Ex.: 5 dias úteis" />
              </div>
            </div>
            <div>
              <Label htmlFor="q-desc">Escopo / observações</Label>
              <Textarea id="q-desc" rows={3} value={qDescription} onChange={(e) => setQDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>Cancelar</Button>
            <Button onClick={() => addQuote.mutate()} disabled={supplier.trim().length < 2 || !amount || addQuote.isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
