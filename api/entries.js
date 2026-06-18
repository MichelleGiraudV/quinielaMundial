import {
  cleanName,
  generateEditToken,
  getSupabaseServerClient,
  hashToken,
  isPlainObject,
  readJsonBody,
  sendJson,
  stripInternalPredictionMeta,
  withInternalMeta,
} from "./_lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Método no permitido." });
  }

  try {
    const body = await readJsonBody(req);
    const name = cleanName(body.name);
    const predictions = body.predictions;
    const incomingEditToken = typeof body.editToken === "string" ? body.editToken.trim() : "";

    if (!name) {
      return sendJson(res, 400, { error: "El nombre es obligatorio." });
    }

    if (!isPlainObject(predictions)) {
      return sendJson(res, 400, { error: "Las predicciones no tienen un formato válido." });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: lookupError } = await supabase
      .from("entries")
      .select("id, name, predictions, submitted_at")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return sendJson(res, 500, { error: lookupError.message });
    }

    const submittedAt = new Date().toISOString();

    if (existing) {
      const storedHash = existing.predictions?._meta?.editTokenHash;

      if (!storedHash) {
        return sendJson(res, 409, {
          error: "Ese nombre ya existe y no puede editarse desde este navegador. Usa otro nombre o bórralo desde el panel de admin.",
        });
      }

      if (!incomingEditToken || hashToken(incomingEditToken) !== storedHash) {
        return sendJson(res, 409, {
          error: "Ese nombre ya está ligado a otro navegador. Si quieres editarlo, usa el navegador original o cambia el nombre.",
        });
      }

      const { data: updated, error: updateError } = await supabase
        .from("entries")
        .update({
          name,
          predictions: withInternalMeta(predictions, storedHash),
          submitted_at: submittedAt,
        })
        .eq("id", existing.id)
        .select("id, name, predictions, submitted_at")
        .single();

      if (updateError) {
        return sendJson(res, 500, { error: updateError.message });
      }

      return sendJson(res, 200, {
        entry: {
          ...updated,
          predictions: stripInternalPredictionMeta(updated.predictions),
        },
        editToken: incomingEditToken,
      });
    }

    const editToken = incomingEditToken || generateEditToken();
    const { data: inserted, error: insertError } = await supabase
      .from("entries")
      .insert({
        name,
        predictions: withInternalMeta(predictions, hashToken(editToken)),
        submitted_at: submittedAt,
      })
      .select("id, name, predictions, submitted_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return sendJson(res, 409, {
          error: "Ese nombre ya está ocupado. Si es tu quiniela original, vuelve a usar el mismo navegador o cambia el nombre.",
        });
      }

      return sendJson(res, 500, { error: insertError.message });
    }

    return sendJson(res, 201, {
      entry: {
        ...inserted,
        predictions: stripInternalPredictionMeta(inserted.predictions),
      },
      editToken,
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo guardar la quiniela." });
  }
}
