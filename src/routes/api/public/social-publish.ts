import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/social-publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const configuredSecret = process.env['SOCIAL_CRON_SECRET'];
        const suppliedSecret = request.headers.get("x-cron-secret");
        if (!configuredSecret || suppliedSecret !== configuredSecret) return json({ error: "Não autorizado." }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { publishPostToMeta } = await import("@/lib/social-media.server");
        const { data: posts, error } = await supabaseAdmin
          .from("social_media_posts")
          .select("*")
          .eq("status", "scheduled")
          .lte("scheduled_for", new Date().toISOString())
          .order("scheduled_for")
          .limit(10);
        if (error) return json({ error: "Não foi possível carregar os agendamentos." }, 500);

        let published = 0;
        let failed = 0;
        for (const post of posts ?? []) {
          try {
            await publishPostToMeta(post);
            published += 1;
          } catch {
            failed += 1;
          }
        }
        return json({ processed: (posts ?? []).length, published, failed });
      },
    },
  },
});