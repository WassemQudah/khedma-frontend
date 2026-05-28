import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCategories } from "../api/services";
import { CATEGORIES as LOCAL_CATS } from "../config/config";

// Shared module-level cache to avoid repeated GET /api/Category calls
// across route changes and StrictMode remounts in development.
let cachedCategories = null;
let categoriesPromise = null;

/** Drop caches from older shapes (before bilingual `descEn` / `descAr`). */
function invalidateStaleCategoryCache() {
  if (cachedCategories?.length && !("descEn" in cachedCategories[0])) {
    cachedCategories = null;
  }
}

invalidateStaleCategoryCache();

function normalizeLocalEntry(c) {
  return {
    id: c.id,
    nameEn: c.name ?? "Unknown",
    nameAr: undefined,
    descEn: c.desc ?? "",
    descAr: undefined,
    icon: c.icon ?? "ri-tools-line",
    emoji: c.emoji ?? "",
  };
}

function pickDisplayName(entry, isAr) {
  if (isAr) {
    const ar = entry.nameAr?.trim();
    if (ar) return ar;
  }
  return (
    entry.nameEn?.trim()
    || entry.localizedName?.trim()
    || "Unknown"
  );
}

function pickDisplayDesc(entry, isAr) {
  if (isAr) {
    const ar = entry.descAr?.trim();
    if (ar) return ar;
  }
  return (
    entry.descEn?.trim()
    || entry.localizedDescription?.trim()
    || ""
  );
}

/**
 * useCategories
 *
 * Fetches categories from GET /api/Category and merges with local fallbacks.
 * When the API sends `nameAr` / `descriptionAr`, labels follow the active
 * i18n language (`en` vs `ar`).
 *
 * @returns {{ categories: Array, loading: boolean, error: string }}
 */
export default function useCategories() {
  const { i18n } = useTranslation();
  const [baseCategories, setBaseCategories] = useState(() => {
    if (cachedCategories?.length) return cachedCategories;
    return LOCAL_CATS.map(normalizeLocalEntry);
  });
  const [loading, setLoading] = useState(!cachedCategories);
  const [error, setError] = useState("");

  const categories = useMemo(() => {
    const isAr = (i18n.language || "").split("-")[0] === "ar";
    return baseCategories.map((c) => ({
      ...c,
      name: pickDisplayName(c, isAr),
      desc: pickDisplayDesc(c, isAr),
    }));
  }, [baseCategories, i18n.language]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      invalidateStaleCategoryCache();

      if (cachedCategories) {
        setBaseCategories(cachedCategories);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (!categoriesPromise) {
          categoriesPromise = getCategories();
        }
        const raw = await categoriesPromise;

        if (cancelled) return;

        if (!raw.length) {
          return;
        }

        const merged = raw.map((apiCat) => {
          const resolvedId = apiCat.id ?? apiCat.categoryId;
          const local = LOCAL_CATS.find((c) => c.id === resolvedId);

          const nameEn = (
            apiCat.nameEn
            ?? apiCat.name
            ?? apiCat.localizedName
            ?? local?.name
            ?? "Unknown"
          ).trim();

          const nameAr = apiCat.nameAr?.trim() || undefined;

          const descEn = (
            apiCat.descriptionEn
            ?? apiCat.desc
            ?? apiCat.localizedDescription
            ?? local?.desc
            ?? ""
          ).trim();

          const descAr = apiCat.descriptionAr?.trim() || undefined;

          return {
            id: resolvedId,
            nameEn,
            nameAr,
            descEn,
            descAr,
            localizedName: apiCat.localizedName,
            localizedDescription: apiCat.localizedDescription,
            icon: apiCat.icon ?? local?.icon ?? "ri-tools-line",
            emoji: apiCat.emoji ?? local?.emoji ?? "",
          };
        });

        cachedCategories = merged;
        setBaseCategories(merged);
      } catch {
        if (!cancelled) {
          setError("Could not load categories from server.");
        }
      } finally {
        categoriesPromise = null;
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { categories, loading, error };
}
