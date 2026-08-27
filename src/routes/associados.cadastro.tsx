import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { checkSignupPin, signUpAssociate } from "@/lib/signup.functions";

export const Route = createFileRoute("/associados/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro de associados — Instituto Fraternidade" },
      {
        name: "description",
        content:
          "Área de cadastro para associados do Instituto Fraternidade. É necessário o PIN fornecido pelo Instituto.",
      },
      { property: "og:title", content: "Cadastro de associados — Instituto Fraternidade" },
      {
        property: "og:description",
        content: "Crie sua conta de associado do Instituto Fraternidade com o PIN de cadastro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const check = useServerFn(checkSignupPin);
  const signUp = useServerFn(signUpAssociate);

  const [pin, setPin] = useState("");
  const [pinOk, setPinOk] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const pinMut = useMutation({
    mutationFn: () => check({ data: { pin } }),
    onSuccess: (res) => {
      if (res.ok) {
        setPinOk(true);
      } else if (res.reason === "unconfigured") {
        toast.error("O cadastro está temporariamente indisponível. Procure a administração.");
      } else {
        toast.error("PIN inválido.");
      }
    },
    onError: () => toast.error("Não foi possível verificar o PIN."),
  });

  const signMut = useMutation({
    mutationFn: () => signUp({ data: { pin, full_name: fullName, email, phone, password } }),
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
          Este cadastro é destinado às pessoas autorizadas pelo Instituto. Informe o PIN recebido para
          continuar. A conta é criada sem acesso interno e passa por validação da equipe.
        </p>

        <Card className="mt-8 p-6">
          {!pinOk ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                pinMut.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="pin">PIN de cadastro</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pin"
                    className="pl-9"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={pinMut.isPending}>
                {pinMut.isPending ? "Verificando…" : "Continuar"}
              </Button>
            </form>
          ) : (
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
                {signMut.isPending ? "Criando conta…" : "Criar cadastro"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Já tem conta? <Link to="/auth" className="text-brand underline">Entrar</Link>
          </p>
        </Card>
      </section>
      <SiteFooter />
    </>
  );
}
