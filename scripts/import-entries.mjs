import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

async function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");

  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function normalizeSupabaseUrl(value) {
  return (value ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function withInternalMeta(predictions, editTokenHash) {
  const previousMeta = isPlainObject(predictions?._meta) ? predictions._meta : {};

  return {
    ...predictions,
    _meta: {
      ...previousMeta,
      editTokenHash,
    },
  };
}

function getSupabaseServerClient() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    url,
    serviceRoleKey,
  };
}

async function supabaseRequest(client, pathname, { method = "GET", query, body, prefer } = {}) {
  const search = new URLSearchParams(query ?? {});
  const response = await fetch(`${client.url}${pathname}${search.size ? `?${search.toString()}` : ""}`, {
    method,
    headers: {
      apikey: client.serviceRoleKey,
      Authorization: `Bearer ${client.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Error ${response.status}`);
  }

  return payload;
}

function parseArgs(argv) {
  const args = { dryRun: false, file: null };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (value === "--file") {
      args.file = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

async function listImportFiles(importsDir, selectedFile) {
  if (selectedFile) {
    return [path.resolve(process.cwd(), selectedFile)];
  }

  const entries = await fs.readdir(importsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(importsDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function loadImportFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const name = cleanName(parsed.name);

  if (!name) {
    throw new Error(`Falta "name" en ${path.basename(filePath)}.`);
  }

  if (!isPlainObject(parsed.predictions)) {
    throw new Error(`Falta "predictions" válido en ${path.basename(filePath)}.`);
  }

  const submittedAt =
    typeof parsed.submitted_at === "string" && parsed.submitted_at.trim()
      ? parsed.submitted_at.trim()
      : new Date().toISOString();

  return {
    filePath,
    name,
    predictions: parsed.predictions,
    submitted_at: submittedAt,
  };
}

async function upsertImportedEntry(supabase, entry, dryRun) {
  const existingRows = await supabaseRequest(supabase, "/rest/v1/entries", {
    query: {
      select: "id,predictions,submitted_at",
      name: `ilike.${entry.name}`,
      limit: "1",
    },
  });
  const existing = existingRows?.[0] ?? null;

  const editTokenHash =
    existing?.predictions?._meta?.editTokenHash || hashToken(`import:${entry.name.toLowerCase()}`);
  const payload = {
    name: entry.name,
    predictions: withInternalMeta(entry.predictions, editTokenHash),
    submitted_at: entry.submitted_at || existing?.submitted_at || new Date().toISOString(),
  };

  if (dryRun) {
    return {
      action: existing ? "update" : "insert",
      id: existing?.id ?? null,
    };
  }

  if (existing) {
    await supabaseRequest(supabase, "/rest/v1/entries", {
      method: "PATCH",
      query: { id: `eq.${existing.id}` },
      body: payload,
    });

    return { action: "update", id: existing.id };
  }

  const insertedRows = await supabaseRequest(supabase, "/rest/v1/entries", {
    method: "POST",
    prefer: "return=representation",
    query: { select: "id" },
    body: payload,
  });
  const inserted = insertedRows?.[0];

  return { action: "insert", id: inserted.id };
}

async function main() {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const importsDir = path.resolve(process.cwd(), "imports");
  const files = await listImportFiles(importsDir, args.file);

  if (files.length === 0) {
    console.log("No hay archivos JSON en imports/.");
    return;
  }

  const supabase = getSupabaseServerClient();

  for (const filePath of files) {
    const entry = await loadImportFile(filePath);
    const result = await upsertImportedEntry(supabase, entry, args.dryRun);
    console.log(
      `${args.dryRun ? "[dry-run]" : "[ok]"} ${result.action.toUpperCase()} ${entry.name} <- ${path.basename(filePath)}`
    );
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
