import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Headphones, Upload, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMyAccess } from "@/components/app/AppShell";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: access } = useMyAccess();
  const can = (p: string) => access?.isAdmin || access?.permissions.includes(p);

  const { data: recentAudios } = useQuery({
    queryKey: ["dashboard", "recent-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select("id, title, status, published_at, audio_type, message_source")
        .order("published_at", { ascending: false })
        .limit(5);
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction to="/app/audios" icon={Headphones} title="Biblioteca de áudios" />
        {can("audio.upload") && <QuickAction to="/app/upload" icon={Upload} title="Enviar áudio" />}
        {can("transcription.review") && <QuickAction to="/app/revisao" icon={ListChecks} title="Revisar transcrições" />}
        {can("work.manage") && <QuickAction to="/app/admin/trabalhos" icon={Calendar} title="Gerenciar trabalhos" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-foreground">Áudios recentes</h2>
            <Link to="/app/audios" className="text-sm text-brand hover:underline">Ver biblioteca →</Link>
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

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-foreground">Próximos trabalhos</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(upcoming ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum trabalho agendado.</p>
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
      </div>
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
