import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useMyAccess } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/app/pendente")({
  head: () => ({
    meta: [
      { title: "Cadastro em análise — Instituto Fraternidade" },
      { name: "description", content: "Seu cadastro de associado está aguardando validação da equipe do Instituto." },
      { property: "og:title", content: "Cadastro em análise — Instituto Fraternidade" },
      { property: "og:description", content: "Seu cadastro de associado está aguardando validação." },
    ],
  }),
  component: PendingPage,
});

function PendingPage() {
  const { data: access } = useMyAccess();
  return (
    <div className="mx-auto max-w-xl space-y-6 p-6 md:p-10">
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl text-foreground">Cadastro em análise</h1>
        <p className="mt-2 text-muted-foreground">
          Olá, {access?.profile?.full_name ?? "associado(a)"}. Seu cadastro foi criado e está aguardando
          validação da equipe de gestão de associados. Assim que for validado, suas áreas aparecerão aqui.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          A validação costuma acontecer em até alguns dias, conforme as reuniões da equipe de
          acolhimento. Se precisar corrigir alguma informação ou tiver pressa, fale com a equipe
          do Instituto pela página de contato.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/perfil">Editar meus dados</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/contato">Falar com a equipe</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
