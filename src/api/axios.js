import axios from "axios";
import { BASE_URL } from "../config/config";

const api = axios.create({
  baseURL: BASE_URL,
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Attach the JWT and the preferred language to every outbound request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Send preferred language so the API returns localised strings
  // (e.g. category names in the correct language)
  config.headers["Accept-Language"] = localStorage.getItem("preferredLanguage") ?? "en";
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
// Centralised error handling for common HTTP status codes so individual
// service functions don't need to duplicate this logic.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Token expired or invalid — clear local credentials.
      // AuthContext will detect the null token and redirect to /login.
      localStorage.removeItem("token");
      // Dispatch a custom event so AuthContext (or any listener) can react
      // without creating a circular import.
      window.dispatchEvent(new Event("auth:expired"));
    }

    // Re-throw so individual callers / parseApiError can still handle the error.
    return Promise.reject(error);
  }
);

export default api;
