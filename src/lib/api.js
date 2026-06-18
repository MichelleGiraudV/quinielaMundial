async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? safeParseJson(text) : {};

  if (!response.ok) {
    if (response.status === 404 && window.location.port === "5173") {
      throw new Error("Error 404: estas en Vite (`npm run dev`). Para probar envios usa `npx vercel dev`.");
    }

    throw new Error(payload.error || `Error ${response.status}`);
  }

  return payload;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export function submitEntry(payload) {
  return requestJson("/api/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveResultsRemote(results) {
  return requestJson("/api/admin/results", {
    method: "PUT",
    body: JSON.stringify({ results }),
  });
}

export function deleteEntryRemote(id) {
  return requestJson("/api/admin/entry-delete", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}
