import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/quem-somos")({
  head: () => ({
    meta: [
      { title: "Quem somos — Instituto Fraternidade" },
      { name: "description", content: "Conheça a história, a missão e os valores do Instituto Fraternidade." },
      { property: "og:title", content: "Quem somos — Instituto Fraternidade" },
      { property: "og:description", content: "Nossa história, missão e valores." },
    ],
  }),
  component: QuemSomosPage,
});

function QuemSomosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Quem somos</p>
        <h1 className="mt-3 font-display text-4xl text-balance text-foreground sm:text-5xl">
          Uma casa de estudo, oração e serviço.
        </h1>
        <div className="prose prose-neutral mt-10 max-w-none text-foreground/90">
          <p className="text-lg leading-relaxed text-muted-foreground">
            O Instituto Fraternidade nasceu do desejo de oferecer um espaço sereno
            para pessoas que buscam o estudo continuado, a vivência espiritual e o
            serviço ao próximo. Nossos trabalhos acontecem regularmente e reúnem
            participantes de diferentes caminhos, unidos por valores comuns de
            respeito, escuta e fraternidade.
          </p>
          <h2 className="mt-12 font-display text-2xl text-foreground">Missão</h2>
          <p className="text-muted-foreground">
            Acolher, iluminar e servir. Promover o estudo, a meditação e o
            trabalho fraterno como caminhos de transformação pessoal e coletiva.
          </p>
          <h2 className="mt-10 font-display text-2xl text-foreground">Valores</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { t: "Acolhimento", d: "Recebemos cada pessoa com escuta e respeito." },
              { t: "Estudo contínuo", d: "Buscamos compreender, sem dogmas." },
              { t: "Serviço", d: "O conhecimento se realiza no fazer." },
              { t: "Fraternidade", d: "Caminhamos juntos, em comunidade." },
            ].map((v) => (
              <li key={v.t}>
                <Card className="p-5">
                  <p className="font-display text-lg text-foreground">{v.t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{v.d}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
