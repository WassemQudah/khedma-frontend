/**
 * services.js — Central API service layer
 *
 * All network calls go through the named functions below.  Components and
 * hooks import individual functions rather than using `api` directly, which
 * keeps HTTP details out of UI code and makes endpoints easy to mock in tests.
 *
 * Groupings:
 *   auth        – authentication & current-user profile
 *   providers   – provider search and profile management
 *   categories  – category listings
 *   bookings    – booking lifecycle (request / status / pay / cancel / update)
 *   uploads     – binary media via multipart/form-data
 *   reviews     – submitting and reading reviews
 */

import api from "./axios";
import { validateCancellation } from "./models";
import { BASE_URL } from "../config/config";
import parseApiError from "../utils/parseApiError";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strips undefined/null entries so we never send empty query params.
 * @param {Record<string, any>} obj
 * @returns {Record<string, any>}
 */
function compactParams(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
}

/**
 * Convert relative image paths from API into absolute URLs.
 * @param {unknown} raw
 * @returns {string}
 */
function toAbsoluteImageUrl(raw) {
  if (!raw) return "";
  const value = String(raw).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${BASE_URL}${value}`;
  return `${BASE_URL}/${value}`;
}

/**
 * Normalize common avatar/image field aliases returned by the backend.
 * @template {Record<string, any>} T
 * @param {T | null | undefined} entity
 * @returns {T | null | undefined}
 */
function normalizeImageFields(entity) {
  if (!entity || typeof entity !== "object") return entity;
  const normalized = { ...entity };

  const primary = toAbsoluteImageUrl(
    entity.profileImageUrl
    ?? entity.ProfileImageUrl
    ?? entity.imageUrl
    ?? entity.ImageUrl
    ?? entity.avatarUrl
    ?? entity.AvatarUrl
  );

  if (primary) normalized.profileImageUrl = primary;
  if (entity.imageUrl) normalized.imageUrl = toAbsoluteImageUrl(entity.imageUrl);
  if (entity.ImageUrl) normalized.ImageUrl = toAbsoluteImageUrl(entity.ImageUrl);
  if (entity.avatarUrl) normalized.avatarUrl = toAbsoluteImageUrl(entity.avatarUrl);
  if (entity.AvatarUrl) normalized.AvatarUrl = toAbsoluteImageUrl(entity.AvatarUrl);

  return normalized;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the current authenticated user's full profile.
 *
 * **Backend:** Response should mirror the latest persisted profile fields, especially
 * **`profileImageUrl`** after avatar updates (`AuthUser` contract in models.js).
 *
 * @returns {Promise<import("./models").AuthUser>}
 */
export async function getMe() {
  const { data } = await api.get("/api/Auth/me");
  return normalizeImageFields(data);
}

/**
 * Normalizes the current auth user (optionally skipping `GET /api/Auth/me` when cached).
 * Does not call `GET /api/Provider/{id}`.
 *
 * @param {import("./models").AuthUser | Record<string, any> | null | undefined} [cachedSessionUser]
 * @returns {Promise<import("./models").AuthUser>}
 */
export async function getMeMergedWithRoleProfile(cachedSessionUser) {
  const useCache =
    cachedSessionUser != null
    && typeof cachedSessionUser === "object"
    && Object.keys(cachedSessionUser).length > 0;

  // Get the base auth user (from cache or API)
  const base = useCache
    ? normalizeImageFields({ ...cachedSessionUser })
    : await getMe();

  // For providers, also fetch their role-specific profile (which contains
  // businessName, workCity, basePrice, specificLocation, etc.) since
  // GET /api/Auth/me does not return those fields.
  const providerId =
    base?.providerId ?? base?.id ?? base?.userId ?? base?.nameid;

  if ((base?.role === "Provider" || base?.Role === "Provider") && providerId) {
    try {
      const providerData = await getProvider(providerId);
      return normalizeImageFields({ ...base, ...providerData });
    } catch {
      // Non-fatal: if the provider endpoint fails, return auth/me data as-is
      return base;
    }
  }

  return base;
}

/**
 * Update a customer's personal details.
 * @param {{ fullName: string, phoneNumber?: string }} payload
 * @returns {Promise<import("./models").AuthUser>}
 */
export async function updateCustomerProfile(payload) {
  const { data } = await api.put("/api/Customer/profile", payload);
  return normalizeImageFields(data);
}

/**
 * Update a provider's service profile (PUT only — no GET on this path).
 * @param {{ businessName?: string, workCity: string, basePrice: number, bio?: string, profileImageUrl?: string, specificLocation?: string }} payload
 * @returns {Promise<import("./models").AuthUser>}
 */
export async function updateProviderProfile(payload) {
  const { data } = await api.put("/api/Provider/profile", payload);
  return normalizeImageFields(data);
}

// ─── Providers ────────────────────────────────────────────────────────────────

/**
 * Search providers with full pagination support.
 *
 * GET /api/Provider/search?page=1&limit=10&categoryId=1&search=Name
 *
 * @param {import("./models").ProviderSearchParams} [params]
 * @returns {Promise<import("./models").PagedProviders>}
 */
export async function searchProviders({ page = 1, limit = 20, categoryId, search } = {}) {
  const { data } = await api.get("/api/Provider/search", {
    params: compactParams({ page, limit, categoryId, search }),
  });

  // Normalise response: the API may return a paged envelope or a flat array
  if (Array.isArray(data)) {
    return { data: data.map((row) => normalizeImageFields(row)), pagination: null };
  }

  return {
    data: (data.data ?? data.providers ?? data.items ?? []).map((row) => normalizeImageFields(row)),
    pagination: data.pagination ?? data.meta ?? null,
  };
}

/**
 * Fetch a single provider by ID.
 * The returned object includes full CategoryObjects in `categories`.
 *
 * @param {number|string} id
 * @returns {Promise<import("./models").Provider>}
 */
export async function getProvider(id) {
  const { data } = await api.get(`/api/Provider/${id}`);
  return normalizeImageFields(data);
}

/**
 * Initial setup of a provider profile (first-time only).
 * @param {Object} payload
 * @returns {Promise<import("./models").AuthUser>}
 */
export async function setupProviderProfile(payload) {
  const { data } = await api.post("/api/Provider/setup-profile", payload);
  return normalizeImageFields(data);
}

/**
 * Initial setup of a customer profile (first-time only).
 * @param {{ preferredLanguage: string }} payload
 * @returns {Promise<import("./models").AuthUser | undefined>}
 */
export async function setupCustomerProfile(payload) {
  const { data } = await api.post("/api/Customer/setup-profile", payload);
  return normalizeImageFields(data);
}

/**
 * Upload portfolio images for the current provider.
 * @param {string[]} imageUrls - Array of already-uploaded image URLs
 * @returns {Promise<any>}
 */
export async function addPortfolioImages(imageUrls) {
  const { data } = await api.post("/api/Provider/portfolio", { imageUrls });
  return data;
}

/**
 * Delete a single portfolio image by its server-side ID.
 * @param {number|string} imageId
 * @returns {Promise<void>}
 */
export async function deletePortfolioImage(imageId) {
  await api.delete(`/api/Provider/portfolio/${imageId}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * Fetch all categories.  Returns full objects including localized names and
 * icon metadata as set in the API (see CategoryObject typedef in models.js).
 *
 * GET /api/Category
 *
 * @returns {Promise<import("./models").CategoryObject[]>}
 */
export async function getCategories() {
  const { data } = await api.get("/api/Category", {
    params: { page: 1, limit: 100 },
  });
  const rows = Array.isArray(data)
    ? data
    : (data.data ?? data.items ?? data.$values ?? []);

  const normalizeIconClass = (icon) => {
    if (typeof icon !== "string") return icon;
    const clean = icon.replace(/[\r\n\t]+/g, "").trim();
    if (!clean) return "";
    // Font Awesome glyph classes need a style prefix (e.g. "fa-solid").
    const firstToken = clean.split(/\s+/)[0];
    if (firstToken.startsWith("fa-") && !clean.includes("fa-solid") && !clean.includes("fa-regular") && !clean.includes("fa-brands")) {
      return `fa-solid ${firstToken}`;
    }
    return clean;
  };

  return Array.isArray(rows)
    ? rows.map((cat) => ({
      ...cat,
      id: cat.id ?? cat.categoryId ?? null,
      categoryId: cat.categoryId ?? cat.id ?? null,
      icon: normalizeIconClass(cat.icon),
    }))
    : [];
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

/**
 * Request a new booking.
 * @param {{ providerId: number, serviceDate: string, serviceAddress: string, description: string }} payload
 * @returns {Promise<import("./models").Booking>}
 */
export async function requestBooking(payload) {
  const { data } = await api.post("/api/Booking/request", payload);
  return data;
}

/**
 * Get all bookings for the current customer.
 * @returns {Promise<import("./models").Booking[]>}
 */
export async function getCustomerBookings() {
  const { data } = await api.get("/api/Booking/customer/history");
  if (Array.isArray(data)) return data;
  const rows =
    data.data ?? data.items ?? data.bookings ?? data.$values ?? data.value ?? [];
  return Array.isArray(rows) ? rows : [];
}

/**
 * Get all bookings/requests for the current provider.
 * @returns {Promise<import("./models").Booking[]>}
 */
export async function getProviderBookings() {
  const { data } = await api.get("/api/Booking/provider/requests");
  return Array.isArray(data) ? data : (data.data ?? []);
}

/**
 * Get messages for a booking chat thread.
 * @param {number|string} bookingId
 * @returns {Promise<any[]>}
 */
export async function getChatMessages(bookingId) {
  const { data } = await api.get(`/api/Chat/${bookingId}`);
  return Array.isArray(data) ? data : (data.messages ?? data.data ?? []);
}

/**
 * Update the mutable details of a Pending booking.
 * @param {number} bookingId
 * @param {import("./models").BookingUpdatePayload} updates
 * @returns {Promise<import("./models").Booking>}
 */
export async function updateBookingDetails(bookingId, updates) {
  const { data } = await api.put(`/api/Booking/${bookingId}/update`, updates);
  return data;
}

/**
 * Change a booking's status (provider-side: Accepted / Rejected / Completed).
 * For customer-initiated cancellations use `cancelBooking` instead.
 *
 * @param {number} bookingId
 * @param {string} status
 * @returns {Promise<import("./models").Booking>}
 */
export async function updateBookingStatus(bookingId, status) {
  const { data } = await api.put(`/api/Booking/${bookingId}/status`, { status });
  return data;
}

/**
 * Accept a pending booking request.
 * @param {number} bookingId
 * @returns {Promise<import("./models").Booking>}
 */
export async function acceptBooking(bookingId) {
  return updateBookingStatus(bookingId, "Accepted");
}

/**
 * Reject a pending booking request.
 * @param {number} bookingId
 * @returns {Promise<import("./models").Booking>}
 */
export async function rejectBooking(bookingId) {
  return updateBookingStatus(bookingId, "Rejected");
}

/**
 * Mark an accepted booking as completed.
 * @param {number} bookingId
 * @returns {Promise<import("./models").Booking>}
 */
export async function completeBooking(bookingId) {
  return updateBookingStatus(bookingId, "Completed");
}

/**
 * Cancel a booking on behalf of the customer.
 *
 * Performs client-side validation **before** the network call:
 *  - Throws immediately if the booking is already completed/rejected/cancelled.
 *  - Throws immediately if the service date is within 24 hours.
 *
 * The thrown error has `err.isValidationError = true` so callers can
 * distinguish pre-flight rejections from network failures.
 *
 * @param {number} bookingId
 * @param {string} currentStatus  - e.g. "Pending"
 * @param {string} serviceDate    - ISO 8601 string
 * @returns {Promise<import("./models").Booking>}
 * @throws {Error & { isValidationError?: boolean }}
 */
export async function cancelBooking(bookingId, currentStatus, serviceDate) {
  const { valid, error } = validateCancellation(currentStatus, serviceDate);
  if (!valid) {
    const err = new Error(error);
    err.isValidationError = true;
    throw err;
  }
  const { data } = await api.put(`/api/booking/${bookingId}/cancel`);
  return data;
}

/**
 * Submit payment for an accepted booking.
 * @param {number} bookingId
 * @param {"Cash"|"Card"} paymentMethod
 * @returns {Promise<void>}
 */
export async function payBooking(bookingId, paymentMethod) {
  const { data } = await api.put(`/api/Booking/${bookingId}/pay`, { paymentMethod });
  return data;
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

/**
 * Upload an image to the backend via multipart/form-data.
 *
 * POST /api/Upload/image
 *
 * Use this instead of uploading directly to Firebase Storage when the backend
 * needs to control where files are stored and validate them server-side.
 *
 * @param {File}     file          - Image file selected by the user
 * @param {string}   [fieldName="file"]  - multipart field name expected by the server (must be "file")
 * @param {(pct: number) => void} [onUploadProgress]  - optional 0–100 upload progress
 * @returns {Promise<import("./models").UploadResult>}   - { imageUrl }
 */
export async function uploadImage(file, fieldName = "file", onUploadProgress = null) {
  const formData = new FormData();
  formData.append(fieldName, file);

  const { data } = await api.post("/api/Upload/image", formData, {
    // Do NOT set Content-Type manually — axios must auto-generate it with the
    // multipart boundary, e.g. "multipart/form-data; boundary=----xyz".
    // Overriding it removes the boundary and causes a 400 Bad Request.
    onUploadProgress: onUploadProgress
      ? (ev) => {
        if (ev.total) onUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      }
      : undefined,
  });

  if (!data?.imageUrl) {
    throw new Error("Upload succeeded but no imageUrl was returned by the server.");
  }

  return data; // { imageUrl: string }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

/**
 * Submit a customer's review of a provider.
 * @param {number} bookingId
 * @param {number} rating   - 1–5
 * @param {string} [comment]
 * @returns {Promise<void>}
 */
export async function reviewProvider(bookingId, rating, comment) {
  const { data } = await api.post("/api/Review", { bookingId, rating, comment });
  return data;
}

/**
 * Fetch all users for admin panel.
 * @returns {Promise<any[]>}
 */
export async function getAdminUsers() {
  const { data } = await api.get("/api/Admin/users");
  return Array.isArray(data) ? data : (data?.data ?? []);
}

/**
 * Fetch admin dashboard stats.
 * @returns {Promise<any>}
 */
export async function getAdminStats() {
  const { data } = await api.get("/api/Admin/stats");
  return data;
}

/**
 * Toggle user active/banned status from admin panel.
 * @param {number|string} userId
 * @returns {Promise<any>}
 */
export async function toggleAdminUserStatus(userId) {
  const { data } = await api.put(`/api/Admin/users/${userId}/toggle-status`);
  return data;
}

/**
 * Delete a user from admin panel.
 * @param {number|string} userId
 * @returns {Promise<any>}
 */
export async function deleteAdminUser(userId) {
  const { data } = await api.delete(`/api/Admin/user/${userId}`);
  return data;
}

/**
 * Upload categories CSV for admin seeding.
 * @param {File} file
 * @returns {Promise<any>}
 */
export async function seedCategoriesCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/api/Admin/seed-categories-csv", formData);
  return data;
}

/**
 * Submit a provider's review of a customer.
 * @param {number} bookingId
 * @param {number} rating   - 1–5
 * @param {string} [comment]
 * @returns {Promise<void>}
 */
export async function reviewCustomer(bookingId, rating, comment) {
  const { data } = await api.post("/api/Review/rate-customer", { bookingId, rating, comment });
  return data;
}

/**
 * Normalise review list payloads (.NET / various envelopes).
 * @param {unknown} payload
 * @returns {import("./models").Review[]}
 */
function unwrapReviewList(payload) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.Data)) return payload.Data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.Items)) return payload.Items;
  if (Array.isArray(payload.reviews)) return payload.reviews;
  if (Array.isArray(payload.Reviews)) return payload.Reviews;
  if (Array.isArray(payload.$values)) return payload.$values;
  if (Array.isArray(payload.value)) return payload.value;
  if (Array.isArray(payload.Value)) return payload.Value;
  return [];
}

/**
 * Fetch all reviews written **about** a customer (by providers).
 *
 * Uses `GET /api/review/customer/{customerId}` first, then `/api/Review/customer/{id}` on 404.
 *
 * @param {number|string} customerId
 * @returns {Promise<import("./models").Review[]>}
 */
export async function getCustomerReviews(customerId) {
  const id = encodeURIComponent(String(customerId));
  const paths = [`/api/review/customer/${id}`, `/api/Review/customer/${id}`];
  for (let i = 0; i < paths.length; i++) {
    try {
      const { data } = await api.get(paths[i]);
      return unwrapReviewList(data);
    } catch (e) {
      const status = e.response?.status;
      if (status === 404 && i < paths.length - 1) continue;
      if (status === 404) return [];
      throw e;
    }
  }
  return [];
}

/**
 * Get the review status for a specific booking.
 *
 * GET /api/review/status/{bookingId}
 *
 * @param {number|string} bookingId
 * @returns {Promise<import("./models").ReviewStatus>}
 */
export async function getReviewStatus(bookingId) {
  const { data } = await api.get(`/api/review/status/${bookingId}`);
  return data; // { isRatedByCustomer, isRatedByProvider }
}

/**
 * Fetch review statuses for multiple bookings in parallel.
 * Failed individual requests are silently ignored (non-fatal).
 *
 * @param {number[]} bookingIds
 * @returns {Promise<Record<number, import("./models").ReviewStatus>>}
 */
export async function getReviewStatuses(bookingIds) {
  const results = await Promise.allSettled(
    bookingIds.map((id) => getReviewStatus(id))
  );
  const map = {};
  bookingIds.forEach((id, i) => {
    if (results[i].status === "fulfilled") {
      map[id] = results[i].value;
    }
  });
  return map;
}

/**
 * Fetch reviews for multiple customers in parallel.
 * Failed individual requests are silently ignored (non-fatal).
 *
 * @param {number[]} customerIds
 * @returns {Promise<Record<number, import("./models").Review[]>>}
 */
export async function getCustomerReviewsBatch(customerIds) {
  const unique = [...new Set(customerIds.filter(Boolean).map((id) => String(id)))];
  const results = await Promise.allSettled(
    unique.map((id) => getCustomerReviews(id))
  );
  const map = {};
  unique.forEach((id, i) => {
    if (results[i].status === "fulfilled") {
      map[id] = results[i].value;
    }
  });
  return map;
}

/**
 * Get reviews written about providers (for a specific provider's public profile).
 * @param {number|string} providerId
 * @returns {Promise<import("./models").Review[]>}
 */
export async function getProviderReviews(providerId) {
  const { data } = await api.get(`/api/Review/provider/${providerId}`);
  return Array.isArray(data) ? data : (data.data ?? []);
}

export { parseApiError };
