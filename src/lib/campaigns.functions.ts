import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  daysUntil,
  relativeTime,
  type Campaign,
  type CampaignDetail,
  type Category,
} from "./campaigns";

const BUCKET = "campaign-photos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

function publicClient(): SupabaseClient<Database> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function signPhotos(
  client: SupabaseClient<Database>,
  paths: (string | null)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("http")))];
  if (unique.length === 0) return {};
  const { data } = await client.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_TTL);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];

function resolvePhoto(path: string | null, photo: Record<string, string>): string {
  if (!path) return "";
  return path.startsWith("http") ? path : (photo[path] ?? "");
}

function toCampaign(
  row: CampaignRow,
  photo: Record<string, string>,
  latestUpdate: Campaign["latestUpdate"] = null,
): Campaign {
  return {
    id: row.id,
    title: row.title,
    organizer: row.organizer_name,
    organizerPhoto: resolvePhoto(row.organizer_photo, photo),
    story: row.story ?? "",
    category: (row.category ?? "other") as Category,
    goal: Number(row.goal_amount),
    raised: Number(row.current_amount),
    daysLeft: daysUntil(row.deadline),
    image: resolvePhoto(row.cover_photo, photo),
    creatorId: row.creator_id,
    latestUpdate,
  };
}

export const listActiveCampaigns = createServerFn({ method: "GET" }).handler(
  async (): Promise<Campaign[]> => {
    const client = publicClient();
    const { data, error } = await client
      .from("campaigns")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const photos = await signPhotos(client, rows.map((r) => r.cover_photo));
    return rows.map((r) => toCampaign(r, photos));
  },
);

export const getCampaignDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<CampaignDetail | null> => {
    const client = publicClient();
    const { data: row, error } = await client
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const [{ data: donations }, { data: updates }, photos] = await Promise.all([
      client
        .from("donations")
        .select("id, donor_name, amount, is_anonymous, created_at")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("campaign_updates")
        .select("id, content, created_at")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: false }),
      signPhotos(client, [row.cover_photo]),
    ]);

    return {
      ...toCampaign(row, photos),
      donorCount: donations?.length ?? 0,
      donors: (donations ?? []).map((d) => ({
        name: d.is_anonymous || !d.donor_name ? "Anonymous" : d.donor_name,
        amount: Number(d.amount),
        when: relativeTime(d.created_at),
      })),
      updates: (updates ?? []).map((u) => ({
        id: u.id,
        content: u.content,
        when: relativeTime(u.created_at),
      })),
    };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(4).max(120),
        story: z.string().trim().max(6000).optional().default(""),
        goalAmount: z.number().positive().max(1_000_000_000),
        category: z.enum(["medical", "education", "community", "other"]),
        coverPhoto: z.string().trim().min(1),
        organizerName: z.string().trim().max(80).optional().default(""),
        deadlineDays: z.number().int().min(1).max(365).optional().default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle();

    const organizer =
      data.organizerName ||
      profile?.name ||
      profile?.email?.split("@")[0] ||
      "Anonymous Organizer";

    const deadline = new Date(Date.now() + data.deadlineDays * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const { data: row, error } = await supabase
      .from("campaigns")
      .insert({
        creator_id: userId,
        organizer_name: organizer,
        title: data.title,
        story: data.story,
        goal_amount: data.goalAmount,
        category: data.category,
        cover_photo: data.coverPhoto,
        deadline,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const postCampaignUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ campaignId: z.string().uuid(), content: z.string().trim().min(2).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campaign_updates").insert({
      campaign_id: data.campaignId,
      creator_id: context.userId,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitDonation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        amount: z.number().positive().max(10_000_000),
        donorName: z.string().trim().max(60).optional().default(""),
        message: z.string().trim().max(500).optional().default(""),
        isAnonymous: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const client = publicClient();
    const reference =
      "DEMO-" + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString().slice(-4);
    const { error } = await client.rpc("record_donation", {
      _campaign_id: data.campaignId,
      _amount: data.amount,
      _donor_name: data.donorName || undefined,
      _message: data.message || undefined,
      _is_anonymous: data.isAnonymous || !data.donorName,
      _mpesa_transaction_id: reference,
    });
    if (error) throw new Error(error.message);
    return { ok: true, reference };
  });
