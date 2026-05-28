/**
 * API service layer — unit & integration-style tests (HTTP fully mocked).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("./axios.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import api from "./axios.js";
import {
  searchProviders,
  cancelBooking,
  uploadImage,
  getCustomerReviews,
  getReviewStatus,
  getReviewStatuses,
} from "./services.js";
import {
  validateCancellation,
  normaliseProviderCategories,
  CANCELLATION_NOTICE_HOURS,
} from "./models.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fixed "now" for deterministic cancellation tests */
const FIXED_NOW = new Date("2026-04-20T12:00:00.000Z");

function hoursFromNowIso(hours) {
  return new Date(FIXED_NOW.getTime() + hours * 60 * 60 * 1000).toISOString();
}

// ─── Search & pagination ───────────────────────────────────────────────────

describe("searchProviders (GET /api/Provider/search)", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
  });

  it("sends all query params: page, limit, categoryId, search", async () => {
    await searchProviders({
      page: 1,
      limit: 10,
      categoryId: 1,
      search: "Name",
    });

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/api/Provider/search", {
      params: { page: 1, limit: 10, categoryId: 1, search: "Name" },
    });
  });

  it("omits undefined / empty optional params via compactParams", async () => {
    await searchProviders({ page: 2, limit: 20 });

    expect(api.get).toHaveBeenCalledWith("/api/Provider/search", {
      params: { page: 2, limit: 20 },
    });
  });

  it("parses paged envelope with pagination metadata block", async () => {
    const pagination = {
      page: 1,
      limit: 10,
      totalCount: 42,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    };
    const providers = [{ providerId: 7, fullName: "Test", workCity: "Amman", basePrice: 10 }];

    vi.mocked(api.get).mockResolvedValue({
      data: { data: providers, pagination },
    });

    const result = await searchProviders({ page: 1, limit: 10 });

    expect(result.data).toEqual(providers);
    expect(result.pagination).toEqual(pagination);
  });

  it("falls back to data.providers and meta when API uses alternate keys", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        providers: [{ providerId: 1 }],
        meta: { page: 1, totalPages: 1 },
      },
    });

    const result = await searchProviders();

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 1, totalPages: 1 });
  });

  it("returns flat array as data with pagination null", async () => {
    const flat = [{ providerId: 2 }];
    vi.mocked(api.get).mockResolvedValue({ data: flat });

    const result = await searchProviders();

    expect(result.data).toEqual(flat);
    expect(result.pagination).toBeNull();
  });
});

// ─── Category mapping (full objects vs IDs) ─────────────────────────────────

describe("normaliseProviderCategories (provider + category objects)", () => {
  const localFallback = [
    { id: 1, name: "Plumbing", icon: "ri-water-flash-line", emoji: "🔧", desc: "Pipes" },
  ];

  it("maps full API category objects with localized names and icons", () => {
    const provider = {
      categories: [
        {
          id: 1,
          name: "السباكة",
          nameEn: "Plumbing",
          icon: "ri-water-flash-line",
          emoji: "🔧",
        },
      ],
    };

    const out = normaliseProviderCategories(provider, localFallback);

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 1,
      name: "السباكة",
      nameEn: "Plumbing",
      icon: "ri-water-flash-line",
      emoji: "🔧",
    });
  });

  it("enriches partial API objects from local fallback when icon/emoji missing", () => {
    const provider = {
      categories: [{ id: 1, localizedName: "Plumbing" }],
    };

    const out = normaliseProviderCategories(provider, localFallback);

    expect(out[0].icon).toBe("ri-water-flash-line");
    expect(out[0].emoji).toBe("🔧");
    expect(out[0].name).toBe("Plumbing");
  });

  it("maps legacy categoryIds through local catalog", () => {
    const provider = { categoryIds: [1] };

    const out = normaliseProviderCategories(provider, localFallback);

    expect(out[0]).toMatchObject({
      id: 1,
      name: "Plumbing",
      icon: "ri-water-flash-line",
      emoji: "🔧",
    });
  });
});

// ─── Booking cancellations ───────────────────────────────────────────────────

describe("validateCancellation (client-side rules)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`returns invalid when service is less than ${CANCELLATION_NOTICE_HOURS}h away`, () => {
    const serviceDate = hoursFromNowIso(12);

    const { valid, error } = validateCancellation("Pending", serviceDate);

    expect(valid).toBe(false);
    expect(error).toContain(String(CANCELLATION_NOTICE_HOURS));
  });

  it("returns valid when service is more than 24h away (Pending)", () => {
    const serviceDate = hoursFromNowIso(48);

    const { valid, error } = validateCancellation("Pending", serviceDate);

    expect(valid).toBe(true);
    expect(error).toBeNull();
  });

  it.each([
    ["Completed"],
    ["completed"],
    ["Rejected"],
    ["Cancelled"],
  ])("returns invalid for non-cancellable status: %s", (status) => {
    const far = hoursFromNowIso(100);

    const { valid, error } = validateCancellation(status, far);

    expect(valid).toBe(false);
    expect(error).toMatch(/cannot be cancelled/i);
  });
});

describe("cancelBooking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.mocked(api.put).mockResolvedValue({ data: { bookingId: 21, status: "Cancelled" } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws isValidationError before HTTP when within 24h window", async () => {
    const soon = hoursFromNowIso(10);

    await expect(cancelBooking(21, "Pending", soon)).rejects.toMatchObject({
      isValidationError: true,
      message: expect.stringMatching(/24/i),
    });

    expect(api.put).not.toHaveBeenCalled();
  });

  it("throws isValidationError when status is Completed (no HTTP)", async () => {
    await expect(
      cancelBooking(21, "Completed", hoursFromNowIso(200))
    ).rejects.toMatchObject({ isValidationError: true });

    expect(api.put).not.toHaveBeenCalled();
  });

  it("calls PUT with Cancelled when validation passes", async () => {
    const okDate = hoursFromNowIso(48);

    await cancelBooking(21, "Pending", okDate);

    expect(api.put).toHaveBeenCalledWith("/api/Booking/21/status", { status: "Cancelled" });
  });

  it("propagates 403 Forbidden from axios (backend rejection)", async () => {
    const forbidden = Object.assign(new Error("Forbidden"), {
      response: { status: 403, data: { message: "Not allowed" } },
    });
    vi.mocked(api.put).mockRejectedValueOnce(forbidden);

    const okDate = hoursFromNowIso(48);

    await expect(cancelBooking(21, "Pending", okDate)).rejects.toBe(forbidden);
    expect(api.put).toHaveBeenCalled();
  });
});

// ─── Media upload ────────────────────────────────────────────────────────────

describe("uploadImage (POST /api/Upload/image)", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockResolvedValue({
      data: { imageUrl: "https://cdn.example.com/avatars/x.png" },
    });
  });

  it("sends multipart FormData with default field name file", async () => {
    const file = new File(["dummy"], "photo.png", { type: "image/png" });

    await uploadImage(file);

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(api.post).mock.calls[0];

    expect(url).toBe("/api/Upload/image");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBe(file);
    expect(config).not.toHaveProperty("headers.Content-Type");
  });

  it("uses custom multipart field name when provided", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

    await uploadImage(file, "file");

    const body = vi.mocked(api.post).mock.calls[0][1];
    expect(body.get("file")).toBe(file);
  });

  it("returns { imageUrl } from response data", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });

    const result = await uploadImage(file);

    expect(result).toEqual({ imageUrl: "https://cdn.example.com/avatars/x.png" });
  });

  it("throws when response omits imageUrl", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} });
    const file = new File(["x"], "a.png", { type: "image/png" });

    await expect(uploadImage(file)).rejects.toThrow(/no imageUrl/i);
  });

  it("invokes onUploadProgress with 0–100 when upload events fire", async () => {
    const onProgress = vi.fn();
    vi.mocked(api.post).mockImplementation((_url, _data, cfg) => {
      if (cfg?.onUploadProgress) {
        cfg.onUploadProgress({ loaded: 50, total: 100 });
      }
      return Promise.resolve({ data: { imageUrl: "https://x" } });
    });

    const file = new File(["x"], "a.png", { type: "image/png" });
    await uploadImage(file, "file", onProgress);

    expect(onProgress).toHaveBeenCalledWith(50);
  });
});

// ─── Ratings & reviews ───────────────────────────────────────────────────────

describe("getCustomerReviews (GET /api/review/customer/{id})", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
  });

  it("returns array when API returns a plain array", async () => {
    const reviews = [
      { reviewId: 1, bookingId: 10, rating: 5, comment: "Great" },
    ];
    vi.mocked(api.get).mockResolvedValue({ data: reviews });

    const out = await getCustomerReviews(99);

    expect(api.get).toHaveBeenCalledWith("/api/review/customer/99");
    expect(out).toEqual(reviews);
  });

  it("unwraps { data: [...] } envelope", async () => {
    const inner = [{ reviewId: 2, bookingId: 11, rating: 4 }];
    vi.mocked(api.get).mockResolvedValue({ data: { data: inner } });

    const out = await getCustomerReviews(5);

    expect(out).toEqual(inner);
  });

  it("unwraps $values (.NET JSON polymorphic array)", async () => {
    const inner = [{ reviewId: 3, bookingId: 12, rating: 5 }];
    vi.mocked(api.get).mockResolvedValue({ data: { $values: inner } });

    const out = await getCustomerReviews(7);

    expect(out).toEqual(inner);
  });

  it("falls back to /api/Review/customer when /api/review/customer returns 404", async () => {
    const err404 = { response: { status: 404 } };
    const reviews = [{ reviewId: 4, bookingId: 13, rating: 3 }];
    vi.mocked(api.get)
      .mockRejectedValueOnce(err404)
      .mockResolvedValueOnce({ data: reviews });

    const out = await getCustomerReviews(42);

    expect(api.get).toHaveBeenNthCalledWith(1, "/api/review/customer/42");
    expect(api.get).toHaveBeenNthCalledWith(2, "/api/Review/customer/42");
    expect(out).toEqual(reviews);
  });
});

describe("getReviewStatus (GET /api/review/status/{bookingId})", () => {
  it("returns boolean flags from API body", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { isRatedByCustomer: true, isRatedByProvider: false },
    });

    const status = await getReviewStatus(21);

    expect(api.get).toHaveBeenCalledWith("/api/review/status/21");
    expect(status).toEqual({
      isRatedByCustomer: true,
      isRatedByProvider: false,
    });
  });
});

describe("getReviewStatuses (batch)", () => {
  it("builds a map of bookingId → status, skipping failed requests", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { isRatedByCustomer: true, isRatedByProvider: false } })
      .mockRejectedValueOnce(new Error("network"));

    const map = await getReviewStatuses([1, 2]);

    expect(map[1]).toEqual({
      isRatedByCustomer: true,
      isRatedByProvider: false,
    });
    expect(map[2]).toBeUndefined();
  });
});
