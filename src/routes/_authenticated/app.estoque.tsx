import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Package, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createStockItem, deleteStockItem, listStockItems, listStockMovements,
  registerStockMovement, updateStockItem,
} from "@/lib/stock.functions";
import { listWorks } from "@/lib/works.functions";

export const Route = createFileRoute("/_authenticated/app/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Instituto Fraternidade" },
      { name: "description", content: "Gestão de estoque do Instituto Fraternidade: itens, entradas, saídas e alertas de estoque mínimo." },
      { property: "og:title", content: "Estoque — Instituto Fraternidade" },
      { property: "og:description", content: "Gestão de estoque: itens, movimentações e alertas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockPage,
});

type StockItem = {
  id: string; name: string; category: string | null; unit: string;
  quantity: number; min_quantity: number; location: string | null;
  notes: string | null; is_active: boolean;
};

const MOVEMENT_LABELS = { in: "Entrada", out: "Saída", adjustment: "Ajuste" } as const;

const fmtQty = (n: number) =>
  Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function StockPage() {
  const qc = useQueryClient();
  const itemsFn = useServerFn(listStockItems);
  const movementsFn = useServerFn(listStockMovements);
  const worksFn = useServerFn(listWorks);
  const createFn = useServerFn(createStockItem);
  const updateFn = useServerFn(updateStockItem);
  const deleteFn = useServerFn(deleteStockItem);
  const moveFn = useServerFn(registerStockMovement);

  const { data: items, isLoading } = useQuery({ queryKey: ["stock-items"], queryFn: () => itemsFn(), retry: false });
  const { data: movements } = useQuery({ queryKey: ["stock-movements"], queryFn: () => movementsFn({}), retry: false });
  const { data: works } = useQuery({ queryKey: ["works"], queryFn: () => worksFn(), retry: false });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["stock-items"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
  };

  // --- novo item ---
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("un");
  const [minQty, setMinQty] = useState("0");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name,
          category: category || undefined,
          unit: unit || "un",
          min_quantity: Number(minQty) || 0,
          location: location || undefined,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Item criado.");
      setNewOpen(false);
      setName(""); setCategory(""); setUnit("un"); setMinQty("0"); setLocation(""); setNotes("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- movimentação ---
  const [moveItem, setMoveItem] = useState<StockItem | null>(null);
  const [moveType, setMoveType] = useState<"in" | "out" | "adjustment">("in");
  const [moveQty, setMoveQty] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [moveWork, setMoveWork] = useState("");

  const move = useMutation({
    mutationFn: () =>
      moveFn({
        data: {
          item_id: moveItem!.id,
          type: moveType,
          quantity: Number(moveQty) || 0,
          reason: moveReason || undefined,
          work_id: moveWork || null,
        },
      }),
    onSuccess: () => {
      toast.success("Movimentação registrada.");
      setMoveItem(null);
      setMoveQty(""); setMoveReason(""); setMoveWork(""); setMoveType("in");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Item excluído."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (item: StockItem) => updateFn({ data: { id: item.id, is_active: !item.is_active } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const activeItems = (items ?? []).filter((i) => i.is_active);
  const lowStock = activeItems.filter((i) => Number(i.quantity) <= Number(i.min_quantity));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Gestão de estoque</h1>
          <p className="text-sm text-muted-foreground">
            Itens, entradas, saídas e alertas de estoque mínimo.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {lowStock.length > 0 && (
        <Card className="flex items-start gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {lowStock.length} {lowStock.length === 1 ? "item abaixo" : "itens abaixo"} do estoque mínimo
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {lowStock.map((i) => i.name).join(", ")}
            </p>
          </div>
        </Card>
      )}

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens ({activeItems.length})</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="mt-4">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : activeItems.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Nenhum item cadastrado. Clique em "Novo item" para começar.
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3 text-right">Quantidade</th>
                    <th className="px-4 py-3 text-right">Mínimo</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeItems.map((item) => {
                    const low = Number(item.quantity) <= Number(item.min_quantity);
                    return (
                      <tr key={item.id} className="bg-card">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.name}</div>
                          {item.notes && <div className="text-xs text-muted-foreground">{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.category ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.location ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={low ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>
                            {fmtQty(item.quantity)} {item.unit}
                          </span>
                          {low && <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700 dark:text-amber-300">Baixo</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {fmtQty(item.min_quantity)} {item.unit}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setMoveItem(item); setMoveType("in"); }}>
                              <ArrowUpCircle className="mr-1 h-4 w-4" /> Entrada
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setMoveItem(item); setMoveType("out"); }}>
                              <ArrowDownCircle className="mr-1 h-4 w-4" /> Saída
                            </Button>
                            <Button size="sm" variant="ghost" title="Ajustar saldo" onClick={() => { setMoveItem(item); setMoveType("adjustment"); }}>
                              <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Arquivar" onClick={() => toggleActive.mutate(item)}>
                              <Package className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" title="Excluir"
                              onClick={() => {
                                if (confirm(`Excluir "${item.name}" e todo o histórico de movimentações?`)) remove.mutate(item.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-4">
          {!movements || movements.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhuma movimentação registrada.</Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Qtd.</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Trabalho</th>
                    <th className="px-4 py-3">Registrado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.map((m) => (
                    <tr key={m.id} className="bg-card">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3 font-medium">{m.item_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={m.type === "out" ? "secondary" : "default"}>
                          {MOVEMENT_LABELS[m.type as keyof typeof MOVEMENT_LABELS]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{fmtQty(m.quantity)} {m.unit}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.reason ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.work_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.created_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog novo item */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo item de estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="si-name">Nome *</Label>
              <Input id="si-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Vela branca 7 dias" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="si-cat">Categoria</Label>
                <Input id="si-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Limpeza" />
              </div>
              <div>
                <Label htmlFor="si-unit">Unidade</Label>
                <Input id="si-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="un, kg, L…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="si-min">Estoque mínimo</Label>
                <Input id="si-min" type="number" min={0} step="any" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="si-loc">Local</Label>
                <Input id="si-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Armário 2" />
              </div>
            </div>
            <div>
              <Label htmlFor="si-notes">Observações</Label>
              <Textarea id="si-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={name.trim().length < 2 || create.isPending}>
              Criar item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog movimentação */}
      <Dialog open={!!moveItem} onOpenChange={(o) => !o && setMoveItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {MOVEMENT_LABELS[moveType]} — {moveItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["in", "out", "adjustment"] as const).map((t) => (
                <Button
                  key={t}
                  variant={moveType === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMoveType(t)}
                >
                  {MOVEMENT_LABELS[t]}
                </Button>
              ))}
            </div>
            {moveType === "adjustment" ? (
              <div>
                <Label htmlFor="mv-qty">Novo saldo ({moveItem?.unit})</Label>
                <Input id="mv-qty" type="number" min={0} step="any" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Saldo atual: {moveItem ? fmtQty(moveItem.quantity) : "—"} {moveItem?.unit}
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="mv-qty">Quantidade ({moveItem?.unit})</Label>
                <Input id="mv-qty" type="number" min={0} step="any" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="mv-reason">Motivo</Label>
              <Input id="mv-reason" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="Ex.: Compra, uso em trabalho…" />
            </div>
            <div>
              <Label>Trabalho relacionado (opcional)</Label>
              <Select value={moveWork} onValueChange={setMoveWork}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {(works ?? []).map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveItem(null)}>Cancelar</Button>
            <Button onClick={() => move.mutate()} disabled={!moveQty || Number(moveQty) < 0 || move.isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
