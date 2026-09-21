import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAttendanceLists, createAttendanceList } from "@/lib/attendance-lists.functions";
import { listWorks } from "@/lib/works.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/listas-presenca")({ component: AttendanceListsPage });

function AttendanceListsPage() {
  const listsFn = useServerFn(listAttendanceLists), worksFn = useServerFn(listWorks), createFn = useServerFn(createAttendanceList), qc = useQueryClient();
  const [open, setOpen] = useState(false), [title, setTitle] = useState(""), [description, setDescription] = useState(""), [date, setDate] = useState(""), [time, setTime] = useState(""), [workId, setWorkId] = useState("");
  const { data: lists = [] } = useQuery({ queryKey: ["attendance-lists"], queryFn: () => listsFn() });
  const { data: works = [] } = useQuery({ queryKey: ["works"], queryFn: () => worksFn() });
  const create = useMutation({ mutationFn: () => createFn({ data: { title, description: description || null, scheduled_at: new Date(`${date}T${time || "00:00"}:00`).toISOString(), work_id: workId || null } }), onSuccess: () => { toast.success("Lista criada."); setOpen(false); qc.invalidateQueries({ queryKey: ["attendance-lists"] }); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
    <div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.22em] text-brand">Gestão de associados</p><h1 className="font-display text-3xl">Listas de presença</h1><p className="text-muted-foreground">Crie listas para trabalhos, reuniões e encontros avulsos.</p></div><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4"/>Criar lista</Button></div>
    <div className="grid gap-3">{lists.length ? lists.map((l: any) => <Link key={l.id} to="/app/listas-presenca/$id" params={{ id: l.id }}><Card className="flex items-center justify-between p-4 hover:border-brand"><div><b>{l.title}</b><p className="text-sm text-muted-foreground">{new Date(l.scheduled_at).toLocaleString("pt-BR")} {l.works?.name ? `· ${l.works.name}` : "· Lista avulsa"}</p></div><span className="text-sm">{(l.attendance_list_entries ?? []).filter((x:any)=>x.present).length}/{(l.attendance_list_entries ?? []).length} presentes</span></Card></Link>) : <Card className="p-8 text-center text-muted-foreground">Nenhuma lista criada.</Card>}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Nova lista de presença</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Título</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Reunião de equipe"/></div><div className="grid grid-cols-2 gap-3"><div><Label>Data</Label><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div><Label>Horário</Label><Input type="time" value={time} onChange={e=>setTime(e.target.value)}/></div></div><div><Label>Vincular trabalho (opcional)</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={workId} onChange={e=>setWorkId(e.target.value)}><option value="">Lista independente</option>{works.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div><div><Label>Descrição</Label><Textarea value={description} onChange={e=>setDescription(e.target.value)}/></div><Button className="w-full" disabled={!title || !date || create.isPending} onClick={()=>create.mutate()}>Criar lista</Button></div></DialogContent></Dialog>
  </div>;
}