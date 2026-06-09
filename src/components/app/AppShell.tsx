import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar, FileText, Headphones, Home, LogOut, Settings, Upload,
  Users as UsersIcon, ListChecks, History, ShieldCheck, Menu, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/me.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

export function useMyAccess() {
  const fn = useServerFn(getMyAccess);
  return useQuery({
    queryKey: ["my-access"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}

type NavItem = { to: string; label: string; icon: typeof Home; need?: string };

const NAV: NavItem[] = [
  { to: "/app", label: "Painel", icon: Home },
  { to: "/app/audios", label: "Áudios", icon: Headphones },
  { to: "/app/upload", label: "Enviar áudio", icon: Upload, need: "audio.upload" },
  { to: "/app/meus-uploads", label: "Meus uploads", icon: FileText, need: "audio.upload" },
  { to: "/app/revisao", label: "Revisão", icon: ListChecks, need: "transcription.review" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/app/admin/trabalhos", label: "Trabalhos", icon: Calendar, need: "work.manage" },
  { to: "/app/admin/audios", label: "Gestão de áudios", icon: Headphones, need: "audio.edit_any" },
  { to: "/app/admin/usuarios", label: "Usuários", icon: UsersIcon, need: "user.manage" },
  { to: "/app/admin/cargos", label: "Cargos", icon: ShieldCheck, need: "role.manage" },
  { to: "/app/admin/logs", label: "Logs", icon: History, need: "logs.view" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: access, isLoading } = useMyAccess();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const can = (need?: string) => !need || (access?.permissions ?? []).includes(need) || access?.isAdmin;

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-1">
      {NAV.filter((i) => can(i.need)).map((i) => {
        const Icon = i.icon;
        const active = path === i.to || (i.to !== "/app" && path.startsWith(i.to));
        return (
          <Link
            key={i.to}
            to={i.to}
            onClick={onClick}
            className={[
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {i.label}
          </Link>
        );
      })}
      {ADMIN_NAV.some((i) => can(i.need)) && (
        <>
          <div className="mt-6 px-3 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">
            Administração
          </div>
          {ADMIN_NAV.filter((i) => can(i.need)).map((i) => {
            const Icon = i.icon;
            const active = path.startsWith(i.to);
            return (
              <Link
                key={i.to}
                to={i.to}
                onClick={onClick}
                className={[
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {i.label}
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="p-5"><Link to="/"><Logo /></Link></div>
        <div className="flex-1 px-3 py-2"><NavLinks /></div>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-3 text-xs text-sidebar-foreground/70 truncate">
            {access?.profile?.full_name ?? "Carregando…"}
          </div>
          <div className="flex gap-2">
            <Link to="/app/perfil" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" /> Perfil
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
          <Link to="/app"><Logo /></Link>
          <button
            className="rounded-md p-2"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        {mobileOpen && (
          <div className="border-b border-border bg-sidebar px-3 py-3 md:hidden">
            <NavLinks onClick={() => setMobileOpen(false)} />
            <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 w-full justify-start gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        )}

        <main className="min-w-0 flex-1">
          {isLoading ? <div className="p-8 text-muted-foreground">Carregando…</div> : children}
        </main>
      </div>
    </div>
  );
}
