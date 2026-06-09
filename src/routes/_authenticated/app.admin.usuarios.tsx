import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listUsersWithRoles, setUserRoles, listRoles } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/app/admin/usuarios")({
  component: AdminUsers,
});

type UserRow = Awaited<ReturnType<typeof listUsersWithRoles>>[number];

function AdminUsers() {
  const listFn = useServerFn(listUsersWithRoles);
  const listRolesFn = useServerFn(listRoles);
  const setFn = useServerFn(setUserRoles);
  const qc = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });
  const { data: roles } = useQuery({ queryKey: ["roles-list"], queryFn: () => listRolesFn() });

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function startEdit(u: UserRow) {
    setEditing(u);
    setSelected(new Set(u.roles.map((r) => r.id)));
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await setFn({ data: { user_id: editing.id, role_ids: Array.from(selected) } });
    },
    onSuccess: () => {
      toast.success("Cargos atualizados.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEditing(null);
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Usuários</h1>
      </div>

      <div className="grid gap-3">
        {users?.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{u.full_name ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {u.roles.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem cargo</span>
                ) : u.roles.map((r) => (
                  <Badge key={r.id} variant="secondary">{r.name}</Badge>
                ))}
                <Button size="sm" variant="outline" onClick={() => startEdit(u)}>Atribuir cargos</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cargos de {editing?.full_name ?? editing?.email}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {roles?.map((r) => {
              const checked = selected.has(r.id);
              return (
                <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/40">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const next = new Set(selected);
                      if (c) next.add(r.id); else next.delete(r.id);
                      setSelected(next);
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
