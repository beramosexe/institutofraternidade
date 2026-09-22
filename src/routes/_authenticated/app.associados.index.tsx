import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listPeople, createPerson } from "@/lib/people.functions";

export const Route = createFileRoute("/_authenticated/app/associados/")({
  head: () => ({
    meta: [
      { title: "Pessoas — Instituto Fraternidade" },
      { name: "description", content: "Cadastro e acompanhamento de visitantes e associados." },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const listFn = useServerFn(listPeople);
  const createFn = useServerFn(createPerson);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["people"],
    queryFn: () => listFn(),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return people;
    return people.filter((p: any) =>
      [p.full_name, p.email, p.phone].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [people, q]);

  const visitors = people.filter((p: any) => p.person_type === "visitor" && p.status === "active").length;
  const associates = people.filter((p: any) => p.person_type === "associate" && p.status === "active").length;

  const create = useMutation({
    mutationFn: (data: Parameters<typeof createFn>[0]["data"]) => createFn({ data }),
    onSuccess: () => {
      toast.success("Pessoa cadastrada.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["people"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Gestão</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Pessoas</h1>
          <p className="mt-1 text-muted-foreground">
            Cadastre visitantes, acompanhe sua trajetória e identifique quem já faz parte da associação.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar pessoa
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Visitantes ativos</p>
          <p className="mt-1 text-3xl font-semibold">{visitors}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Associados ativos</p>
          <p className="mt-1 text-3xl font-semibold">{associates}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-display text-xl">Integrantes cadastrados</h2>
            <p className="text-sm text-muted-foreground">Uma única ficha por pessoa; o tipo pode mudar ao longo da trajetória.</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar nome, e-mail ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-muted-foreground">Carregando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Pessoa</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p: any) => (
                  <tr key={p.id}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><UserRound className="h-4 w-4" /></div>
                        <div>
                          <p className="font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.email || "Sem e-mail"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={p.person_type === "associate" ? "default" : "outline"}>
                        {p.person_type === "associate" ? "Associado" : "Visitante"}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.phone || "—"}</td>
                    <td className="p-3">
                      <Badge variant={p.status === "active" ? "outline" : "secondary"}>
                        {p.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhuma pessoa encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddPersonDialog
        open={open}
        onOpenChange={setOpen}
        pending={create.isPending}
        onSubmit={(data) => create.mutate(data)}
      />
    </div>
  );
}

function AddPersonDialog({
  open, onOpenChange, pending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (data: { full_name: string; phone: string | null; email: string | null; person_type: "visitor" | "associate"; notes: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"visitor" | "associate">("visitor");
  const [notes, setNotes] = useState("");

  function reset() {
    setName(""); setPhone(""); setEmail(""); setType("visitor"); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar pessoa</DialogTitle>
          <DialogDescription>
            Comece como visitante quando a pessoa ainda não for associada. A mesma ficha poderá ser promovida depois.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ full_name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, person_type: type, notes: notes.trim() || null });
        }}>
          <div className="space-y-2"><Label htmlFor="person-name">Nome completo *</Label><Input id="person-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="person-phone">Telefone</Label><Input id="person-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></div>
            <div className="space-y-2"><Label htmlFor="person-email">E-mail</Label><Input id="person-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} /></div>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as "visitor" | "associate")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visitor">Visitante</SelectItem>
                <SelectItem value="associate">Associado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="person-notes">Observações</Label><Input id="person-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Cadastrando…" : "Cadastrar pessoa"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
