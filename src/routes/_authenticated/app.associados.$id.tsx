import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getMember, setMemberRoles, setMemberStatus, updateMemberProfile } from "@/lib/members.functions";
import { addClassMember, endClassMembership, listClasses } from "@/lib/classes.functions";
import { listRoles } from "@/lib/roles.functions";
import {
  MEMBERSHIP_STATUS_LABELS, CLASS_MEMBER_STATUS_LABELS, CRITICAL_PERMISSIONS,
} from "@/lib/permissions";
import { useMyAccess } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/app/associados/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do associado — Instituto Fraternidade" },
      { name: "description", content: "Dados, turmas, períodos de atividade, funções e histórico do associado." },
      { property: "og:title", content: "Ficha do associado — Instituto Fraternidade" },
      { property: "og:description", content: "Ficha completa do associado do Instituto Fraternidade." },
    ],
  }),
  component: MemberDetailPage,
});

const fmtDate = (v?: string | null) =>
  v ? format(new Date(`${v}T12:00:00`), "d MMM yyyy", { locale: ptBR }) : "—";

function MemberDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: access } = useMyAccess();

  const getFn = useServerFn(getMember);
  const rolesFn = useServerFn(listRoles);
  const classesFn = useServerFn(listClasses);
  const setRolesFn = useServerFn(setMemberRoles);
  const setStatusFn = useServerFn(setMemberStatus);
  const updateFn = useServerFn(updateMemberProfile);
  const addClassFn = useServerFn(addClassMember);
  const endClassFn = useServerFn(endClassMembership);

  const { data, isLoading } = useQuery({ queryKey: ["member", id], queryFn: () => getFn({ data: { user_id: id } }) });
  const { data: roles } = useQuery({ queryKey: ["roles-list"], queryFn: () => rolesFn() });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [newClass, setNewClass] = useState("");
  const [purpose, setPurpose] = useState("");

  useEffect(() => {
    if (!data) return;
    setFullName(data.profile.full_name ?? "");
    setPhone(data.profile.phone ?? "");
    setSelectedRoles(data.role_ids);
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["member", id] });
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const saveProfile = useMutation({
    mutationFn: () => updateFn({ data: { user_id: id, full_name: fullName, phone } }),
    onSuccess: () => { toast.success("Dados atualizados."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRoles = useMutation({
    mutationFn: () => setRolesFn({ data: { user_id: id, role_ids: selectedRoles } }),
    onSuccess: () => { toast.success("Funções atualizadas."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (status: "active" | "inactive") => setStatusFn({ data: { user_id: id, status } }),
    onSuccess: () => { toast.success("Situação atualizada."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkClass = useMutation({
    mutationFn: () => addClassFn({ data: { class_id: newClass, user_id: id, purpose: purpose || undefined } }),
    onSuccess: () => { toast.success("Vínculo criado."); setNewClass(""); setPurpose(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const endLink = useMutation({
    mutationFn: (cmId: string) => endClassFn({ data: { id: cmId } }),
    onSuccess: () => { toast.success("Vínculo encerrado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const isCriticalRole = (r: any) =>
    r.slug === "admin" || (r.permissions ?? []).some((p: string) => (CRITICAL_PERMISSIONS as string[]).includes(p));

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/app/associados"><ArrowLeft className="mr-2 h-4 w-4" /> Associados</Link>
        </Button>
        <h1 className="font-display text-3xl text-foreground">{data.profile.full_name ?? "Sem nome"}</h1>
        <p className="mt-1 text-muted-foreground">
          {data.email} ·{" "}
          <Badge variant={data.profile.membership_status === "active" ? "default" : "outline"}>
            {MEMBERSHIP_STATUS_LABELS[data.profile.membership_status as keyof typeof MEMBERSHIP_STATUS_LABELS]}
          </Badge>
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl text-foreground">Dados administrativos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>Salvar dados</Button>
          {data.profile.membership_status === "active" ? (
            <Button size="sm" variant="outline" onClick={() => changeStatus.mutate("inactive")}>Inativar</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => changeStatus.mutate("active")}>Ativar</Button>
          )}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl text-foreground">Funções e cargos</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(roles ?? []).map((r: any) => {
            const critical = isCriticalRole(r);
            const locked = critical && !access?.isAdmin;
            const checked = selectedRoles.includes(r.id);
            return (
              <label
                key={r.id}
                className={[
                  "flex items-start gap-3 rounded-md border border-border p-3 text-sm",
                  locked ? "opacity-60" : "cursor-pointer hover:bg-accent/40",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) =>
                    setSelectedRoles((prev) =>
                      e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id),
                    )
                  }
                />
                <span>
                  <span className="font-medium text-foreground">{r.name}</span>
                  {critical && <Badge variant="outline" className="ml-2">Crítico</Badge>}
                  {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Cargos com permissões críticas só podem ser atribuídos pela administração.
        </p>
        <Button size="sm" onClick={() => saveRoles.mutate()} disabled={saveRoles.isPending}>Salvar funções</Button>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl text-foreground">Turmas</h2>
        <div className="space-y-2">
          {data.memberships.length === 0 && <p className="text-muted-foreground">Nenhum vínculo registrado.</p>}
          {data.memberships.map((m: any) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{m.classes?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.classes?.formation_levels?.name ?? "Sem nível"} · {fmtDate(m.joined_at)} —{" "}
                  {m.left_at ? fmtDate(m.left_at) : "atual"} ·{" "}
                  {CLASS_MEMBER_STATUS_LABELS[m.status as keyof typeof CLASS_MEMBER_STATUS_LABELS]}
                  {m.purpose ? ` · ${m.purpose}` : ""}
                </p>
              </div>
              {m.status === "active" && (
                <Button size="sm" variant="outline" onClick={() => endLink.mutate(m.id)}>Encerrar vínculo</Button>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={newClass} onValueChange={setNewClass}>
            <SelectTrigger><SelectValue placeholder="Vincular a uma turma…" /></SelectTrigger>
            <SelectContent>
              {(classes ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.level_name ? ` · ${c.level_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Finalidade (opcional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          <Button onClick={() => linkClass.mutate()} disabled={!newClass || linkClass.isPending}>Vincular</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl text-foreground">Períodos de atividade</h2>
        <div className="mt-3 divide-y divide-border">
          {data.periods.length === 0 && <p className="text-muted-foreground">Nenhum período registrado.</p>}
          {data.periods.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">
                {MEMBERSHIP_STATUS_LABELS[p.status as keyof typeof MEMBERSHIP_STATUS_LABELS]}
                {p.reason ? ` — ${p.reason}` : ""}
              </span>
              <span className="text-muted-foreground">
                {fmtDate(p.started_on)} — {p.ended_on ? fmtDate(p.ended_on) : "atual"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl text-foreground">Linha do tempo</h2>
        <div className="mt-3 divide-y divide-border">
          {data.events.length === 0 && <p className="text-muted-foreground">Nenhum evento registrado.</p>}
          {data.events.map((e: any) => (
            <div key={e.id} className="py-2">
              <p className="text-sm text-foreground">{e.title}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(e.occurred_at), "d MMM yyyy · HH:mm", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
