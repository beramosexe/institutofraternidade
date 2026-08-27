import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createClass, createFormationLevel, listClasses, listFormationLevels, updateClass,
} from "@/lib/classes.functions";
import { CLASS_STATUS_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/associados/turmas")({
  head: () => ({
    meta: [
      { title: "Turmas e níveis — Instituto Fraternidade" },
      { name: "description", content: "Crie e acompanhe turmas de formação e os níveis do Instituto Fraternidade." },
      { property: "og:title", content: "Turmas e níveis — Instituto Fraternidade" },
      { property: "og:description", content: "Gestão de turmas de formação e níveis." },
    ],
  }),
  component: ClassesPage,
});

const STATUSES = ["planned", "open", "ongoing", "closed", "cancelled"] as const;

function ClassesPage() {
  const qc = useQueryClient();
  const classesFn = useServerFn(listClasses);
  const levelsFn = useServerFn(listFormationLevels);
  const createClassFn = useServerFn(createClass);
  const updateClassFn = useServerFn(updateClass);
  const createLevelFn = useServerFn(createFormationLevel);

  const { data: classes, isLoading } = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });
  const { data: levels } = useQuery({ queryKey: ["formation-levels"], queryFn: () => levelsFn() });

  const [name, setName] = useState("");
  const [levelId, setLevelId] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState<string>("planned");
  const [levelName, setLevelName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["classes"] });

  const create = useMutation({
    mutationFn: () =>
      createClassFn({
        data: {
          name,
          level_id: levelId || null,
          period: period || undefined,
          status,
        },
      }),
    onSuccess: () => {
      toast.success("Turma criada.");
      setName(""); setLevelId(""); setPeriod(""); setStatus("planned");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) => updateClassFn({ data: v }),
    onSuccess: () => { toast.success("Turma atualizada."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLevel = useMutation({
    mutationFn: () => createLevelFn({ data: { name: levelName } }),
    onSuccess: () => {
      toast.success("Nível criado.");
      setLevelName("");
      qc.invalidateQueries({ queryKey: ["formation-levels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/app/associados"><ArrowLeft className="mr-2 h-4 w-4" /> Associados</Link>
        </Button>
        <h1 className="font-display text-3xl text-foreground">Turmas e níveis</h1>
        <p className="mt-1 text-muted-foreground">
          Organize as turmas de formação e os níveis do curso.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl text-foreground">Nova turma</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cname">Nome</Label>
            <Input id="cname" placeholder="Ex.: Básico 2026/1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nível</Label>
            <Select value={levelId} onValueChange={setLevelId}>
              <SelectTrigger><SelectValue placeholder="Selecione o nível" /></SelectTrigger>
              <SelectContent>
                {(levels ?? []).map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="period">Período</Label>
            <Input id="period" placeholder="Ex.: 2026/1" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Situação</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{CLASS_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => create.mutate()} disabled={name.trim().length < 2 || create.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Criar turma
        </Button>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Turmas</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (classes ?? []).length === 0 ? (
          <Card className="p-6 text-muted-foreground">Nenhuma turma criada ainda.</Card>
        ) : (
          (classes ?? []).map((c: any) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.level_name ?? "Sem nível"}{c.period ? ` · ${c.period}` : ""} · {c.member_count} ativo(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {CLASS_STATUS_LABELS[c.status as keyof typeof CLASS_STATUS_LABELS]}
                </Badge>
                <Select value={c.status} onValueChange={(v) => changeStatus.mutate({ id: c.id, status: v })}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{CLASS_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          ))
        )}
      </section>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl text-foreground">Níveis de formação</h2>
        <div className="flex flex-wrap gap-2">
          {(levels ?? []).map((l: any) => (
            <Badge key={l.id} variant="outline">{l.name}</Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Novo nível…" value={levelName} onChange={(e) => setLevelName(e.target.value)} />
          <Button variant="outline" onClick={() => addLevel.mutate()} disabled={levelName.trim().length < 2}>
            Adicionar
          </Button>
        </div>
      </Card>
    </div>
  );
}
