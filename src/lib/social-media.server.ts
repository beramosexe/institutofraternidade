import type { Database } from "@/integrations/supabase/types";

type SocialPost = Database["public"]["Tables"]["social_media_posts"]["Row"];

export async function publishPostToMeta(post: SocialPost) {
  const token = process.env['META_ACCESS_TOKEN'];
  const pageId = process.env['META_PAGE_ID'];
  const instagramId = process.env['META_INSTAGRAM_ACCOUNT_ID'];
  if (!token || !pageId || !instagramId) throw new Error("A conexão com a Meta ainda não foi configurada.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("social_media_posts").update({ status: "publishing", last_error: null }).eq("id", post.id);
  const errors: string[] = [];

  for (const channel of post.channels) {
    try {
      let providerId = "";
      if (channel === "facebook") {
        const endpoint = post.media_url ? `${pageId}/photos` : `${pageId}/feed`;
        const body = post.media_url
          ? { url: post.media_url, caption: post.content_text, access_token: token }
          : { message: post.content_text, access_token: token };
        const response = await fetch(`https://graph.facebook.com/v23.0/${endpoint}`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
        });
        const result = await response.json() as { id?: string; post_id?: string; error?: { message?: string } };
        if (!response.ok) throw new Error(result.error?.message ?? "Falha no Facebook.");
        providerId = result.post_id ?? result.id ?? "";
      } else {
        if (!post.media_url) throw new Error("O Instagram exige uma imagem pública.");
        const containerResponse = await fetch(`https://graph.facebook.com/v23.0/${instagramId}/media`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ image_url: post.media_url, caption: post.content_text, access_token: token }),
        });
        const container = await containerResponse.json() as { id?: string; error?: { message?: string } };
        if (!containerResponse.ok || !container.id) throw new Error(container.error?.message ?? "Falha ao preparar Instagram.");
        const publishResponse = await fetch(`https://graph.facebook.com/v23.0/${instagramId}/media_publish`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ creation_id: container.id, access_token: token }),
        });
        const published = await publishResponse.json() as { id?: string; error?: { message?: string } };
        if (!publishResponse.ok) throw new Error(published.error?.message ?? "Falha no Instagram.");
        providerId = published.id ?? "";
      }
      await supabaseAdmin.from("social_post_deliveries").upsert({
        post_id: post.id, channel, status: "published", provider_post_id: providerId,
        published_at: new Date().toISOString(), last_attempt_at: new Date().toISOString(), error_message: null,
      }, { onConflict: "post_id,channel" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      errors.push(`${channel}: ${message}`);
      await supabaseAdmin.from("social_post_deliveries").upsert({
        post_id: post.id, channel, status: "failed", error_message: message,
        last_attempt_at: new Date().toISOString(),
      }, { onConflict: "post_id,channel" });
    }
  }

  await supabaseAdmin.from("social_media_posts").update({
    status: errors.length ? "failed" : "published",
    published_at: errors.length ? null : new Date().toISOString(),
    last_error: errors.length ? errors.join(" | ") : null,
    attempt_count: post.attempt_count + 1,
  }).eq("id", post.id);
  if (errors.length) throw new Error(errors.join(" | "));
}