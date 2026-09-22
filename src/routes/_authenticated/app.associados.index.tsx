import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus, Search, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPerson, listPeople } from "@/lib/people.functions";

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
  const createFn = useServerFn(createPerson);
  const qc = useQueryClient();
  const { data: people, isLoading } = useQuery({ queryKey: ["people"], queryFn: () => listFn() });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"visitor" | "associate">("visitor");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return people ?? [];
    return (people ?? []).filter((p: any) =>
      [p.full_name, p.email, p.phone].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [people, q]);

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
      setOpen(false); setName(""); setPhone(""); setEmail(""); setType("visitor"); setNotes("");
      qc.invalidateQueries({ queryKey: ["people"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visitors = (people ?? []).filter((p: any) => p.person_type === "visitor" && p.status === "active").length;
  const associates = (people ?? []).filter((p: any) => p.person_type === "associate" && p.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Gestão</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Pessoas</h1>
          <p className="mt-1 text-muted-foreground">Cadastre visitantes, acompanhe sua trajetória e identifique quem já faz parte da associação.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href={signupUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Link de cadastro</a></Button><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Adicionar pessoa</Button></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Visitantes ativos</p><p className="mt-1 text-3xl font-display">{visitors}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Associados ativos</p><p className="mt-1 text-3xl font-display">{associates}</p></Card>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Integrantes cadastrados</h2>
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
              {isLoading ? <tr><td className="p-6 text-muted-foreground" colSpan={4}>Carregando…</td></tr> :
              filtered.map((p: any) => (
                <tr key={p.id}>
                  <td className="p-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{p.full_name}</span></div></td>
                  <td className="p-3"><Badge variant={p.person_type === "associate" ? "default" : "outline"}>{p.person_type === "associate" ? "Associado" : "Visitante"}</Badge></td>
                  <td className="p-3 text-muted-foreground">{p.email || p.phone || "—"}</td>
                  <td className="p-3"><Badge variant={p.status === "active" ? "outline" : "secondary"}>{p.status === "active" ? "Ativo" : "Inativo"}</Badge></td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && <tr><td className="p-6 text-muted-foreground" colSpan={4}>Nenhuma pessoa encontrada.</td></tr>}
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
