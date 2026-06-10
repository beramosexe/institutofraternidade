import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Plus, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  getCheckinData, markPresence, unmarkPresence, searchProfiles,
} from "@/lib/attendance.functions";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/trabalhos/$id/checkin")({
  component: CheckinPage,
});

function CheckinPage() {
  const { id } = Route.useParams();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const fetchData = useServerFn(getCheckinData);
  const mark = useServerFn(markPresence);
  const unmark = useServerFn(unmarkPresence);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["checkin", id, date],
    queryFn: () => fetchData({ data: { work_id: id, occurrence_date: date } }),
  });

  const presentByUser = useMemo(
    () => new Map((data?.attendances ?? []).filter((a) => a.user_id).map((a) => [a.user_id!, a])),
    [data?.attendances],
  );

  const markMut = useMutation({
    mutationFn: (vars: Parameters<typeof mark>[0]["data"]) => mark({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkin", id, date] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const unmarkMut = useMutation({
    mutationFn: (attendanceId: string) => unmark({ data: { id: attendanceId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkin", id, date] }),
  });

  function togglePresence(userId: string) {
    const existing = presentByUser.get(userId);
    if (existing) unmarkMut.mutate(existing.id);
    else markMut.mutate({ work_id: id, occurrence_date: date, user_id: userId });
  }

  const guests = (data?.attendances ?? []).filter((a) => !a.user_id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <Link to="/app/admin/trabalhos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para trabalhos
      </Link>

      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Check-in</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">
          {data?.work?.name ?? "Carregando…"}
        </h1>
        {data?.work?.location && <p className="text-muted-foreground">{data.work.location}</p>}
      </div>

      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex-1">
          <Label htmlFor="dt">Data da ocorrência</Label>
          <Input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
        </div>
        <div className="text-right text-sm text-muted-foreground">
          {data ? `${data.attendances.length} presença${data.attendances.length === 1 ? "" : "s"}` : ""}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Frequentes</h2>
        {isLoading ? (
          <Card className="p-6 text-muted-foreground">Carregando…</Card>
        ) : (data?.regulars ?? []).length === 0 ? (
          <Card className="p-6 text-muted-foreground">
            Nenhum participante frequente ainda. Adicione participantes ao trabalho ou marque presenças que se repetem.
          </Card>
        ) : (
          <div className="grid gap-2">
            {data!.regulars.map((p) => {
              const present = presentByUser.has(p.user_id);
              return (
                <Card key={p.user_id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                      <AvatarFallback>{(p.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{p.full_name ?? "(sem nome)"}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.kind === "participant" ? "Participante" : "Recorrente"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={present ? "default" : "outline"}
                    onClick={() => togglePresence(p.user_id)}
                  >
                    {present ? <><Check className="mr-1 h-4 w-4" /> Presente</> : "Marcar presença"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Presenças adicionais</h2>
          <AddPresenceControls
            workId={id}
            date={date}
            onMark={(vars) => markMut.mutate(vars)}
          />
        </div>
        {guests.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            Use "Adicionar presença" para incluir pessoas não frequentes ou convidados.
          </Card>
        ) : (
          <div className="grid gap-2">
            {guests.map((g) => (
              <Card key={g.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <div className="text-sm font-medium">{g.full_name ?? "(convidado)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.guest_email && <span>{g.guest_email}</span>}
                    {g.guest_email && g.guest_phone && " · "}
                    {g.guest_phone && <span>{g.guest_phone}</span>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => unmarkMut.mutate(g.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddPresenceControls({
  workId, date, onMark,
}: {
  workId: string;
  date: string;
  onMark: (v: { work_id: string; occurrence_date: string; user_id?: string | null; guest_name?: string | null; guest_email?: string | null; guest_phone?: string | null }) => void;
}) {
  const search = useServerFn(searchProfiles);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ["search-profiles", q],
    queryFn: () => search({ data: { q } }),
    enabled: q.trim().length >= 1,
    staleTime: 30_000,
  });

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" /> Adicionar presença</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Digite parte do nome…" value={q} onValueChange={setQ} />
            <CommandList>
              {q.trim().length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground">Digite ao menos 1 caractere.</div>
              )}
              {q.trim().length > 0 && results.length === 0 && (
                <CommandEmpty>
                  <div className="space-y-2 py-2 text-center">
                    <div className="text-sm">Nenhum cadastrado.</div>
                    <Button size="sm" variant="outline" onClick={() => { setOpen(false); setGuestOpen(true); }}>
                      <UserPlus className="mr-2 h-4 w-4" /> Adicionar como convidado
                    </Button>
                  </div>
                </CommandEmpty>
              )}
              {results.length > 0 && (
                <CommandGroup>
                  {results.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onMark({ work_id: workId, occurrence_date: date, user_id: p.id });
                        setOpen(false);
                        setQ("");
                      }}
                    >
                      {p.full_name ?? "(sem nome)"}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {q.trim().length > 0 && (
                <div className="border-t p-2">
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => { setOpen(false); setGuestOpen(true); }}>
                    <UserPlus className="mr-2 h-4 w-4" /> Adicionar como convidado…
                  </Button>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <GuestDialog
        open={guestOpen}
        onOpenChange={setGuestOpen}
        onSubmit={(g) => {
          onMark({ work_id: workId, occurrence_date: date, ...g });
          setGuestOpen(false);
        }}
      />
    </div>
  );
}

function GuestDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: { guest_name: string; guest_email?: string | null; guest_phone?: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setName(""); setEmail(""); setPhone(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar convidado</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          if (!email && !phone) { toast.error("Informe e-mail ou telefone."); return; }
          onSubmit({
            guest_name: name.trim(),
            guest_email: email.trim() || null,
            guest_phone: phone.trim() || null,
          });
        }}>
          <div>
            <Label>Nome *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="Para vincular caso crie conta depois" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder="Alternativa ao e-mail" />
          </div>
          <DialogFooter>
            <Button type="submit">Marcar presença</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
