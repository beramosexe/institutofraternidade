import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { listRoles, createRole, updateRole, deleteRole } from "@/lib/roles.functions";
import { ALL_PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/permissions";

type RoleRow = Awaited<ReturnType<typeof listRoles>>[number];

export function RolesManager() {
  const listFn = useServerFn(listRoles);
  const createFn = useServerFn(createRole);
  const updateFn = useServerFn(updateRole);
  const deleteFn = useServerFn(deleteRole);
  const qc = useQueryClient();

  const { data: roles } = useQuery({ queryKey: ["roles-list"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Cargo removido."); qc.invalidateQueries({ queryKey: ["roles-list"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-foreground">Cargos e permissões</h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" /> Novo cargo</Button>
          </DialogTrigger>
          <RoleDialog
            initial={editing}
            onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["roles-list"] }); }}
            createFn={createFn}
            updateFn={updateFn}
          />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {roles?.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg text-foreground">{r.name}</h3>
                  {r.is_system && <Badge variant="outline">sistema</Badge>}
                </div>
                {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.slug === "admin" ? (
                    <Badge variant="secondary">todas as permissões</Badge>
                  ) : r.permissions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">nenhuma permissão</span>
                  ) : r.permissions.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">
                      {PERMISSION_LABELS[p as Permission] ?? p}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => { setEditing(r); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {!r.is_system && (
                  <Button size="icon" variant="outline" onClick={() => {
                    if (confirm(`Excluir cargo "${r.name}"?`)) delMut.mutate(r.id);
                  }}>
                    <Trash className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RoleDialog({
  initial, onSaved, createFn, updateFn,
}: {
  initial: RoleRow | null;
  onSaved: () => void;
  createFn: ReturnType<typeof useServerFn<typeof createRole>>;
  updateFn: ReturnType<typeof useServerFn<typeof updateRole>>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [perms, setPerms] = useState<Set<string>>(new Set(initial?.permissions ?? []));
  const [busy, setBusy] = useState(false);

  const isAdmin = initial?.slug === "admin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (initial) {
        await updateFn({ data: { id: initial.id, name, description: description || null, permissions: Array.from(perms) } });
      } else {
        const r = await createFn({ data: { slug, name, description } });
        await updateFn({ data: { id: r.id, name, description: description || null, permissions: Array.from(perms) } });
      }
      toast.success("Cargo salvo.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Editar cargo" : "Novo cargo"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nome *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Identificador *</Label>
            <Input
              required value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              disabled={!!initial}
              maxLength={40}
              placeholder="ex: secretaria"
            />
          </div>
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} />
        </div>

        <div>
          <Label>Permissões</Label>
          {isAdmin ? (
            <p className="mt-2 text-sm text-muted-foreground">
              O administrador possui todas as permissões automaticamente.
            </p>
          ) : (
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {ALL_PERMISSIONS.map((p) => {
                const checked = perms.has(p);
                return (
                  <label key={p} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-accent/40">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const next = new Set(perms);
                        if (c) next.add(p); else next.delete(p);
                        setPerms(next);
                      }}
                    />
                    <span className="text-sm text-foreground">{PERMISSION_LABELS[p]}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={busy}>Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
