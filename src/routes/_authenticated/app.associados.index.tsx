import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, GraduationCap, Search, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listMembers, validateMember } from "@/lib/members.functions";
import { listClasses } from "@/lib/classes.functions";
import { listRoles } from "@/lib/roles.functions";
import { MEMBERSHIP_STATUS_LABELS, CRITICAL_PERMISSIONS } from "@/lib/permissions";
import { useMyAccess } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/app/associados/")({
  head: () => ({ meta: [
    { title: "Gestão de associados — Instituto Fraternidade" },
    { name: "description", content: "Valide cadastros, configure contas, turmas e funções dos associados." },
    { property: "og:title", content: "Gestão de associados — Instituto Fraternidade" },
    { property: "og:description", content: "Valide cadastros e administre associados do Instituto." },
  ]}),
  component: MembersPage,
});

async function copySignupLink() {\n  const url = `${window.location.origin}/associados/cadastro`;\n  try {\n    await navigator.clipboard.writeText(url);\n    toast.success("Link de cadastro copiado.");\n  } catch {\n    toast.error("Não foi possível copiar o link automaticamente.");\n  }\n}\n\nfunction MembersPage() {
  const listFn = useServerFn(listMembers); const validateFn = useServerFn(validateMember);
  const classesFn = useServerFn(listClasses); const rolesFn = useServerFn(listRoles);
  const qc = useQueryClient(); const { data: access } = useMyAccess(); const [q, setQ] = useState("");
  const { data: members, isLoading } = useQuery({ queryKey: ["members"], queryFn: () => listFn() });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });
  const { data: roles } = useQuery({ queryKey: ["roles-list"], queryFn: () => rolesFn() });
  const [target, setTarget] = useState<any | null>(null); const [classId, setClassId] = useState("");
  const [purpose, setPurpose] = useState(""); const [roleIds, setRoleIds] = useState<string[]>([]);
  const openValidate = (m: any) => { setTarget(m); setClassId(""); setPurpose(""); setRoleIds([]); };
  const validate = useMutation({
    mutationFn: () => validateFn({ data: { user_id: target.id, class_id: classId || null, purpose: purpose || undefined, role_ids: roleIds } }),
    onSuccess: () => { toast.success("Cadastro validado."); setTarget(null); qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["pending-members-count"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const isCriticalRole = (r: any) => r.slug === "admin" || (r.permissions ?? []).some((p: string) => (CRITICAL_PERMISSIONS as string[]).includes(p));
  const pending = useMemo(() => (members ?? []).filter((m: any) => m.membership_status === "pending"), [members]);
  const filtered = useMemo(() => { const term = q.trim().toLowerCase(); const rows = (members ?? []).filter((m: any) => m.membership_status !== "pending"); if (!term) return rows; return rows.filter((m: any) => (m.full_name ?? "").toLowerCase().includes(term) || (m.email ?? "").toLowerCase().includes(term)); }, [members, q]);

  return <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.22em] text-brand">Minhas áreas</p><h1 className="mt-1 font-display text-3xl text-foreground">Gestão de associados</h1><p className="mt-1 text-muted-foreground">Valide cadastros, configure contas, turmas, funções e acompanhe o histórico.</p></div><div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copySignupLink}><Copy className="mr-2 h-4 w-4" /> Copiar link de cadastro</Button>
          <Button asChild variant="outline"><Link to="/associados/cadastro" target="_blank"><ExternalLink className="mr-2 h-4 w-4" /> Abrir cadastro</Link></Button>
          <Button asChild variant="outline"><Link to="/app/associados/turmas"><GraduationCap className="mr-2 h-4 w-4" /> Turmas</Link></Button>
        </div></div>
    <section className="space-y-3"><h2 className="font-display text-xl text-foreground">Cadastros pendentes {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}</h2>
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : pending.length === 0 ? <Card className="p-6 text-muted-foreground">Nenhum cadastro aguardando validação.</Card> : pending.map((m: any) => <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-foreground">{m.full_name ?? "Sem nome"}</p><p className="text-xs text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => openValidate(m)}><UserCheck className="mr-2 h-4 w-4" /> Validar</Button><Button asChild size="sm" variant="outline"><Link to="/app/associados/$id" params={{ id: m.id }}>Configurar</Link></Button></div></Card>)}
    </section>
    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl text-foreground">Associados</h2><div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Nome</th><th className="p-3">Situação</th><th className="p-3">Turma atual</th><th className="p-3">Nível</th><th className="p-3">Funções</th><th className="p-3" /></tr></thead><tbody className="divide-y divide-border">
        {filtered.map((m: any) => { const primary = m.classes.find((c: any) => c.primary) ?? m.classes[0]; return <tr key={m.id}><td className="p-3"><p className="font-medium text-foreground">{m.full_name ?? "Sem nome"}</p><p className="text-xs text-muted-foreground">{m.email}</p></td><td className="p-3"><Badge variant={m.membership_status === "active" ? "default" : "outline"}>{MEMBERSHIP_STATUS_LABELS[m.membership_status as keyof typeof MEMBERSHIP_STATUS_LABELS]}</Badge></td><td className="p-3 text-muted-foreground">{primary?.name ?? "—"}</td><td className="p-3 text-muted-foreground">{primary?.level ?? "—"}</td><td className="p-3 text-muted-foreground">{m.roles.length ? m.roles.map((r: any) => r.name).join(", ") : "—"}</td><td className="p-3 text-right"><Button asChild size="sm" variant="ghost"><Link to="/app/associados/$id" params={{ id: m.id }}>Abrir ficha</Link></Button></td></tr>; })}
        {filtered.length === 0 && <tr><td className="p-6 text-muted-foreground" colSpan={6}>Nenhum associado encontrado.</td></tr>}
      </tbody></table></Card>
    </section>
    <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}><DialogContent><DialogHeader><DialogTitle>Validar cadastro</DialogTitle><DialogDescription>{target?.full_name ?? "Associado"} — defina turma e funções iniciais. Tudo fica registrado na linha do tempo.</DialogDescription></DialogHeader>
      <div className="space-y-4"><div className="space-y-2"><Label>Turma inicial (opcional)</Label><Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="Sem turma por enquanto" /></SelectTrigger><SelectContent>{(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.level_name ? ` · ${c.level_name}` : ""}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="purpose">Finalidade do vínculo (opcional)</Label><Input id="purpose" placeholder="Ex.: cursando o Básico" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
      <div className="space-y-2"><Label>Funções iniciais</Label><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">{(roles ?? []).map((r: any) => { const critical = isCriticalRole(r); const locked = critical && !access?.isAdmin; return <label key={r.id} className={[\"flex items-start gap-2 rounded-md p-2 text-sm\", locked ? \"opacity-60\" : \"cursor-pointer hover:bg-accent/40\"].join(" ")}><input type="checkbox" className="mt-1" disabled={locked} checked={roleIds.includes(r.id)} onChange={(e) => setRoleIds((prev) => e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id))} /><span><span className="font-medium text-foreground">{r.name}</span>{critical && <Badge variant="outline" className="ml-2">Crítico</Badge>}</span></label>; })}</div><p className="text-xs text-muted-foreground">Cargos com permissões críticas só podem ser atribuídos pela administração.</p></div></div>
      <DialogFooter><Button variant="ghost" onClick={() => setTarget(null)}>Cancelar</Button><Button onClick={() => validate.mutate()} disabled={validate.isPending}>Validar e ativar</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
