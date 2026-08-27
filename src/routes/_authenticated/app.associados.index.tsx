import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Search, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMembers, validateMember } from "@/lib/members.functions";
import { MEMBERSHIP_STATUS_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/associados/")({
  head: () => ({
    meta: [
      { title: "Gestão de associados — Instituto Fraternidade" },
      { name: "description", content: "Valide cadastros, configure contas, turmas e funções dos associados." },
      { property: "og:title", content: "Gestão de associados — Instituto Fraternidade" },
      { property: "og:description", content: "Valide cadastros e administre associados do Instituto." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const listFn = useServerFn(listMembers);
  const validateFn = useServerFn(validateMember);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: members, isLoading } = useQuery({ queryKey: ["members"], queryFn: () => listFn() });

  const validate = useMutation({
    mutationFn: (user_id: string) => validateFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Cadastro validado.");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = useMemo(
    () => (members ?? []).filter((m: any) => m.membership_status === "pending"),
    [members],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = (members ?? []).filter((m: any) => m.membership_status !== "pending");
    if (!term) return rows;
    return rows.filter(
      (m: any) =>
        (m.full_name ?? "").toLowerCase().includes(term) || (m.email ?? "").toLowerCase().includes(term),
    );
  }, [members, q]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Minhas áreas</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Gestão de associados</h1>
          <p className="mt-1 text-muted-foreground">
            Valide cadastros, configure contas, turmas, funções e acompanhe o histórico.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/associados/turmas"><GraduationCap className="mr-2 h-4 w-4" /> Turmas</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">
          Cadastros pendentes {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : pending.length === 0 ? (
          <Card className="p-6 text-muted-foreground">Nenhum cadastro aguardando validação.</Card>
        ) : (
          pending.map((m: any) => (
            <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-foreground">{m.full_name ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => validate.mutate(m.id)} disabled={validate.isPending}>
                  <UserCheck className="mr-2 h-4 w-4" /> Validar
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/associados/$id" params={{ id: m.id }}>Configurar</Link>
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-foreground">Associados</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Turma atual</th>
                <th className="p-3">Nível</th>
                <th className="p-3">Funções</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m: any) => {
                const primary = m.classes.find((c: any) => c.primary) ?? m.classes[0];
                return (
                  <tr key={m.id}>
                    <td className="p-3">
                      <p className="font-medium text-foreground">{m.full_name ?? "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </td>
                    <td className="p-3">
                      <Badge variant={m.membership_status === "active" ? "default" : "outline"}>
                        {MEMBERSHIP_STATUS_LABELS[m.membership_status as keyof typeof MEMBERSHIP_STATUS_LABELS]}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{primary?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{primary?.level ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {m.roles.length ? m.roles.map((r: any) => r.name).join(", ") : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/app/associados/$id" params={{ id: m.id }}>Abrir ficha</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-6 text-muted-foreground" colSpan={6}>Nenhum associado encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
