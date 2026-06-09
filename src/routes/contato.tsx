import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, MapPin } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Instituto Fraternidade" },
      { name: "description", content: "Fale com o Instituto Fraternidade." },
      { property: "og:title", content: "Contato — Instituto Fraternidade" },
      { property: "og:description", content: "Fale com o Instituto Fraternidade." },
    ],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Contato</p>
        <h1 className="mt-3 font-display text-4xl text-foreground sm:text-5xl">Fale com o Instituto</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Estamos à disposição para receber sua mensagem. Em breve disponibilizaremos
          um formulário; por ora, use um dos canais abaixo.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card className="p-6">
            <Mail className="h-5 w-5 text-brand" />
            <p className="mt-3 font-display text-lg text-foreground">E-mail</p>
            <p className="mt-1 text-sm text-muted-foreground">contato@institutofraternidade.org</p>
          </Card>
          <Card className="p-6">
            <MessageCircle className="h-5 w-5 text-brand" />
            <p className="mt-3 font-display text-lg text-foreground">WhatsApp</p>
            <p className="mt-1 text-sm text-muted-foreground">A definir</p>
          </Card>
          <Card className="p-6 sm:col-span-2">
            <MapPin className="h-5 w-5 text-brand" />
            <p className="mt-3 font-display text-lg text-foreground">Onde nos encontrar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os trabalhos acontecem em endereços divulgados na agenda.
            </p>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
