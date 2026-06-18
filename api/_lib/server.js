import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(value) {
  return (value ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export function getSupabaseServerClient() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

export function cleanName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateEditToken() {
  return randomUUID();
}

export function withInternalMeta(predictions, editTokenHash) {
  const previousMeta = isPlainObject(predictions?._meta) ? predictions._meta : {};

  return {
    ...predictions,
    _meta: {
      ...previousMeta,
      editTokenHash,
    },
  };
}

export function stripInternalPredictionMeta(predictions) {
  if (!isPlainObject(predictions)) {
    return predictions;
  }

  const rest = { ...predictions };
  delete rest._meta;
  return rest;
}
