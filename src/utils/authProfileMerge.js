import { BASE_URL } from "../config/config";

/**
 * Normalizes profile photo URLs (`/uploads/...` vs absolute).
 */
export function toAbsoluteProfileImage(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${BASE_URL}${s}`;
  return `${BASE_URL}/${s}`;
}

function firstNonEmptyString(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return "";
}

/** Merge GET /Auth/me (or PUT profile) onto prior session without dropping name/photo. */
export function mergeSessionWithFreshProfile(sessionLike, apiLike) {
  const prev = sessionLike && typeof sessionLike === "object" ? sessionLike : {};
  const next = apiLike && typeof apiLike === "object" ? apiLike : {};

  const merged = { ...prev, ...next };

  merged.fullName = firstNonEmptyString(
    next.fullName,
    next.FullName,
    prev.fullName,
    prev.FullName,
    merged.fullName,
  );

  merged.phoneNumber = firstNonEmptyString(
    next.phoneNumber,
    next.PhoneNumber,
    prev.phoneNumber,
    prev.PhoneNumber,
  );

  merged.email = firstNonEmptyString(next.email, next.Email, prev.email, prev.Email, merged.email);

  merged.businessName = firstNonEmptyString(
    next.businessName,
    next.BusinessName,
    prev.businessName,
    prev.BusinessName,
    merged.businessName,
  );

  merged.workCity = firstNonEmptyString(
    next.workCity,
    next.WorkCity,
    prev.workCity,
    prev.WorkCity,
    merged.workCity,
  );

  if ("bio" in next || "Bio" in next) {
    merged.bio = next.bio ?? next.Bio ?? "";
  }

  const nextPrice = next.basePrice ?? next.BasePrice;
  if (nextPrice != null && nextPrice !== "") {
    merged.basePrice = typeof nextPrice === "number" ? nextPrice : Number(nextPrice);
  }

  merged.specificLocation = firstNonEmptyString(
    next.specificLocation,
    next.SpecificLocation,
    prev.specificLocation,
    prev.SpecificLocation,
  );

  const imgKeyPresent =
    Object.prototype.hasOwnProperty.call(next, "profileImageUrl")
    || Object.prototype.hasOwnProperty.call(next, "ProfileImageUrl");
  const rawNextImg = imgKeyPresent ? (next.profileImageUrl ?? next.ProfileImageUrl ?? "") : undefined;
  const clearedImage = imgKeyPresent && String(rawNextImg ?? "").trim() === "";

  if (clearedImage) {
    merged.profileImageUrl = "";
  } else {
    merged.profileImageUrl = toAbsoluteProfileImage(firstNonEmptyString(
      next.profileImageUrl,
      next.ProfileImageUrl,
      prev.profileImageUrl,
      prev.ProfileImageUrl,
    ));
  }

  return merged;
}
