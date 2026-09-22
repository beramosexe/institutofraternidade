import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth-context";

const searchSchema = z.object({ redirect: z.string().optional() });
const REMEMBER_KEY = "if-remember-me";

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Entrar — Instituto Fraternidade" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: redirect || "/app", replace: true });
    }
  }, [user, loading, redirect, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4 py-12">
      <Link to="/" className="mb-8"><Logo /></Link>
      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl text-foreground">Bem-vindo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse a área de associados do Instituto.
        </p>

        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="signin"><SignInForm /></TabsContent>
          <TabsContent value="signup"><SignUpForm /></TabsContent>
        </Tabs>

        {/* Google login removed */}{false && <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        }


      </Card>
      <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
        ← Voltar ao site
      </Link>
    </div>
  );
}

function PasswordInput({
  id, value, onChange, autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    return saved === null ? true : saved === "1";
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
      // Sinaliza para listener mover a sessão para sessionStorage quando não-lembrar.
      if (!remember) window.sessionStorage.setItem("if-session-only", "1");
      else window.sessionStorage.removeItem("if-session-only");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else if (!remember && typeof window !== "undefined") {
      // Move tokens de localStorage → sessionStorage para sumir ao fechar.
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("sb-")) keys.push(k);
      }
      for (const k of keys) {
        const v = window.localStorage.getItem(k);
        if (v) window.sessionStorage.setItem(k, v);
        window.localStorage.removeItem(k);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <Label htmlFor="si-email">E-mail</Label>
        <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="si-pass">Senha</Label>
        <PasswordInput id="si-pass" autoComplete="current-password" value={password} onChange={setPassword} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="remember" checked={remember} onCheckedChange={(c) => setRemember(c === true)} />
        <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
          Lembrar de mim
        </Label>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Verifique seu e-mail se a confirmação for necessária.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <Label htmlFor="su-name">Nome completo</Label>
        <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="su-email">E-mail</Label>
        <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="su-pass">Senha</Label>
        <PasswordInput id="su-pass" autoComplete="new-password" value={password} onChange={setPassword} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
      </Button>
    </form>
  );
}

