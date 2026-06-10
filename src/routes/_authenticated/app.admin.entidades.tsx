import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { listEntities, createEntity, updateEntity, deleteEntity } from "@/lib/entities.functions";

export const Route = createFileRoute("/_authenticated/app/admin/entidades")({
  component: AdminEntities,
});

type EntityRow = Awaited<ReturnType<typeof listEntities>>[number];

function AdminEntities() {
  const list = useServerFn(listEntities);
  const create = useServerFn(createEntity);
  const update = useServerFn(updateEntity);
  const del = useServerFn(deleteEntity);
  const qc = useQueryClient();

  const { data: entities } = useQuery({ queryKey: ["admin-entities"], queryFn: () => list() });
  const [editing, setEditing] = useState<EntityRow | null>(null);
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: async (vals: { id?: string; name: string; description?: string | null; is_active?: boolean }) => {
      const { id, ...rest } = vals;
      if (id) await update({ data: { id, patch: rest } });
      else await create({ data: rest });
    },
    onSuccess: () => {
      toast.success("Entidade salva.");
      qc.invalidateQueries({ queryKey: ["admin-entities"] });
      qc.invalidateQueries({ queryKey: ["entities-all"] });
      qc.invalidateQueries({ queryKey: ["entities-for-work"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Entidade removida.");
      qc.invalidateQueries({ queryKey: ["admin-entities"] });
      qc.invalidateQueries({ queryKey: ["entities-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Entidades canalizadoras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lista de mentores, guias e entidades que aparecem nos menus de "Mensagem de quem".
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" /> Nova entidade
            </Button>
          </DialogTrigger>
          <EntityDialog initial={editing} onSubmit={(v) => mut.mutate(v)} saving={mut.isPending} />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {(entities ?? []).length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">Nenhuma entidade cadastrada.</Card>
        ) : entities?.map((e) => (
          <Card key={e.id} className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg text-foreground">{e.name}</h2>
                {!e.is_active && <Badge variant="outline">Inativa</Badge>}
              </div>
              {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => { setEditing(e); setOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => {
                if (confirm(`Excluir "${e.name}"?`)) delMut.mutate(e.id);
              }}>
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EntityDialog({
  initial, onSubmit, saving,
}: {
  initial: EntityRow | null;
  onSubmit: (v: { id?: string; name: string; description?: string | null; is_active?: boolean }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar entidade" : "Nova entidade"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id: initial?.id, name: name.trim(), description: description.trim() || null, is_active: isActive });
      }}>
        <div>
          <Label>Nome *</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
          <Label htmlFor="active" className="cursor-pointer">Ativa (aparece nos menus)</Label>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
