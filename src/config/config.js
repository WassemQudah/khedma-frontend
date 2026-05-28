// ─── API ────────────────────────────────────────────────────────────────────
export const BASE_URL = "https://khedma1-api-dsc0fbbxd9drhkhd.uaenorth-01.azurewebsites.net";

// SignalR hub — same origin as the API.
// If you are tunnelling locally (e.g. ngrok), update this to your tunnel URL.
export const HUB_URL = `${BASE_URL}/chathub`;

/** Idle time (ms) with no input before the client signs the user out — 15 minutes. */
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

// ─── Categories ─────────────────────────────────────────────────────────────
export const CATEGORIES = [
  { id: 1, name: "Plumbing", icon: "ri-water-flash-line", emoji: "🔧", desc: "Pipes, leaks & fixtures" },
  { id: 2, name: "Electrical", icon: "ri-flashlight-line", emoji: "⚡", desc: "Wiring, panels & lighting" },
  { id: 3, name: "Cleaning", icon: "ri-brush-2-line", emoji: "🧹", desc: "Home & office cleaning" },
  { id: 4, name: "Painting", icon: "ri-paint-brush-line", emoji: "🎨", desc: "Interior & exterior painting" },
  { id: 5, name: "Moving", icon: "ri-truck-line", emoji: "📦", desc: "Local & long-distance moving" },
  { id: 6, name: "AC Repair", icon: "ri-temp-cold-line", emoji: "❄️", desc: "Installation & maintenance" },
];

// ─── Cities ──────────────────────────────────────────────────────────────────
export const CITIES = [
  "Amman", "Zarqa", "Irbid", "Aqaba", "Madaba", "Ajloun", "Jerash", "Mafraq", "Balqa", "Karak", "Tafilah", "Ma'an"]
  ;












function normalizeCategoryIconClass(icon) {
  if (typeof icon !== "string") return icon ?? "";
  const clean = icon.trim();
  if (!clean) return "";
  if (
    clean.startsWith("fa-") &&
    !clean.includes("fa-solid") &&
    !clean.includes("fa-regular") &&
    !clean.includes("fa-brands")
  ) {
    return `fa-solid ${clean}`;
  }
  return clean;
}

// ─── Category resolver ───────────────────────────────────────────────────────
// The API now returns an array of category objects on GET responses.
// This helper normalises both the new shape ({ categories: [{id, name}] })
// and the legacy shape ({ categoryIds: [1, 2] }) so all UI code stays DRY.
export function resolveCategories(provider, localizedCategories = []) {
  // New shape: full category objects already in the response
  if (Array.isArray(provider?.categories) && provider.categories.length > 0) {
    return provider.categories.map((c) => {
      const resolvedId = c.id ?? c.categoryId;
      const local = CATEGORIES.find((cat) => cat.id === resolvedId);
      const translated = localizedCategories.find((cat) => cat.id === resolvedId);
      return {
        id: resolvedId,
        name: translated?.name ?? c.name ?? c.nameEn ?? c.localizedName ?? local?.name ?? "Unknown",
        emoji: c.emoji ?? local?.emoji ?? "",
        icon: normalizeCategoryIconClass(c.icon ?? local?.icon ?? ""),
      };
    }).filter((c) => c.name && c.name !== "Unknown" || c.id);
  }

  // Legacy shape: array of integer IDs — map through the local CATEGORIES list
  return (provider?.categoryIds ?? [])
    .map((id) => {
      const local = CATEGORIES.find((c) => c.id === id);
      if (!local) return null;
      const translated = localizedCategories.find((cat) => cat.id === id);
      return {
        id: local.id,
        name: translated?.name ?? local.name,
        emoji: local.emoji,
        icon: normalizeCategoryIconClass(local.icon ?? "")
      };
    })
    .filter(Boolean);
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────
export function decodeJWT(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Handle .NET long-form claim URIs
    const role =
      payload.role ||
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      null;
    return { ...payload, role };
  } catch {
    return null;
  }
}
