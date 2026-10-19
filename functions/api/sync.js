/**
 * Cloudflare Pages Function — /api/sync
 * Manages background storage for UNBOXD on Cloudflare's free tier without an external database.
 * Automatically uses either:
 *   1. Workers KV binding named `UNBOXD_STORE` (Free tier: 100k reads/day, 1k writes/day)
 *   2. OR R2 Bucket binding named `UNBOXD_BUCKET` (Free tier: 10 GB storage)
 */

const CATALOGUE_KEY = "unboxd_catalogue_v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key",
  "Content-Type": "application/json"
};

async function readStore(env) {
  if (env.UNBOXD_STORE) {
    const raw = await env.UNBOXD_STORE.get(CATALOGUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  if (env.UNBOXD_BUCKET) {
    const obj = await env.UNBOXD_BUCKET.get(CATALOGUE_KEY);
    if (!obj) return [];
    const text = await obj.text();
    return JSON.parse(text);
  }
  return null;
}

async function writeStore(env, products) {
  const payload = JSON.stringify(products);
  if (env.UNBOXD_STORE) {
    await env.UNBOXD_STORE.put(CATALOGUE_KEY, payload);
    return true;
  }
  if (env.UNBOXD_BUCKET) {
    await env.UNBOXD_BUCKET.put(CATALOGUE_KEY, payload, {
      httpMetadata: { contentType: "application/json" }
    });
    return true;
  }
  return false;
}

function checkAuth(request, env) {
  if (!env.SYNC_SECRET) return true;
  const provided = request.headers.get("X-Sync-Key") || "";
  return provided === env.SYNC_SECRET;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const products = await readStore(env);
  if (products === null) {
    return new Response(
      JSON.stringify({
        products: [],
        warning: "Bind a free KV namespace named UNBOXD_STORE or R2 bucket named UNBOXD_BUCKET in Cloudflare Pages Settings -> Functions."
      }),
      { status: 200, headers: corsHeaders }
    );
  }
  return new Response(JSON.stringify({ products }), { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const existing = await readStore(env);
  if (existing === null) {
    return new Response(
      JSON.stringify({
        error: "Storage binding not configured yet. Add KV namespace UNBOXD_STORE in Cloudflare Pages settings."
      }),
      { status: 503, headers: corsHeaders }
    );
  }

  const body = await request.json();
  const changes = Array.isArray(body.changes) ? body.changes : [];

  // Last-Write-Wins (LWW) Delta Merge by `id` and `updatedAt`
  const map = new Map();
  for (const item of existing) {
    if (item && item.id) map.set(item.id, item);
  }

  for (const incoming of changes) {
    if (!incoming || !incoming.id) continue;
    const current = map.get(incoming.id);
    if (!current || new Date(incoming.updatedAt || 0) >= new Date(current.updatedAt || 0)) {
      map.set(incoming.id, { ...incoming, syncStatus: "synced" });
    }
  }

  const merged = Array.from(map.values())
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  if (changes.length > 0) {
    await writeStore(env, merged);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      syncedAt: new Date().toISOString(),
      products: merged
    }),
    { status: 200, headers: corsHeaders }
  );
}
