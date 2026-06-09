import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyAccess } from "@/components/app/AppShell";
import { updateMyProfile } from "@/lib/me.functions";

export const Route = createFileRoute("/_authenticated/app/perfil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: access, refetch } = useMyAccess();
  const update = useServerFn(updateMyProfile);

  const [fullName, setFullName] = useState(access?.profile?.full_name ?? "");
  const [phone, setPhone] = useState(access?.profile?.phone ?? "");
  const [bio, setBio] = useState(access?.profile?.bio ?? "");

  const mut = useMutation({
    mutationFn: () => update({ data: { full_name: fullName, phone, bio } }),
    onSuccess: () => { toast.success("Perfil atualizado."); refetch(); },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Conta</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Meu perfil</h1>
      </div>

      <Card className="p-6">
        <div>
          <Label>Cargos</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(access?.roles ?? []).map((r) => <Badge key={r.id} variant="secondary">{r.name}</Badge>)}
          </div>
        </div>
      </Card>

      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <Card className="space-y-4 p-6">
          <div>
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
          </div>
          <Button type="submit" disabled={mut.isPending}>Salvar</Button>
        </Card>
      </form>
    </div>
  );
}
