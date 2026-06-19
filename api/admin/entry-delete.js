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
    const password = typeof body.password === "string" ? body.password : "";
    const adminPassword = (process.env.ADMIN_DELETE_PASSWORD ?? "").trim();

    if (typeof id !== "string" && typeof id !== "number") {
      return sendJson(res, 400, { error: "Falta el identificador de la quiniela." });
    }

    if (!adminPassword) {
      return sendJson(res, 500, { error: "Falta configurar ADMIN_DELETE_PASSWORD en Vercel." });
    }

    if (!password || password !== adminPassword) {
      return sendJson(res, 401, { error: "Contraseña incorrecta." });
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
