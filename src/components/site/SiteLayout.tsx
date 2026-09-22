import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const links = [
  { to: "/", label: "Início" },
  { to: "/quem-somos", label: "Quem somos" },
  { to: "/agenda", label: "Agenda" },
  { to: "/canalizacoes", label: "Canalizações" },
  { to: "/postagens", label: "Postagens" },
  { to: "/contato", label: "Contato" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center"><Logo /></Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-medium"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          {user ? (
            <Button asChild size="sm"><Link to="/app">Área do associado</Link></Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline"><Link to="/auth">Entrar</Link></Button>
            </div>
          )}
        </div>

        <button
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 p-4">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to={user ? "/app" : "/auth"}
              onClick={() => setOpen(false)}
              className="mt-2 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              {user ? "Área do associado" : "Entrar"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Espaço de estudo, acolhimento e fraternidade. Trabalhos abertos à comunidade
            e biblioteca de canalizações para associados.
          </p>
        </div>
        <div>
          <h4 className="font-display text-sm tracking-wide text-foreground">Navegação</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-foreground">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm tracking-wide text-foreground">Associados</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-foreground">Entrar na área restrita</Link></li>
            <li><Link to="/contato" className="hover:text-foreground">Falar com a equipe</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Instituto Fraternidade
      </div>
    </footer>
  );
}
