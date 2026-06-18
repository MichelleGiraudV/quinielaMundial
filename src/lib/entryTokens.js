const STORAGE_KEY = "wc26-edit-tokens";

function normalizeName(name) {
  return (name ?? "").trim().toLowerCase();
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors.
  }
}

export function getEntryEditToken(name) {
  return readStore()[normalizeName(name)] || "";
}

export function saveEntryEditToken(name, token) {
  if (!name || !token) {
    return;
  }

  const store = readStore();
  store[normalizeName(name)] = token;
  writeStore(store);
}
