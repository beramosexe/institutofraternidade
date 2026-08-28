import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteOption, listOptions, upsertOption } from "@/lib/options.functions";

export const Route = createFileRoute("/_authenticated/app/admin/listas")({
  head: () => ({
    meta: [
      { title: "Listas configuráveis — Instituto Fraternidade" },
      { name: "description", content: "Configure as opções dos formulários do Instituto Fraternidade: locais, categorias, unidades e mais." },
      { property: "og:title", content: "Listas configuráveis — Instituto Fraternidade" },
      { property: "og:description", content: "Opções dos formulários do sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OptionsAdmin,
});

const LISTS = [
  { value: "maintenance_location", label: "Locais da casa (manutenção)" },
  { value: "maintenance_category", label: "Categorias de manutenção" },
  { value: "stock_category", label: "Categorias de estoque" },
  { value: "stock_unit", label: "Unidades de medida" },
  { value: "work_modality", label: "Modalidades de trabalho" },
  { value: "audio_keyword", label: "Palavras-chave sugeridas (áudios)" },
] as const;

function OptionsAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOptions);
  const upsertFn = useServerFn(upsertOption);
  const deleteFn = useServerFn(deleteOption);

  const [list, setList] = useState<string>(LISTS[0].value);
  const [label, setLabel] = useState("");

  const { data: options, isLoading } = useQuery({
    queryKey: ["options", list],
    queryFn: () => listFn({ data: { list, includeInactive: true } }),
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["options"] });

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { list, label } }),
    onSuccess: () => { toast.success("Opção adicionada."); setLabel(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (o: { id: string; list: string; label: string; is_active: boolean }) =>
      upsertFn({ data: { id: o.id, list: o.list, label: o.label, is_active: !o.is_active } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Opção removida."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to="/app/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao Admin
      </Link>

      <div>
        <h1 className="font-serif text-2xl">Listas configuráveis</h1>
        <p className="text-sm text-muted-foreground">
          As opções abaixo aparecem nos menus suspensos dos formulários do sistema.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <Label>Lista</Label>
          <Select value={list} onValueChange={setList}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LISTS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="op-label">Nova opção</Label>
            <Input id="op-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Salão principal" />
          </div>
          <Button className="gap-2" onClick={() => save.mutate()} disabled={label.trim().length < 1 || save.isPending}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (options ?? []).length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma opção nesta lista.</Card>
      ) : (
        <div className="space-y-2">
          {(options ?? []).map((o) => (
            <Card key={o.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="font-medium">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.value}</div>
              </div>
              <div className="flex items-center gap-2">
                {!o.is_active && <Badge variant="outline">Inativa</Badge>}
                <Button size="sm" variant="outline" onClick={() => toggle.mutate(o)}>
                  {o.is_active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => { if (confirm(`Remover "${o.label}"?`)) remove.mutate(o.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
