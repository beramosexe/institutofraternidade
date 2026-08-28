import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PackageSearch, Plus, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMaintenanceTicket, listMaintenanceTickets } from "@/lib/maintenance.functions";
import { createPurchaseRequest, listPurchaseRequests } from "@/lib/purchases.functions";
import {
  MAINTENANCE_STATUS_LABELS, PRIORITY_LABELS, PURCHASE_REQUEST_STATUS_LABELS,
  type MaintenanceStatus,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/casa")({
  head: () => ({
    meta: [
      { title: "Painel da Casa — Instituto Fraternidade" },
      { name: "description", content: "Abra chamados de manutenção e avise a falta de itens da casa do Instituto Fraternidade." },
      { property: "og:title", content: "Painel da Casa — Instituto Fraternidade" },
      { property: "og:description", content: "Chamados de manutenção e avisos de falta de itens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HousePanel,
});

const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function HousePanel() {
  const qc = useQueryClient();
  const ticketsFn = useServerFn(listMaintenanceTickets);
  const requestsFn = useServerFn(listPurchaseRequests);
  const createTicketFn = useServerFn(createMaintenanceTicket);
  const createRequestFn = useServerFn(createPurchaseRequest);

  const { data: tickets } = useQuery({
    queryKey: ["my-tickets"], queryFn: () => ticketsFn({ data: { mine: true } }), retry: false,
  });
  const { data: requests } = useQuery({
    queryKey: ["my-purchase-requests"], queryFn: () => requestsFn({ data: { mine: true } }), retry: false,
  });

  /* --- chamado de manutenção --- */
  const [ticketOpen, setTicketOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");

  const createTicket = useMutation({
    mutationFn: () => createTicketFn({
      data: {
        title, description: description || undefined,
        location: location || undefined, priority,
      },
    }),
    onSuccess: () => {
      toast.success("Chamado aberto. A equipe de manutenção foi avisada.");
      setTicketOpen(false); setTitle(""); setDescription(""); setLocation(""); setPriority("normal");
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* --- falta de item --- */
  const [needOpen, setNeedOpen] = useState(false);
  const [needTitle, setNeedTitle] = useState("");
  const [needItem, setNeedItem] = useState("");
  const [needQty, setNeedQty] = useState("1");
  const [needUnit, setNeedUnit] = useState("unidade");
  const [needWhy, setNeedWhy] = useState("");

  const createRequest = useMutation({
    mutationFn: () => createRequestFn({
      data: {
        title: needTitle || needItem,
        justification: needWhy || undefined,
        items: [{ name: needItem, quantity: Number(needQty) || 1, unit: needUnit }],
      },
    }),
    onSuccess: () => {
      toast.success("Aviso enviado à equipe de compras.");
      setNeedOpen(false); setNeedTitle(""); setNeedItem(""); setNeedQty("1"); setNeedWhy("");
      qc.invalidateQueries({ queryKey: ["my-purchase-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="font-serif text-2xl">Painel da Casa</h1>
        <p className="text-sm text-muted-foreground">
          Aqui você cuida da casa junto com a gente: avise problemas de manutenção e itens que estão faltando.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <Wrench className="h-6 w-6 text-slate-500" />
          <div>
            <h2 className="font-medium">Solicitar manutenção</h2>
            <p className="text-sm text-muted-foreground">
              Algo quebrado, com defeito ou precisando de reparo na casa.
            </p>
          </div>
          <Button className="mt-auto gap-2" onClick={() => setTicketOpen(true)}>
            <Plus className="h-4 w-4" /> Abrir chamado
          </Button>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <PackageSearch className="h-6 w-6 text-amber-600" />
          <div>
            <h2 className="font-medium">Avisar falta de item</h2>
            <p className="text-sm text-muted-foreground">
              Materiais, insumos ou itens de estoque que precisam ser repostos.
            </p>
          </div>
          <Button variant="outline" className="mt-auto gap-2" onClick={() => setNeedOpen(true)}>
            <Plus className="h-4 w-4" /> Avisar falta
          </Button>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Meus chamados de manutenção</h2>
        {!tickets || tickets.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Você ainda não abriu chamados.</Card>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.location ? `${t.location} • ` : ""}Aberto em {dt(t.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]}</Badge>
                  <Badge>{MAINTENANCE_STATUS_LABELS[t.status as MaintenanceStatus] ?? t.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Meus avisos de falta / pedidos</h2>
        {!requests || requests.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum aviso enviado.</Card>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {(r.items ?? []).map((i: { name: string; quantity: number; unit: string }) =>
                      `${i.name} (${i.quantity} ${i.unit})`).join(", ")}
                  </div>
                </div>
                <Badge>{PURCHASE_REQUEST_STATUS_LABELS[r.status as keyof typeof PURCHASE_REQUEST_STATUS_LABELS] ?? r.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Dialog chamado */}
      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir chamado de manutenção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mt-title">O que precisa de manutenção? *</Label>
              <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Lâmpada queimada no salão" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="mt-loc">Local</Label>
                <Input id="mt-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Salão principal" />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="mt-desc">Detalhes</Label>
              <Textarea id="mt-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketOpen(false)}>Cancelar</Button>
            <Button onClick={() => createTicket.mutate()} disabled={title.trim().length < 3 || createTicket.isPending}>
              Abrir chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog falta de item */}
      <Dialog open={needOpen} onOpenChange={setNeedOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Avisar falta de item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pr-item">Item em falta *</Label>
              <Input id="pr-item" value={needItem} onChange={(e) => setNeedItem(e.target.value)} placeholder="Ex.: Vela branca 7 dias" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pr-qty">Quantidade</Label>
                <Input id="pr-qty" type="number" min={0} step="any" value={needQty} onChange={(e) => setNeedQty(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pr-unit">Unidade</Label>
                <Input id="pr-unit" value={needUnit} onChange={(e) => setNeedUnit(e.target.value)} placeholder="unidade, caixa, kg…" />
              </div>
            </div>
            <div>
              <Label htmlFor="pr-title">Título do pedido (opcional)</Label>
              <Input id="pr-title" value={needTitle} onChange={(e) => setNeedTitle(e.target.value)} placeholder="Usa o nome do item se vazio" />
            </div>
            <div>
              <Label htmlFor="pr-why">Para que será usado</Label>
              <Textarea id="pr-why" rows={2} value={needWhy} onChange={(e) => setNeedWhy(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeedOpen(false)}>Cancelar</Button>
            <Button onClick={() => createRequest.mutate()} disabled={needItem.trim().length < 2 || createRequest.isPending}>
              Enviar aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
