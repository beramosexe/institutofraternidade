import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users as UsersIcon, History, Headphones } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RolesManager } from "@/components/app/RolesManager";
import { SignupPinCard } from "@/components/app/SignupPinCard";
import { listRoles } from "@/lib/roles.functions";

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
  const { data: roles } = useQuery({ queryKey: ["roles-list"], queryFn: () => listFn() });

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

      <SignupPinCard />

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
