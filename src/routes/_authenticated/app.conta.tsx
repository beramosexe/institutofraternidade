import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyAccess } from "@/components/app/AppShell";
import { getMyMembership } from "@/lib/me.functions";
import {
  MEMBERSHIP_STATUS_LABELS,
  CLASS_MEMBER_STATUS_LABELS,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Instituto Fraternidade" },
      { name: "description", content: "Minha formação, turma atual, turmas anteriores e histórico no Instituto." },
      { property: "og:title", content: "Minha conta — Instituto Fraternidade" },
      { property: "og:description", content: "Formação, turmas e histórico do associado." },
    ],
  }),
  component: MyAccountPage,
});

const fmtDate = (v?: string | null) =>
  v ? format(new Date(`${v}T12:00:00`), "d 'de' MMM 'de' yyyy", { locale: ptBR }) : "—";

function MyAccountPage() {
  const { data: access } = useMyAccess();
  const fn = useServerFn(getMyMembership);
  const { data, isLoading } = useQuery({ queryKey: ["my-membership"], queryFn: () => fn() });

  const current = (data?.memberships ?? []).filter((m: any) => m.status === "active");
  const past = (data?.memberships ?? []).filter((m: any) => m.status !== "active");

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Minha conta</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">
            {access?.profile?.full_name ?? "Associado"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Situação:{" "}
            <Badge variant={access?.membershipStatus === "active" ? "default" : "outline"}>
              {MEMBERSHIP_STATUS_LABELS[access?.membershipStatus ?? "pending"]}
            </Badge>
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/perfil"><Settings className="mr-2 h-4 w-4" /> Editar meus dados</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Minha formação</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : current.length === 0 ? (
          <Card className="p-6 text-muted-foreground">Nenhuma turma ativa no momento.</Card>
        ) : (
          current.map((m: any) => (
            <Card key={m.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{m.classes?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.classes?.formation_levels?.name ?? "Sem nível"}
                    {m.classes?.period ? ` · ${m.classes.period}` : ""} · desde {fmtDate(m.joined_at)}
                    {m.purpose ? ` · ${m.purpose}` : ""}
                  </p>
                </div>
                {m.is_primary && <Badge variant="outline">Turma principal</Badge>}
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Turmas anteriores</h2>
        {past.length === 0 ? (
          <Card className="p-6 text-muted-foreground">Nenhum vínculo anterior registrado.</Card>
        ) : (
          past.map((m: any) => (
            <Card key={m.id} className="p-4">
              <p className="font-medium text-foreground">{m.classes?.name}</p>
              <p className="text-xs text-muted-foreground">
                {m.classes?.formation_levels?.name ?? "Sem nível"} · {fmtDate(m.joined_at)} até {fmtDate(m.left_at)} ·{" "}
                {CLASS_MEMBER_STATUS_LABELS[m.status as keyof typeof CLASS_MEMBER_STATUS_LABELS]}
              </p>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Períodos de atividade</h2>
        <Card className="divide-y divide-border">
          {(data?.periods ?? []).length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum período registrado.</p>
          ) : (
            (data?.periods ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="text-foreground">
                  {MEMBERSHIP_STATUS_LABELS[p.status as keyof typeof MEMBERSHIP_STATUS_LABELS]}
                </span>
                <span className="text-muted-foreground">
                  {fmtDate(p.started_on)} — {p.ended_on ? fmtDate(p.ended_on) : "atual"}
                </span>
              </div>
            ))
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Meu histórico</h2>
        <Card className="divide-y divide-border">
          {(data?.events ?? []).length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            (data?.events ?? []).map((e: any) => (
              <div key={e.id} className="p-4">
                <p className="text-sm text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.occurred_at), "d MMM yyyy · HH:mm", { locale: ptBR })}
                </p>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
