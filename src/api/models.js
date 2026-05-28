// ─── Data-shape definitions (JSDoc) ─────────────────────────────────────────
// These act as the single source of truth for every API response shape used
// across the application.  Import the typedefs where needed with:
//   /** @type {import("../api/models").Provider} */

/**
 * Full category object returned by the API.
 * Providers now return these objects instead of bare integer IDs.
 *
 * @typedef {Object} CategoryObject
 * @property {number}  id
 * @property {string}  [name]           - Display label when set by UI (from `nameEn` / `nameAr` via i18n)
 * @property {string}  [nameEn]
 * @property {string}  [nameAr]
 * @property {string}  [localizedName]  - May mirror server-selected locale
 * @property {string}  [descriptionEn]
 * @property {string}  [descriptionAr]
 * @property {string}  [localizedDescription]
 * @property {string}  [icon]           - Remix Icon or Font Awesome class
 * @property {string}  [emoji]         - UI emoji, e.g. "🔧"
 * @property {string}  [desc]          - Legacy short description field
 */

/**
 * Provider as returned by GET /api/Provider/search and GET /api/Provider/{id}.
 * `categories` is now an array of full CategoryObjects, not integer IDs.
 *
 * @typedef {Object} Provider
 * @property {number}           providerId
 * @property {string}           fullName
 * @property {string}           [businessName]
 * @property {string}           workCity
 * @property {number}           basePrice
 * @property {string}           [bio]
 * @property {string}           [profileImageUrl]
 * @property {number}           [ratingAverage]
 * @property {number}           [reviewCount]
 * @property {string}           [phoneNumber]
 * @property {CategoryObject[]} categories   - Full objects; legacy `categoryIds` may also be present
 * @property {number[]}         [categoryIds] - Legacy shape; prefer `categories`
 */

/**
 * Pagination metadata returned alongside paged results.
 *
 * @typedef {Object} PaginationMeta
 * @property {number}  page
 * @property {number}  limit
 * @property {number}  totalCount
 * @property {number}  totalPages
 * @property {boolean} hasNextPage
 * @property {boolean} hasPreviousPage
 */

/**
 * Paged provider search result.
 *
 * @typedef {Object} PagedProviders
 * @property {Provider[]}        data
 * @property {PaginationMeta|null} pagination  - null when the API returns a flat array
 */

/**
 * Parameters accepted by GET /api/Provider/search.
 *
 * @typedef {Object} ProviderSearchParams
 * @property {number}  [page=1]
 * @property {number}  [limit=10]
 * @property {number}  [categoryId]
 * @property {string}  [search]
 */

/**
 * @typedef {Object} Booking
 * @property {number}  bookingId
 * @property {number}  customerId
 * @property {string}  customerName
 * @property {string}  [customerPhone]
 * @property {number}  providerId
 * @property {string}  providerName
 * @property {string}  [providerPhone]
 * @property {string}  [providerProfileImageUrl] - Full provider photo URL when API includes it on booking
 * @property {string}  status           - "Pending" | "Accepted" | "Completed" | "Cancelled" | "Rejected"
 * @property {string}  serviceDate      - ISO 8601 string
 * @property {string}  serviceAddress
 * @property {string}  description
 * @property {number}  [basePrice]
 * @property {boolean} [isPaid]
 */

/**
 * @typedef {Object} BookingUpdatePayload
 * @property {string} serviceDate     - ISO 8601 string
 * @property {string} serviceAddress
 * @property {string} description
 */

/**
 * @typedef {Object} ReviewStatus
 * @property {boolean} isRatedByCustomer
 * @property {boolean} isRatedByProvider
 */

/**
 * @typedef {Object} Review
 * @property {number}  [reviewId]
 * @property {number}  bookingId
 * @property {number}  rating           - 1–5
 * @property {string}  [comment]
 * @property {string}  [customerName]
 * @property {string}  [reviewerName]
 * @property {string}  [createdAt]      - ISO 8601 string
 */

/**
 * @typedef {Object} UploadResult
 * @property {string} imageUrl
 */

/**
 * Logged-in user as returned by `GET /api/Auth/me` (and echoed by profile PUT endpoints).
 *
 * **Backend contract (recommended):** After `PUT /api/Customer/profile` or `PUT /api/Provider/profile`
 * updates an avatar, the next `GET /api/Auth/me` response **must include** `profileImageUrl`
 * (camelCase; absolute `https://...` or app-relative `/uploads/...` URLs are fine). The SPA
 * already maps `ProfileImageUrl` → `profileImageUrl` via `normalizeImageFields`; `mergeSessionWithFreshProfile`
 * merges PUT responses onto the session so `/me` omission does not wipe the avatar until reload.
 *
 * @typedef {Object} AuthUser
 * @property {number}  id
 * @property {string}  fullName
 * @property {string}  email
 * @property {string}  [phoneNumber]
 * @property {string}  role             - "Customer" | "Provider" | "Admin"
 * @property {boolean} hasProfile
 * @property {string}  [businessName]
 * @property {string}  [workCity]
 * @property {number}  [basePrice]
 * @property {string}  [bio]
 * @property {string}  [profileImageUrl]
 * @property {number}  [providerId]
 * @property {number}  [ratingAverage]
 * @property {string}  [preferredLanguage]
 */

// ─── Cancellation validator ──────────────────────────────────────────────────

/**
 * Statuses that can never be cancelled.
 * @type {string[]}
 */
const NON_CANCELLABLE_STATUSES = ["completed", "rejected", "cancelled"];

/**
 * Hours of notice required before a booking can be cancelled.
 * @type {number}
 */
export const CANCELLATION_NOTICE_HOURS = 24;

/**
 * Validates whether a booking is eligible for cancellation **before** hitting
 * the network.  Mirrors the server-side rules so the UI can give instant,
 * accurate feedback without waiting for a 403/400 response.
 *
 * Rules:
 *  1. Status must not be Completed, Rejected, or already Cancelled.
 *  2. The service date must be more than CANCELLATION_NOTICE_HOURS away.
 *
 * @param {string} status       - Current booking status
 * @param {string} serviceDate  - ISO 8601 service date string
 * @returns {{ valid: boolean, error: string | null }}
 *
 * @example
 * const { valid, error } = validateCancellation(booking.status, booking.serviceDate);
 * if (!valid) { showError(error); return; }
 */
export function validateCancellation(status, serviceDate) {
  if (NON_CANCELLABLE_STATUSES.includes((status ?? "").toLowerCase())) {
    return {
      valid: false,
      error: `This booking cannot be cancelled because it is already ${status.toLowerCase()}.`,
    };
  }

  const hoursUntilService = (new Date(serviceDate) - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilService < CANCELLATION_NOTICE_HOURS) {
    return {
      valid: false,
      error: `Cancellation is not allowed within ${CANCELLATION_NOTICE_HOURS} hours of the service date.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Normalises a raw provider category field into a consistent array of
 * CategoryObjects regardless of which API shape was returned.
 *
 * Handles:
 *  - New shape: `categories: [{ id, name, … }]`
 *  - Legacy shape: `categoryIds: [1, 2]` (enriches with local metadata if available)
 *
 * @param {Provider}        provider
 * @param {CategoryObject[]} [localCats=[]]  - Local fallback list for enrichment
 * @returns {CategoryObject[]}
 */
export function normaliseProviderCategories(provider, localCats = []) {
  if (Array.isArray(provider?.categories) && provider.categories.length > 0) {
    return provider.categories.map((c) => {
      const local = localCats.find((l) => l.id === (c.id ?? c.categoryId));
      return {
        id:    c.id    ?? c.categoryId,
        name:  c.name  ?? c.nameEn ?? c.localizedName ?? local?.name ?? "Unknown",
        nameEn: c.nameEn ?? c.name ?? local?.name,
        icon:  c.icon  ?? local?.icon  ?? "ri-tools-line",
        emoji: c.emoji ?? local?.emoji ?? "",
        desc:  c.desc  ?? local?.desc  ?? "",
      };
    });
  }

  // Legacy: integer ID array
  return (provider?.categoryIds ?? [])
    .map((id) => localCats.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => ({ id: c.id, name: c.name, nameEn: c.name, icon: c.icon, emoji: c.emoji, desc: c.desc }));
}
