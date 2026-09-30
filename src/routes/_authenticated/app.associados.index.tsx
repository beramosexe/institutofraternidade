import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Search, UserRound, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPerson, linkPersonToMember, listPeople } from "@/lib/people.functions";
import { listMembers, validateMember } from "@/lib/members.functions";


export const Route = createFileRoute("/_authenticated/app/associados/")({
  head: () => ({
    meta: [
      { title: "Pessoas — Instituto Fraternidade" },
      { name: "description", content: "Cadastre visitantes e associados e acompanhe sua trajetória." },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const signupUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/associados/cadastro`;
  const listFn = useServerFn(listPeople);
  const membersFn = useServerFn(listMembers);
  const createFn = useServerFn(createPerson);
  const linkFn = useServerFn(linkPersonToMember);
  const validateFn = useServerFn(validateMember);
  const qc = useQueryClient();

  const { data: people, isLoading: peopleLoading } = useQuery({
    queryKey: ["people"],
    queryFn: () => listFn(),
  });
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => membersFn(),
  });

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"visitor" | "associate">("visitor");
  const [notes, setNotes] = useState("");

  const pendingMembers = useMemo(
    () => (members ?? []).filter((m: any) => m.membership_status === "pending"),
    [members],
  );

  const registry = useMemo(() => {
    const rows = new Map<string, any>();

    for (const p of people ?? []) {
      const key = p.linked_user_id ? `user:${p.linked_user_id}` : `person:${p.id}`;
      rows.set(key, { ...p, source: "people", profile: null });
    }

    for (const m of members ?? []) {
      const matchingKey = m.id && rows.has(`user:${m.id}`) ? `user:${m.id}` :
        (m.email ? Array.from(rows.entries()).find(([, row]) =>
          !row.linked_user_id && row.email && row.email.toLowerCase() === m.email.toLowerCase(),
        )?.[0] : undefined);

      if (matchingKey) {
        const row = rows.get(matchingKey);
        rows.set(matchingKey, {
          ...row,
          full_name: m.full_name ?? row.full_name,
          phone: m.phone ?? row.phone,
          email: m.email || row.email,
          linked_user_id: m.id,
          person_type: m.membership_status === "active" ? "associate" : row.person_type,
          status: m.membership_status === "inactive" ? "inactive" : row.status,
          source: "people+profile",
          profile: m,
        });
      } else {
        rows.set(`profile:${m.id}`, {
          id: `profile:${m.id}`,
          full_name: m.full_name ?? "Sem nome",
          phone: m.phone,
          email: m.email,
          person_type: m.membership_status === "active" ? "associate" : "profile",
          status: m.membership_status === "inactive" ? "inactive" : "active",
          linked_user_id: m.id,
          source: "profile",
          profile: m,
        });
      }
    }

    return Array.from(rows.values());
  }, [people, members]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return registry;
    return registry.filter((p: any) =>
      [p.full_name, p.email, p.phone].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [registry, q]);

  const save = useMutation({
    mutationFn: () => createFn({
      data: {
        full_name: name,
        phone: phone || null,
        email: email || null,
        person_type: type,
        notes: notes || null,
      },
    }),
    onSuccess: () => {
      toast.success("Pessoa cadastrada.");
      setOpen(false);
      setName(""); setPhone(""); setEmail(""); setType("visitor"); setNotes("");
      qc.invalidateQueries({ queryKey: ["people"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const link = useMutation({
    mutationFn: ({ personId, userId }: { personId: string; userId: string }) =>
      linkFn({ data: { person_id: personId, user_id: userId } }),
    onSuccess: () => {
      toast.success("Pessoa vinculada ao perfil.");
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (userId: string) => validateFn({
      data: { user_id: userId, role_ids: [] },
    }),
    onSuccess: () => {
      toast.success("Cadastro aprovado.");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["pending-members-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visitors = registry.filter((p: any) => p.person_type === "visitor" && p.status === "active").length;
  const associates = registry.filter((p: any) => p.person_type === "associate" && p.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Gestão</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Pessoas e associados</h1>
          <p className="mt-1 text-muted-foreground">Pessoas cadastradas e perfis de usuários aparecem juntos, evitando duplicidade quando alguém passa de visitante a associado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><a href={signupUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Link de cadastro</a></Button>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Adicionar pessoa</Button>
        </div>
      </div>

      {(pendingMembers.length > 0 || membersLoading) && (
        <Card className="border-brand/40 bg-brand/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-brand">Cadastros aguardando aprovação</p>
              <h2 className="mt-1 font-display text-xl text-foreground">
                {membersLoading ? "Carregando…" : `${pendingMembers.length} pendente${pendingMembers.length === 1 ? "" : "s"}`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Os cadastros públicos chegam como pendentes e precisam ser aprovados pela equipe.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {pendingMembers.map((m: any) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{m.full_name ?? "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground">{m.email || "Sem e-mail"}{m.phone ? ` · ${m.phone}` : ""}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Solicitado em {m.created_at ? new Date(m.created_at).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => approve.mutate(m.id)} disabled={approve.isPending}>
                    <Check className="mr-2 h-4 w-4" /> Aprovar cadastro
                  </Button>
                  <Button size="sm" variant="outline" disabled title="Fluxo de recusa ainda não configurado">
                    <X className="mr-2 h-4 w-4" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Visitantes ativos</p><p className="mt-1 text-3xl font-display">{visitors}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Associados ativos</p><p className="mt-1 text-3xl font-display">{associates}</p></Card>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Pessoas e perfis cadastrados</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar nome, e-mail ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Pessoa</th><th className="p-3">Tipo</th><th className="p-3">Contato</th><th className="p-3">Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {peopleLoading ? <tr><td className="p-6 text-muted-foreground" colSpan={4}>Carregando…</td></tr> :
              filtered.map((p: any) => (
                <tr key={p.id}>
                  <td className="p-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{p.full_name}</span></div></td>
                  <td className="p-3"><Badge variant={p.person_type === "associate" ? "default" : "outline"}>{p.person_type === "associate" ? "Associado" : p.person_type === "visitor" ? "Visitante" : "Perfil"}</Badge></td>
                  <td className="p-3 text-muted-foreground">{p.email || p.phone || "—"}</td>
                  <td className="p-3"><div className="flex items-center gap-2"><Badge variant={p.status === "active" ? "outline" : "secondary"}>{p.status === "active" ? "Ativo" : "Inativo"}</Badge>{p.linked_user_id ? <Button asChild size="sm" variant="ghost"><Link to="/app/associados/$id" params={{ id: p.linked_user_id }}>Gerenciar</Link></Button> : p.source === "people" && p.email ? (() => {
                    const matchingProfile = (members ?? []).find((m: any) =>
                      m.email && m.email.toLowerCase() === p.email.toLowerCase(),
                    );
                    return matchingProfile ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => link.mutate({ personId: p.id, userId: matchingProfile.id })}
                        disabled={link.isPending}
                      >
                        Vincular perfil
                      </Button>
                    ) : null;
                  })() : null}</div></td>
                </tr>
              ))}
              {!peopleLoading && filtered.length === 0 && <tr><td className="p-6 text-muted-foreground" colSpan={4}>Nenhuma pessoa encontrada.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar pessoa</DialogTitle><DialogDescription>Cadastre primeiro a pessoa. O vínculo como visitante ou associado pode evoluir depois.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="person-name">Nome completo</Label><Input id="person-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pessoa" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="person-phone">Telefone</Label><Input id="person-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="person-email">E-mail</Label><Input id="person-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Tipo</Label><Select value={type} onValueChange={(v: "visitor" | "associate") => setType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="visitor">Visitante</SelectItem><SelectItem value="associate">Associado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="person-notes">Observações</Label><Textarea id="person-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => save.mutate()} disabled={save.isPending || name.trim().length < 2}>{save.isPending ? "Salvando…" : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
