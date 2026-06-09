import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, Headphones, Heart, Sparkles } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Instituto Fraternidade — Acolher, iluminar, servir" },
      { name: "description", content: "Comunidade espiritualista dedicada ao estudo, ao acolhimento e ao trabalho fraterno. Conheça nossos trabalhos e canalizações." },
      { property: "og:title", content: "Instituto Fraternidade" },
      { property: "og:description", content: "Comunidade espiritualista dedicada ao estudo, ao acolhimento e ao trabalho fraterno." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: upcoming } = useQuery({
    queryKey: ["home", "upcoming-works"],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id, name, starts_at, location")
        .eq("visibility", "public")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: publicAudios } = useQuery({
    queryKey: ["home", "public-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select("id, title, message_source, recorded_at")
        .eq("access_level", "public")
        .eq("status", "ready")
        .order("published_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-[0.07]" />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-brand">
                Bem-vindo
              </p>
              <h1 className="mt-3 font-display text-4xl text-balance text-foreground sm:text-5xl md:text-6xl">
                Um espaço sereno para o estudo, o acolhimento e o trabalho fraterno.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                O Instituto Fraternidade reúne pessoas dispostas a caminhar juntas
                em busca de luz, paz e serviço. Nossos trabalhos são abertos à
                comunidade, e nossa biblioteca de canalizações está disponível para
                associados e participantes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to="/agenda">Próximos trabalhos <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/canalizacoes">Canalizações públicas</Link></Button>
              </div>
            </div>
            <div className="relative mx-auto">
              <div className="absolute inset-0 -z-10 rounded-full bg-brand/15 blur-3xl" />
              <Logo variant="mark" className="h-64 w-64 shadow-lg ring-1 ring-border md:h-72 md:w-72" />
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-y border-border/60 bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            { icon: Heart, title: "Acolher", body: "Espaço seguro de escuta, fraternidade e cuidado mútuo." },
            { icon: Sparkles, title: "Iluminar", body: "Estudo continuado e mensagens recebidas em trabalhos." },
            { icon: Headphones, title: "Servir", body: "Trabalhos abertos, biblioteca viva e ação solidária." },
          ].map((p) => (
            <div key={p.title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <p.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-xl text-foreground">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-brand">Agenda</p>
            <h2 className="mt-2 font-display text-3xl text-foreground">Próximos trabalhos</h2>
          </div>
          <Link to="/agenda" className="text-sm text-muted-foreground hover:text-foreground">
            Ver agenda completa →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(upcoming ?? []).length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-3 h-6 w-6" />
              Nenhum trabalho público agendado no momento.
            </Card>
          ) : (
            upcoming?.map((w) => (
              <Card key={w.id} className="p-6">
                <p className="text-xs uppercase tracking-wider text-brand">
                  {format(new Date(w.starts_at), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <h3 className="mt-2 font-display text-xl text-foreground">{w.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.location ?? "Local a definir"}</p>
                <p className="mt-3 text-sm text-foreground">
                  {format(new Date(w.starts_at), "HH:mm")}
                </p>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Public audios */}
      <section className="bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-brand">Canalizações</p>
              <h2 className="mt-2 font-display text-3xl text-foreground">Mensagens públicas</h2>
            </div>
            <Link to="/canalizacoes" className="text-sm text-muted-foreground hover:text-foreground">
              Ver todas →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(publicAudios ?? []).length === 0 ? (
              <Card className="col-span-full p-8 text-center text-muted-foreground">
                <Headphones className="mx-auto mb-3 h-6 w-6" />
                Em breve, novas canalizações públicas.
              </Card>
            ) : (
              publicAudios?.map((a) => (
                <Card key={a.id} className="p-6">
                  <p className="text-xs uppercase tracking-wider text-brand">
                    {a.message_source ?? "Mensagem"}
                  </p>
                  <h3 className="mt-2 font-display text-lg text-foreground">{a.title}</h3>
                  {a.recorded_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Gravada em {format(new Date(a.recorded_at), "d MMM yyyy", { locale: ptBR })}
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-3xl text-balance text-foreground sm:text-4xl">
          Quer fazer parte do Instituto?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Se sente o chamado para estudar, servir e caminhar com a gente,
          entre em contato. Recebemos novos participantes ao longo de todo o ano.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/contato">Falar com o Instituto</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">Já sou associado</Link></Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
