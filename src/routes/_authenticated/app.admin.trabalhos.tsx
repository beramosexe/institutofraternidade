import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash, CalendarCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listWorks, createWork, updateWork, deleteWork, getWorkDetail } from "@/lib/works.functions";
import { WORK_STATUS_LABELS } from "@/lib/permissions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserMultiSelect } from "@/components/app/UserMultiSelect";
import { EntityMultiSelect } from "@/components/app/EntityMultiSelect";

export const Route = createFileRoute("/_authenticated/app/admin/trabalhos")({
  component: AdminWorks,
});

type WorkRow = Awaited<ReturnType<typeof listWorks>>[number];
type Modality = "presencial" | "online" | "hibrido" | "externo";
type Recurrence = "one_off" | "weekly";
type Status = "draft" | "published" | "completed" | "archived";
type Visibility = "public" | "internal";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MODALITY_LABELS: Record<Modality, string> = {
  presencial: "Presencial",
  online: "Online",
  hibrido: "Híbrido",
  externo: "Externo (fora da sede)",
};

type FormPayload = {
  id?: string;
  name: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  status: Status;
  visibility: Visibility;
  modality?: Modality | null;
  recurrence: Recurrence;
  recurrence_weekday?: number | null;
  recurrence_time?: string | null;
  responsible_ids?: string[];
  favorite_entity_ids?: string[];
  participant_ids?: string[];
};

function AdminWorks() {
  const list = useServerFn(listWorks);
  const create = useServerFn(createWork);
  const update = useServerFn(updateWork);
  const del = useServerFn(deleteWork);
  const qc = useQueryClient();

  const { data: works } = useQuery({ queryKey: ["admin-works"], queryFn: () => list() });
  const [editing, setEditing] = useState<WorkRow | null>(null);
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: async (vals: FormPayload) => {
      const { id, ...rest } = vals;
      if (id) await update({ data: { id, patch: rest } });
      else await create({ data: rest });
    },
    onSuccess: () => {
      toast.success("Trabalho salvo.");
      qc.invalidateQueries({ queryKey: ["admin-works"] });
      qc.invalidateQueries({ queryKey: ["works-options"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Trabalho removido.");
      qc.invalidateQueries({ queryKey: ["admin-works"] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Trabalhos / Agenda</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" /> Novo trabalho
            </Button>
          </DialogTrigger>
          <WorkDialog initial={editing} onSubmit={(v) => mut.mutate(v)} saving={mut.isPending} />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {(works ?? []).length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">Nenhum trabalho cadastrado.</Card>
        ) : works?.map((w) => (
          <Card key={w.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl text-foreground">{w.name}</h2>
                <p className="text-sm text-brand">
                  {w.recurrence === "weekly" && w.recurrence_weekday != null && w.recurrence_time
                    ? `Semanal · ${WEEKDAYS[w.recurrence_weekday]} às ${w.recurrence_time.slice(0, 5)}`
                    : format(new Date(w.starts_at), "EEEE, d 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {w.location && <span>{w.location}</span>}
                  {w.modality && <Badge variant="outline">{MODALITY_LABELS[w.modality as Modality]}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={w.visibility === "public" ? "default" : "secondary"}>
                  {w.visibility === "public" ? "Público" : "Interno"}
                </Badge>
                <Badge variant="outline">{WORK_STATUS_LABELS[w.status]}</Badge>
                <Link to="/app/trabalhos/$id/checkin" params={{ id: w.id }}>
                  <Button size="icon" variant="outline" title="Check-in">
                    <CalendarCheck className="h-4 w-4" />
                  </Button>
                </Link>
                <Button size="icon" variant="outline" onClick={() => { setEditing(w); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => {
                  if (confirm(`Excluir "${w.name}"?`)) delMut.mutate(w.id);
                }}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {w.description && <p className="mt-3 text-sm text-muted-foreground">{w.description}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkDialog({
  initial, onSubmit, saving,
}: {
  initial: WorkRow | null;
  onSubmit: (v: FormPayload) => void;
  saving: boolean;
}) {
  const getDetail = useServerFn(getWorkDetail);
  const { data: detail } = useQuery({
    queryKey: ["work-detail", initial?.id],
    queryFn: () => getDetail({ data: { id: initial!.id } }),
    enabled: !!initial?.id,
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startsAt, setStartsAt] = useState(initial?.starts_at ? initial.starts_at.slice(0, 16) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "draft");
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "internal");
  const [modality, setModality] = useState<Modality | "">((initial?.modality as Modality | null) ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>((initial?.recurrence as Recurrence) ?? "one_off");
  const [weekday, setWeekday] = useState<string>(
    initial?.recurrence_weekday != null ? String(initial.recurrence_weekday) : "",
  );
  const [time, setTime] = useState<string>(initial?.recurrence_time?.slice(0, 5) ?? "");

  const [responsibles, setResponsibles] = useState<string[]>([]);
  const [favEntities, setFavEntities] = useState<string[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    if (detail) {
      setResponsibles(detail.responsible_ids);
      setFavEntities(detail.favorite_entity_ids);
      setParticipants(detail.participant_ids);
    }
  }, [detail]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{initial ? "Editar trabalho" : "Novo trabalho"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const startsIso = startsAt
          ? new Date(startsAt).toISOString()
          : new Date().toISOString();
        onSubmit({
          id: initial?.id,
          name, description: description || null,
          starts_at: startsIso,
          location: location || null,
          status, visibility,
          modality: modality || null,
          recurrence,
          recurrence_weekday: recurrence === "weekly" && weekday !== "" ? Number(weekday) : null,
          recurrence_time: recurrence === "weekly" && time ? `${time}:00` : null,
          responsible_ids: responsibles,
          favorite_entity_ids: favEntities,
          participant_ids: participants,
        });
      }}>
        <div>
          <Label>Nome *</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Recorrência</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one_off">Pontual (uma vez)</SelectItem>
                <SelectItem value="weekly">Semanal (recorrente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modalidade</Label>
            <Select value={modality || "_none"} onValueChange={(v) => setModality(v === "_none" ? "" : v as Modality)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Não definida —</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="hibrido">Híbrido (presencial + online)</SelectItem>
                <SelectItem value="externo">Externo (fora da sede)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {recurrence === "weekly" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Dia da semana *</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hora *</Label>
              <Input type="time" required={recurrence === "weekly"} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label>Início (1ª data)</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
          </div>
        ) : (
          <div>
            <Label>Data e hora *</Label>
            <Input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
        )}

        <div>
          <Label>Local</Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            placeholder={modality === "externo" ? "Endereço completo (modalidade externa)" : "Sede do instituto, sala, link…"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visibilidade</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Pública (site)</SelectItem>
                <SelectItem value="internal">Interna (associados)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Descrição</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>

        <div className="border-t pt-4">
          <Label className="text-sm font-semibold">Responsáveis pelo trabalho</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Podem editar este trabalho, gerenciar check-in e áudios vinculados.
          </p>
          <UserMultiSelect value={responsibles} onChange={setResponsibles} placeholder="Adicionar responsável…" />
        </div>

        <div>
          <Label className="text-sm font-semibold">Participantes frequentes</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Aparecem automaticamente na lista de presença.
          </p>
          <UserMultiSelect value={participants} onChange={setParticipants} placeholder="Adicionar participante…" />
        </div>

        <div>
          <Label className="text-sm font-semibold">Entidades canalizadoras frequentes</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Estas entidades aparecem primeiro no menu de "Mensagem de quem" para áudios deste trabalho.
          </p>
          <EntityMultiSelect value={favEntities} onChange={setFavEntities} />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving}>Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
