import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Headphones, Upload, ListChecks, UserCheck, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countPendingMembers } from "@/lib/members.functions";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useMyAccess } from "@/components/app/AppShell";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: access } = useMyAccess();
  const can = (p: string) => access?.isAdmin || access?.permissions.includes(p);
  const canManageMembers = !!can("member.manage") || !!can("member.validate");

  const pendingFn = useServerFn(countPendingMembers);
  const { data: pending } = useQuery({
    queryKey: ["pending-members-count"],
    queryFn: () => pendingFn(),
    enabled: canManageMembers,
    staleTime: 30_000,
  });

  const { data: recentAudios } = useQuery({
    queryKey: ["dashboard", "recent-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select("id, title, status, published_at, audio_type, message_source")
        .order("published_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["dashboard", "upcoming"],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id, name, starts_at, location")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      return data ?? [];
    },
  });

  if (access?.isPending) return <Navigate to="/app/pendente" replace />;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Painel</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">
          Olá, {access?.profile?.full_name?.split(" ")[0] ?? "associado"}.
        </h1>
        <p className="mt-1 text-muted-foreground">
          Bem-vindo à área restrita do Instituto.
        </p>
      </div>

      {canManageMembers && (pending?.count ?? 0) > 0 && (
        <Link to="/app/associados">
          <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/40 bg-brand-soft/40 p-5 transition-colors hover:bg-brand-soft/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Cadastros pendentes</p>
                <p className="text-xs text-muted-foreground">
                  Há associados aguardando validação da equipe.
                </p>
              </div>
            </div>
            <Badge>{pending?.count}</Badge>
          </Card>
        </Link>
      )}

      <Tabs defaultValue="quick" className="w-full">
        <TabsList className="mb-6 h-auto w-full flex-wrap justify-start sm:w-auto sm:flex-nowrap">
          <TabsTrigger value="quick" className="w-full sm:w-auto">Acesso Rápido</TabsTrigger>
          <TabsTrigger value="audios" className="w-full sm:w-auto">Seus áudios recentes</TabsTrigger>
          <TabsTrigger value="works" className="w-full sm:w-auto">Próximos encontros</TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="mt-0 outline-none">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction to="/app/audios" icon={Headphones} title="Biblioteca de áudios" />
            {can("audio.upload") && <QuickAction to="/app/upload" icon={Upload} title="Enviar áudio" />}
            {can("transcription.review") && <QuickAction to="/app/revisao" icon={ListChecks} title="Revisar transcrições" />}
            {can("work.manage") && <QuickAction to="/app/admin/trabalhos" icon={Calendar} title="Gerenciar trabalhos" />}
          </div>
        </TabsContent>

        <TabsContent value="audios" className="mt-0 outline-none">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-foreground">Seus áudios recentes</h2>
              <Link to="/app/audios" className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                Ver mais <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {(recentAudios ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum áudio disponível ainda.</p>
              ) : recentAudios?.map((a) => (
                <Link key={a.id} to="/app/audios/$id" params={{ id: a.id }} className="block rounded-md border border-border p-3 hover:bg-accent/40">
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.message_source ?? "—"} · {a.status === "ready" ? "Pronto" : a.status === "transcribing" ? "Transcrevendo…" : a.status}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="works" className="mt-0 outline-none">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-foreground">Próximos encontros</h2>
            </div>
            <div className="mt-4 space-y-3">
              {(upcoming ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento agendado.</p>
              ) : upcoming?.map((w) => (
                <div key={w.id} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(w.starts_at), "EEEE, d 'de' MMM · HH:mm", { locale: ptBR })}
                    {w.location ? ` · ${w.location}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title }: { to: string; icon: typeof Calendar; title: string }) {
  return (
    <Link to={to}>
      <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:bg-accent/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </Card>
    </Link>
  );
}
