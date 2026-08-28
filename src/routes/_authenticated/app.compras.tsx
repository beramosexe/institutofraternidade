import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPurchase, listPurchaseRequests, listPurchases, updatePurchaseRequest } from "@/lib/purchases.functions";
import { listStockItems } from "@/lib/stock.functions";
import { PRIORITY_LABELS, PURCHASE_REQUEST_STATUS_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Instituto Fraternidade" },
      { name: "description", content: "Pedidos de compra e registro de compras realizadas do Instituto Fraternidade, com entrada automática no estoque." },
      { property: "og:title", content: "Compras — Instituto Fraternidade" },
      { property: "og:description", content: "Pedidos, aprovações e compras realizadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PurchasesPage,
});

const money = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const d = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR");

type Line = { item_id: string | null; name: string; unit: string; quantity: string; unit_price: string };

const emptyLine = (): Line => ({ item_id: null, name: "", unit: "unidade", quantity: "1", unit_price: "0" });

function PurchasesPage() {
  const qc = useQueryClient();
  const requestsFn = useServerFn(listPurchaseRequests);
  const purchasesFn = useServerFn(listPurchases);
  const updateRequestFn = useServerFn(updatePurchaseRequest);
  const createPurchaseFn = useServerFn(createPurchase);
  const stockFn = useServerFn(listStockItems);

  const { data: requests } = useQuery({ queryKey: ["purchase-requests"], queryFn: () => requestsFn({ data: {} }), retry: false });
  const { data: purchases } = useQuery({ queryKey: ["purchases"], queryFn: () => purchasesFn(), retry: false });
  const { data: stockItems } = useQuery({ queryKey: ["stock-items"], queryFn: () => stockFn(), retry: false });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchase-requests"] });
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["stock-items"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
  };

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: string; decision_note?: string }) => updateRequestFn({ data: v }),
    onSuccess: () => { toast.success("Pedido atualizado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---- nova compra ---- */
  const [open, setOpen] = useState(false);
  const [purchasedOn, setPurchasedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [applyStock, setApplyStock] = useState(true);
  const [requestId, setRequestId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const total = lines.reduce((s, l) => s + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);

  const create = useMutation({
    mutationFn: () => createPurchaseFn({
      data: {
        purchased_on: purchasedOn,
        supplier: supplier || undefined,
        notes: notes || undefined,
        request_id: requestId || null,
        apply_to_stock: applyStock,
        items: lines.filter((l) => l.name.trim()).map((l) => ({
          item_id: l.item_id,
          name: l.name,
          unit: l.unit,
          quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) || 0,
        })),
      },
    }),
    onSuccess: () => {
      toast.success("Compra registrada.");
      setOpen(false); setSupplier(""); setNotes(""); setRequestId(""); setLines([emptyLine()]);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const pendingRequests = (requests ?? []).filter((r) => !["purchased", "cancelled", "rejected"].includes(r.status));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos da casa, aprovações e registro das compras realizadas.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Registrar compra
        </Button>
      </div>

      <Tabs defaultValue="pedidos">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos ({pendingRequests.length})</TabsTrigger>
          <TabsTrigger value="compras">Compras realizadas</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-4 space-y-2">
          {(requests ?? []).length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <ShoppingCart className="h-6 w-6" /> Nenhum pedido registrado.
            </Card>
          ) : (requests ?? []).map((r) => (
            <Card key={r.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.requested_by_name} • {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    {r.needs_finance ? " • precisa do financeiro" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PRIORITY_LABELS[r.priority as keyof typeof PRIORITY_LABELS]}</Badge>
                  <Badge>{PURCHASE_REQUEST_STATUS_LABELS[r.status as keyof typeof PURCHASE_REQUEST_STATUS_LABELS] ?? r.status}</Badge>
                </div>
              </div>
              <ul className="text-sm text-muted-foreground">
                {(r.items ?? []).map((i: { id: string; name: string; quantity: number; unit: string }) => (
                  <li key={i.id}>• {i.name} — {i.quantity} {i.unit}</li>
                ))}
              </ul>
              {r.justification && <p className="text-sm">{r.justification}</p>}
              {r.decision_note && <p className="text-xs text-muted-foreground">Decisão: {r.decision_note}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {!r.needs_finance && (
                  <Button size="sm" variant="outline"
                    onClick={() => setStatus.mutate({ id: r.id, needs_finance: true, status: "in_finance" } as never)}>
                    Enviar ao financeiro
                  </Button>
                )}
                <Button size="sm" variant="outline"
                  onClick={() => setStatus.mutate({ id: r.id, status: "postponed" })}>
                  Postergar
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => {
                    const reason = prompt("Motivo da devolução:");
                    if (reason?.trim()) setStatus.mutate({ id: r.id, status: "returned", decision_note: reason });
                  }}>
                  Devolver
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => { if (confirm("Cancelar este pedido?")) setStatus.mutate({ id: r.id, status: "cancelled" }); }}>
                  Cancelar
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="compras" className="mt-4 space-y-2">
          {(purchases ?? []).length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">Nenhuma compra registrada.</Card>
          ) : (purchases ?? []).map((p) => (
            <Card key={p.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{p.supplier ?? "Compra"} — {money(p.total_amount)}</div>
                  <div className="text-xs text-muted-foreground">
                    {d(p.purchased_on)} • {p.purchased_by_name}
                    {p.applied_to_stock ? " • lançada no estoque" : ""}
                  </div>
                </div>
                <Badge variant="outline">{(p.items ?? []).length} itens</Badge>
              </div>
              <ul className="text-sm text-muted-foreground">
                {(p.items ?? []).map((i: { id: string; name: string; quantity: number; unit: string; total_price: number }) => (
                  <li key={i.id}>• {i.name} — {i.quantity} {i.unit} — {money(i.total_price)}</li>
                ))}
              </ul>
              {p.notes && <p className="text-sm">{p.notes}</p>}
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Dialog nova compra */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Registrar compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="p-date">Data *</Label>
                <Input id="p-date" type="date" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="p-sup">Fornecedor</Label>
                <Input id="p-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
              <div>
                <Label>Pedido relacionado</Label>
                <Select value={requestId} onValueChange={setRequestId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    {pendingRequests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Itens</Label>
              {lines.map((l, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_90px_90px_110px_40px]">
                  <Input
                    placeholder="Nome do item"
                    value={l.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const match = (stockItems ?? []).find((s) => s.name.toLowerCase() === name.toLowerCase());
                      updateLine(idx, { name, item_id: match?.id ?? null, unit: match?.unit ?? l.unit });
                    }}
                    list="stock-item-names"
                  />
                  <Input placeholder="Un." value={l.unit} onChange={(e) => updateLine(idx, { unit: e.target.value })} />
                  <Input type="number" min={0} step="any" placeholder="Qtd" value={l.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                  <Input type="number" min={0} step="0.01" placeholder="Valor un." value={l.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                  <Button variant="ghost" size="sm" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <datalist id="stock-item-names">
                {(stockItems ?? []).map((s) => <option key={s.id} value={s.name} />)}
              </datalist>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                <Plus className="h-4 w-4" /> Adicionar item
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="p-stock" checked={applyStock} onCheckedChange={(v) => setApplyStock(!!v)} />
              <Label htmlFor="p-stock" className="font-normal">
                Lançar entrada no estoque para itens vinculados
              </Label>
            </div>

            <div>
              <Label htmlFor="p-notes">Observações</Label>
              <Textarea id="p-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <p className="text-right text-sm font-medium">Total: {money(total)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !lines.some((l) => l.name.trim())}>
              Registrar compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
