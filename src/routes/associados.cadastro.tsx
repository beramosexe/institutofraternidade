import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUpAssociate } from "@/lib/signup.functions";

export const Route = createFileRoute("/associados/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro de associados — Instituto Fraternidade" },
      {
        name: "description",
        content:
          "Formulário público de cadastro para associados do Instituto Fraternidade, sujeito à validação da equipe.",
      },
      { property: "og:title", content: "Cadastro de associados — Instituto Fraternidade" },
      {
        property: "og:description",
        content: "Solicite seu cadastro de associado do Instituto Fraternidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const signUp = useServerFn(signUpAssociate);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState("");

  const signMut = useMutation({
    mutationFn: () => signUp({ data: { full_name: fullName, email, phone, password } }),
    onSuccess: () => {
      toast.success("Cadastro criado! Faça login para acompanhar a validação.");
      navigate({ to: "/auth" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-lg px-6 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Associados</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Cadastro de associados</h1>
        <p className="mt-2 text-muted-foreground">
          Este formulário é destinado a pessoas que desejam se cadastrar como associadas do Instituto. Informe o PIN recebido para
          continuar. A conta é criada sem acesso interno e passa por validação da equipe.
        </p>

        <Card className="mt-8 p-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
            </div>
            <Button type="submit" className="w-full" disabled={signMut.isPending}>
              {signMut.isPending ? "Enviando cadastro…" : "Enviar cadastro"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Seu cadastro será analisado manualmente antes de liberar o acesso de associado.
            </p>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Já tem conta? <Link to="/auth" className="text-brand underline">Entrar</Link>
          </p>
        </Card>
      </section>
      <SiteFooter />
    </>
  );
}
