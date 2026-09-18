import type { Database } from "@/integrations/supabase/types";

type SocialPost = Database["public"]["Tables"]["social_media_posts"]["Row"];

async function saveDelivery(postId: string, channel: string, values: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("social_post_deliveries")
    .select("id, attempt_count")
    .eq("post_id", postId)
    .eq("channel", channel)
    .is("destination_id", null)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin.from("social_post_deliveries").update({ ...values, attempt_count: existing.attempt_count + 1 }).eq("id", existing.id);
    return;
  }
  await supabaseAdmin.from("social_post_deliveries").insert({ post_id: postId, channel, ...values, attempt_count: 1 });
}

export async function publishCommunication(post: SocialPost) {
  const token = process.env['META_ACCESS_TOKEN'];
  const pageId = process.env['META_PAGE_ID'];
  const instagramId = process.env['META_INSTAGRAM_ACCOUNT_ID'];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("social_media_posts").update({ status: "publishing", last_error: null }).eq("id", post.id);
  const errors: string[] = [];

  for (const channel of post.channels) {
    try {
      let providerId = "";
      if (channel === "facebook") {
        if (!token || !pageId) throw new Error("Facebook ainda não está conectado.");
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
      } else if (channel === "instagram") {
        if (!token || !instagramId) throw new Error("Instagram ainda não está conectado.");
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
      } else if (channel === "whatsapp") {
        throw new Error("WhatsApp aguardando conexão oficial.");
      } else {
        throw new Error(`O envio por ${channel} ainda está em preparação.`);
      }
      await saveDelivery(post.id, channel, {
        status: "published", provider_post_id: providerId,
        published_at: new Date().toISOString(), last_attempt_at: new Date().toISOString(), error_message: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      errors.push(`${channel}: ${message}`);
      await saveDelivery(post.id, channel, {
        status: "failed", error_message: message,
        last_attempt_at: new Date().toISOString(),
      });
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

export const publishPostToMeta = publishCommunication;