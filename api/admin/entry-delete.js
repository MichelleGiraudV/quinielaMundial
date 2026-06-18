import {
  getSupabaseServerClient,
  readJsonBody,
  sendJson,
} from "../_lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Método no permitido." });
  }

  try {
    const body = await readJsonBody(req);
    const id = body.id;

    if (typeof id !== "string" && typeof id !== "number") {
      return sendJson(res, 400, { error: "Falta el identificador de la quiniela." });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("entries").delete().eq("id", id);

    if (error) {
      return sendJson(res, 500, { error: error.message });
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo borrar la quiniela." });
  }
}
