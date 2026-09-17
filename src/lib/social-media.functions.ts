import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const channelsSchema = z.array(z.enum(["instagram", "facebook"])).min(1).max(2);
const statusSchema = z.enum(["draft", "pending_approval", "scheduled", "published", "failed", "cancelled"]);

const postSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  content_text: z.string().trim().min(1).max(5000),
  media_url: z.string().url().nullable().optional(),
  channels: channelsSchema,
  scheduled_for: z.string().datetime().nullable().optional(),
  status: statusSchema,
});

async function assertMediaPermission(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
) {
  const [{ data: admin }, { data: allowed }] = await Promise.all([
    supabase.rpc("is_admin", { _user_id: userId }),
    supabase.rpc("has_permission", { _user_id: userId, _permission: "media.manage" }),
  ]);
  if (!admin && !allowed) throw new Error("Você não tem permissão para gerenciar mídias.");
}

export const listSocialCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const [{ data: posts, error }, { data: works }, { data: settings }] = await Promise.all([
      context.supabase
        .from("social_media_posts")
        .select("*, social_post_deliveries(*)")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("works")
        .select("id, name, starts_at, recurrence, recurrence_weekday, recurrence_time, location, status")
        .in("status", ["published", "draft"])
        .order("starts_at"),
      context.supabase.from("work_social_settings").select("*"),
    ]);
    if (error) throw new Error(error.message);
    return { posts: posts ?? [], works: works ?? [], settings: settings ?? [] };
  });

export const saveSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof postSchema>) => postSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const { id, ...values } = data;
    const row = {
      ...values,
      title: values.title || null,
      media_url: values.media_url || null,
      scheduled_for: values.scheduled_for || null,
      approved_at: values.status === "scheduled" ? new Date().toISOString() : null,
      approved_by: values.status === "scheduled" ? context.userId : null,
    };
    if (id) {
      const { error } = await context.supabase.from("social_media_posts").update(row).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await context.supabase
      .from("social_media_posts")
      .insert({ ...row, source: "manual", created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateSocialPostStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: z.infer<typeof statusSchema> }) =>
    z.object({ id: z.string().uuid(), status: statusSchema }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const approval = data.status === "scheduled"
      ? { approved_at: new Date().toISOString(), approved_by: context.userId, last_error: null }
      : {};
    const { error } = await context.supabase
      .from("social_media_posts")
      .update({ status: data.status, ...approval })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const { error } = await context.supabase.from("social_media_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const settingSchema = z.object({
  work_id: z.string().uuid(),
  enabled: z.boolean(),
  channels: channelsSchema,
  reminder_minutes: z.array(z.number().int().min(30).max(43200)).min(1).max(6),
  template_text: z.string().trim().min(1).max(3000),
  media_url: z.string().url().nullable().optional(),
  approval_mode: z.enum(["manual", "automatic"]),
});

export const saveWorkSocialSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof settingSchema>) => settingSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const { error } = await context.supabase.from("work_social_settings").upsert(
      { ...data, media_url: data.media_url || null, created_by: context.userId },
      { onConflict: "work_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function nextOccurrence(work: {
  starts_at: string;
  recurrence: string;
  recurrence_weekday: number | null;
  recurrence_time: string | null;
}) {
  const now = new Date();
  if (work.recurrence !== "weekly" || work.recurrence_weekday == null) return new Date(work.starts_at);
  const next = new Date(now);
  const days = (work.recurrence_weekday - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + days);
  const [hours, minutes] = (work.recurrence_time ?? "19:00").split(":").map(Number);
  next.setHours(hours ?? 19, minutes ?? 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 7);
  return next;
}

function renderTemplate(template: string, work: { name: string; location: string | null }, occurrence: Date) {
  return template
    .replaceAll("{{work_name}}", work.name)
    .replaceAll("{{date}}", occurrence.toLocaleDateString("pt-BR"))
    .replaceAll("{{time}}", occurrence.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
    .replaceAll("{{location}}", work.location ?? "");
}

export const generateWorkReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId?: string }) => z.object({ workId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    let settingsQuery = context.supabase.from("work_social_settings").select("*").eq("enabled", true);
    if (data.workId) settingsQuery = settingsQuery.eq("work_id", data.workId);
    const { data: settings, error } = await settingsQuery;
    if (error) throw new Error(error.message);
    let created = 0;
    for (const setting of settings ?? []) {
      const { data: work } = await context.supabase
        .from("works")
        .select("id, name, starts_at, recurrence, recurrence_weekday, recurrence_time, location")
        .eq("id", setting.work_id)
        .maybeSingle();
      if (!work) continue;
      const occurrence = nextOccurrence(work);
      for (const minutes of setting.reminder_minutes) {
        const { data: existing } = await context.supabase
          .from("social_media_posts")
          .select("id")
          .eq("work_id", work.id)
          .eq("occurrence_at", occurrence.toISOString())
          .eq("reminder_minutes", minutes)
          .maybeSingle();
        if (existing) continue;
        const scheduled = new Date(occurrence.getTime() - minutes * 60_000);
        const automatic = setting.approval_mode === "automatic";
        const { error: insertError } = await context.supabase.from("social_media_posts").insert({
          title: `Lembrete · ${work.name}`,
          content_text: renderTemplate(setting.template_text, work, occurrence),
          media_url: setting.media_url,
          channels: setting.channels,
          scheduled_for: scheduled.toISOString(),
          status: automatic ? "scheduled" : "draft",
          approval_mode: setting.approval_mode,
          approved_at: automatic ? new Date().toISOString() : null,
          approved_by: automatic ? context.userId : null,
          source: "work_reminder",
          work_id: work.id,
          occurrence_at: occurrence.toISOString(),
          reminder_minutes: minutes,
          created_by: context.userId,
        });
        if (insertError) throw new Error(insertError.message);
        created += 1;
      }
    }
    return { created };
  });

export const getMetaConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMediaPermission(context.supabase, context.userId);
    return {
      configured: Boolean(
        process.env['META_ACCESS_TOKEN'] &&
        process.env['META_PAGE_ID'] &&
        process.env['META_INSTAGRAM_ACCOUNT_ID']
      ),
    };
  });

export const publishSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin.from("social_media_posts").select("*").eq("id", data.id).single();
    if (!post) throw new Error("Publicação não encontrada.");
    if (post.status !== "scheduled" && post.status !== "failed") throw new Error("A publicação precisa estar aprovada.");
    const { publishPostToMeta } = await import("@/lib/social-media.server");
    await publishPostToMeta(post);
    return { ok: true };
  });