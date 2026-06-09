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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listWorks, createWork, updateWork, deleteWork } from "@/lib/works.functions";
import { WORK_STATUS_LABELS } from "@/lib/permissions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/admin/trabalhos")({
  component: AdminWorks,
});

type WorkRow = Awaited<ReturnType<typeof listWorks>>[number];

function AdminWorks() {
  const list = useServerFn(listWorks);
  const create = useServerFn(createWork);
  const update = useServerFn(updateWork);
  const del = useServerFn(deleteWork);
  const qc = useQueryClient();

  const { data: works } = useQuery({ queryKey: ["admin-works"], queryFn: () => list() });
  const [editing, setEditing] = useState<WorkRow | null>(null);
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: async (vals: Parameters<typeof create>[0]["data"] & { id?: string }) => {
      const { id, ...rest } = vals;
      if (id) await update({ data: { id, patch: rest } });
      else await create({ data: rest });
    },
    onSuccess: () => {
      toast.success("Trabalho salvo.");
      qc.invalidateQueries({ queryKey: ["admin-works"] });
      qc.invalidateQueries({ queryKey: ["works-options"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Trabalho removido.");
      qc.invalidateQueries({ queryKey: ["admin-works"] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Trabalhos / Agenda</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" /> Novo trabalho
            </Button>
          </DialogTrigger>
          <WorkDialog
            initial={editing}
            onSubmit={(vals) => mut.mutate(vals)}
            saving={mut.isPending}
          />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {(works ?? []).length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">Nenhum trabalho cadastrado.</Card>
        ) : works?.map((w) => (
          <Card key={w.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-foreground">{w.name}</h2>
                <p className="text-sm text-brand">
                  {format(new Date(w.starts_at), "EEEE, d 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}
                </p>
                {w.location && <p className="text-sm text-muted-foreground">{w.location}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={w.visibility === "public" ? "default" : "secondary"}>
                  {w.visibility === "public" ? "Público" : "Interno"}
                </Badge>
                <Badge variant="outline">{WORK_STATUS_LABELS[w.status]}</Badge>
                <Button size="icon" variant="outline" onClick={() => { setEditing(w); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => {
                  if (confirm(`Excluir "${w.name}"?`)) delMut.mutate(w.id);
                }}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {w.description && <p className="mt-3 text-sm text-muted-foreground">{w.description}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkDialog({
  initial, onSubmit, saving,
}: {
  initial: WorkRow | null;
  onSubmit: (v: { id?: string; name: string; description?: string | null; starts_at: string; location?: string | null; status: "draft"|"published"|"completed"|"archived"; visibility: "public"|"internal"; ends_at?: string | null }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startsAt, setStartsAt] = useState(initial?.starts_at ? initial.starts_at.slice(0, 16) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [status, setStatus] = useState<"draft"|"published"|"completed"|"archived">(initial?.status ?? "draft");
  const [visibility, setVisibility] = useState<"public"|"internal">(initial?.visibility ?? "internal");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar trabalho" : "Novo trabalho"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: initial?.id,
          name, description: description || null,
          starts_at: new Date(startsAt).toISOString(),
          location: location || null,
          status, visibility,
        });
      }}>
        <div>
          <Label>Nome *</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Data e hora *</Label>
            <Input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <Label>Local</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visibilidade</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Pública (site)</SelectItem>
                <SelectItem value="internal">Interna (associados)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
