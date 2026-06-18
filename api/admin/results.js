import {
  getSupabaseServerClient,
  isPlainObject,
  readJsonBody,
  sendJson,
} from "../_lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return sendJson(res, 405, { error: "Método no permitido." });
  }

  try {
    const body = await readJsonBody(req);

    if (!isPlainObject(body.results)) {
      return sendJson(res, 400, { error: "Los resultados no tienen un formato válido." });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: lookupError } = await supabase.from("results").select("id").limit(1);

    if (lookupError) {
      return sendJson(res, 500, { error: lookupError.message });
    }

    const query = existing && existing.length > 0
      ? supabase
          .from("results")
          .update({
            data: body.results,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id)
      : supabase.from("results").insert({ id: 1, data: body.results });

    const { error } = await query;

    if (error) {
      return sendJson(res, 500, { error: error.message });
    }

    return sendJson(res, 200, { ok: true, results: body.results });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudieron guardar los resultados." });
  }
}
