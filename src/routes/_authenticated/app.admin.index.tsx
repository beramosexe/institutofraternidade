import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users as UsersIcon, History, Headphones, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RolesManager } from "@/components/app/RolesManager";
import { listRoles } from "@/lib/roles.functions";
import { getSignupPinStatus, setSignupPin } from "@/lib/signup.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — Instituto Fraternidade" },
      { name: "description", content: "Painel administrativo: cargos, permissões e atalhos de gestão." },
      { property: "og:title", content: "Admin — Instituto Fraternidade" },
      { property: "og:description", content: "Painel administrativo: cargos, permissões e atalhos de gestão." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const listFn = useServerFn(listRoles);
  const getPinStatus = useServerFn(getSignupPinStatus);
  const setPin = useServerFn(setSignupPin);
  const { data: roles } = useQuery({ queryKey: ["roles-list"], queryFn: () => listFn() });
  const { data: pinStatus, refetch: refetchPinStatus } = useQuery({ queryKey: ["signup-pin-status"], queryFn: () => getPinStatus() });
  const [newPin, setNewPin] = useState("");
  const pinMutation = useMutation({
    mutationFn: () => setPin({ data: { pin: newPin } }),
    onSuccess: async () => {
      setNewPin("");
      await refetchPinStatus();
      toast.success("PIN de cadastro atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Admin</h1>
        <p className="mt-1 text-muted-foreground">
          {roles ? `${roles.length} cargos configurados.` : "Carregando…"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Shortcut to="/app/admin/usuarios" icon={UsersIcon} title="Usuários" desc="Atribuir cargos" />
        <Shortcut to="/app/admin/audios" icon={Headphones} title="Gestão de áudios" desc="Biblioteca e revisão" />
        <Shortcut to="/app/admin/logs" icon={History} title="Logs" desc="Auditoria do sistema" />
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">PIN de cadastro de associados</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Defina o PIN que será compartilhado com as pessoas autorizadas a solicitar cadastro. O valor é armazenado nas configurações do banco.
            </p>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); pinMutation.mutate(); }}>
              <div className="flex-1 space-y-2">
                <Label htmlFor="signup-pin">Novo PIN</Label>
                <Input id="signup-pin" value={newPin} onChange={(e) => setNewPin(e.target.value)} minLength={4} maxLength={60} required />
              </div>
              <Button type="submit" disabled={pinMutation.isPending}>
                {pinMutation.isPending ? "Salvando…" : pinStatus?.configured ? "Trocar PIN" : "Definir PIN"}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              {pinStatus?.configured ? "PIN configurado." : "Nenhum PIN configurado."}
            </p>
          </div>
        </div>
      </Card>

      <RolesManager />
    </div>
  );
}

function Shortcut({
  to, icon: Icon, title, desc,
}: { to: string; icon: typeof UsersIcon; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:bg-accent/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </Card>
    </Link>
  );
}
