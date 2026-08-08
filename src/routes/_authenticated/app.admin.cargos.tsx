import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/admin/cargos")({
  beforeLoad: () => {
    throw redirect({ to: "/app/admin" });
  },
});
