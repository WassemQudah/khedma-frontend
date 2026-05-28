import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { searchProviders } from "../api/services";
import parseApiError from "../utils/parseApiError";
import { CITIES, resolveCategories } from "../config/config";
import useCategories from "../hooks/useCategories";
import ProviderCard from "../components/ProviderCard";
import { SkeletonCard } from "../components/LoadingSpinner";
import "../styles/Search.css";

const PRICE_MAX = 500;
/** Server page size. When the API omits pagination metadata, we infer "more pages" if we received a full page. */
const PAGE_LIMIT = 12;

/**
 * Normalises pagination metadata from various possible API envelope shapes.
 */
function normalizePagination(meta, dataLength, currentPage, limit) {
  if (!meta) {
    const inferredNext = dataLength >= limit;
    return {
      page: currentPage,
      limit,
      totalCount: inferredNext ? null : dataLength,
      totalPages: inferredNext ? null : 1,
      hasNextPage: inferredNext,
      hasPreviousPage: currentPage > 1,
    };
  }
  const page = meta.page ?? meta.currentPage ?? currentPage;
  const totalCount = meta.totalCount ?? meta.total ?? 0;
  const lim = meta.limit ?? meta.pageSize ?? limit;
  const totalPages = meta.totalPages ?? Math.max(1, Math.ceil(totalCount / lim));
  return {
    page,
    limit: lim,
    totalCount,
    totalPages,
    hasNextPage: meta.hasNextPage ?? page < totalPages,
    hasPreviousPage: meta.hasPreviousPage ?? page > 1,
  };
}

export default function Search() {
  const { t } = useTranslation("search");
  const [searchParams, setSearchParams] = useSearchParams();

  const [allProviders, setAllProviders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState("grid");

  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [categories, setCategories] = useState(() => {
    const cat = searchParams.get("category");
    return cat ? [Number(cat)] : [];
  });
  const [minPrice, setMinPrice] = useState(Number(searchParams.get("minPrice") ?? 0));
  const [maxPrice, setMaxPrice] = useState(Number(searchParams.get("maxPrice") ?? PRICE_MAX));
  const [sortOrder, setSortOrder] = useState(searchParams.get("sort") ?? "none");

  const { categories: CATEGORIES } = useCategories();

  const skipDebouncedPageReset = useRef(true);
  const prevCityRef = useRef(undefined);

  // Debounce search text before hitting the API (search param)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // After the user edits the search box, reset to page 1 (not on first mount)
  useEffect(() => {
    if (skipDebouncedPageReset.current) {
      skipDebouncedPageReset.current = false;
      return;
    }
    setPage(1);
  }, [debouncedQuery]);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const categoryId = categories.length === 1 ? categories[0] : undefined;
      const hasLocalFilters = city || minPrice > 0 || maxPrice < PRICE_MAX || sortOrder !== "none" || categories.length > 1;
      const limitToUse = hasLocalFilters ? 1000 : PAGE_LIMIT;

      const result = await searchProviders({
        page,
        limit: limitToUse,
        categoryId,
        search: debouncedQuery.trim() || undefined,
      });
      setAllProviders(result.data);
      setPagination(
        normalizePagination(result.pagination, result.data.length, page, limitToUse)
      );
    } catch (err) {
      setError(parseApiError(err, t("errors.loadProviders")));
      setAllProviders([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, categories, city, minPrice, maxPrice, sortOrder, t]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // When the user changes city, reset to page 1 (city is filtered client-side on the fetched page).
  useEffect(() => {
    if (prevCityRef.current !== undefined && prevCityRef.current !== city) {
      setPage(1);
    }
    prevCityRef.current = city;
  }, [city]);

  // Sync filters + page → URL
  useEffect(() => {
    const p = {};
    if (city) p.city = city;
    if (categories.length) p.category = categories[0];
    if (minPrice > 0) p.minPrice = minPrice;
    if (maxPrice < PRICE_MAX) p.maxPrice = maxPrice;
    if (query) p.query = query;
    if (page > 1) p.page = String(page);
    if (sortOrder !== "none") p.sort = sortOrder;
    setSearchParams(p, { replace: true });
  }, [city, categories, minPrice, maxPrice, query, page, sortOrder, setSearchParams]);

  const toggleCategory = (id) => {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setCity("");
    setCategories([]);
    setMinPrice(0);
    setMaxPrice(PRICE_MAX);
    setQuery("");
    setSortOrder("none");
    setPage(1);
  };

  // City, price, and multi-category selection are filtered client-side on the current page.
  // Name search is handled by the API via `debouncedQuery`.
  const filteredProviders = allProviders.filter((p) => {
    if (city) {
      const pCity = (p.workCity ?? p.WorkCity ?? p.city ?? p.City ?? "").trim().toLowerCase();
      if (pCity !== city.toLowerCase()) return false;
    }
    if (p.basePrice != null) {
      if (minPrice > 0 && p.basePrice < minPrice) return false;
      if (maxPrice < PRICE_MAX && p.basePrice > maxPrice) return false;
    }
    if (categories.length > 1) {
      const ids = resolveCategories(p).map((c) => c.id);
      if (!categories.some((id) => ids.includes(id))) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortOrder === "ratingDesc") return (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0);
    if (sortOrder === "ratingAsc") return (a.ratingAverage ?? 0) - (b.ratingAverage ?? 0);
    return 0;
  });

  const hasFilters = city || categories.length || minPrice > 0 || maxPrice < PRICE_MAX || sortOrder !== "none";
  const activeFilterCount = [
    city,
    ...categories,
    minPrice > 0 ? minPrice : null,
    maxPrice < PRICE_MAX ? maxPrice : null,
    sortOrder !== "none" ? sortOrder : null,
  ].filter(Boolean).length;

  const totalForDisplay = pagination?.totalCount ?? allProviders.length;
  const showPagination =
    pagination
    && (pagination.totalPages > 1
      || pagination.hasNextPage
      || pagination.hasPreviousPage);

  return (
    <div className="search-page page-wrapper">
      <div className="search-page__inner container">

        <div className="search-topbar">
          <div className="search-topbar__left">
            <h1 className="search-title">{t("title")}</h1>
            <p className="search-count">
              {loading
                ? t("loading")
                : error
                  ? t("counts.dash")
                  : hasFilters || categories.length > 1
                    ? t("counts.filteredOnPage", {
                      shown: filteredProviders.length,
                      total: totalForDisplay,
                    })
                    : t("counts.totalAvailable", { total: totalForDisplay })
              }
            </p>
          </div>

          <div className="search-topbar__right">
            <div className="search-inline-wrap">
              <i className="ri-search-line" />
              <input
                className="search-inline-input"
                type="text"
                placeholder={t("searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={`search-filter-btn ${sidebarOpen ? "search-filter-btn--active" : ""}`}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <i className="ri-equalizer-line" />
              {t("filters")}
              {activeFilterCount > 0 && (
                <span className="search-filter-count">{activeFilterCount}</span>
              )}
              <i className={`ri-arrow-${sidebarOpen ? "up" : "down"}-s-line search-filter-btn__arrow`} />
            </button>

            <div className="search-view-toggle">
              <button
                className={`search-view-btn ${viewMode === "grid" ? "search-view-btn--active" : ""}`}
                onClick={() => setViewMode("grid")}
                title={t("viewGridTitle")}
                type="button"
              >
                <i className="ri-layout-grid-line" />
              </button>
              <button
                className={`search-view-btn ${viewMode === "list" ? "search-view-btn--active" : ""}`}
                onClick={() => setViewMode("list")}
                title={t("viewListTitle")}
                type="button"
              >
                <i className="ri-list-check-2" />
              </button>
            </div>
          </div>
        </div>

        <div className={`search-layout ${sidebarOpen ? "search-layout--with-sidebar" : ""}`}>

          {sidebarOpen && (
            <aside className="search-sidebar card">
              <div className="search-sidebar__header">
                <h3><i className="ri-equalizer-line" /> {t("sidebar.filtersHeading")}</h3>
                {hasFilters && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
                    <i className="ri-refresh-line" /> {t("sidebar.clearAll")}
                  </button>
                )}
              </div>

              <div className="search-filter-group">
                <label className="form-label">{t("sort.title", "Sort By")}</label>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                  <option value="none">{t("sort.none", "Default")}</option>
                  <option value="ratingDesc">{t("sort.ratingDesc", "Highest Rated")}</option>
                  <option value="ratingAsc">{t("sort.ratingAsc", "Lowest Rated")}</option>
                </select>
              </div>

              <div className="search-filter-group">
                <label className="form-label">{t("sidebar.city")}</label>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">{t("sidebar.allCities")}</option>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="search-filter-group">
                <label className="form-label">{t("sidebar.priceRange")}</label>
                <div className="price-range__inputs">
                  <div className="form-group">
                    <label className="form-label">{t("sidebar.min")}</label>
                    <input
                      type="number" min={0} max={maxPrice} value={minPrice}
                      onChange={(e) => setMinPrice(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <span className="price-range__sep">–</span>
                  <div className="form-group">
                    <label className="form-label">{t("sidebar.max")}</label>
                    <input
                      type="number" min={minPrice} max={PRICE_MAX} value={maxPrice}
                      onChange={(e) => setMaxPrice(Math.min(PRICE_MAX, Number(e.target.value)))}
                    />
                  </div>
                </div>
              </div>

              <div className="search-filter-group">
                <label className="form-label">{t("sidebar.serviceCategory")}</label>

                <div className="search-checkboxes">
                  {CATEGORIES.map((cat) => (
                    <label key={cat.id} className="search-checkbox-label">
                      <input
                        type="checkbox"
                        checked={categories.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      <span className="search-cat-label">
                        {cat.icon && <i className={`search-cat-icon ${cat.icon}`} />}
                        {/* {cat.emoji && <span className="search-cat-emoji">{cat.emoji}</span>} */}
                        {cat.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>



              <button type="button" className="btn btn--primary btn--full" onClick={() => setSidebarOpen(false)}>
                <i className="ri-check-line" /> {t("sidebar.applyClose")}
              </button>
            </aside>
          )}

          <main className="search-results">
            {error && (
              <div className="alert alert--error">
                <i className="ri-error-warning-fill" /> {error}
                <button className="btn btn--sm btn--ghost" type="button" onClick={loadProviders}>{t("retry")}</button>
              </div>
            )}

            {loading ? (
              <div className={viewMode === "grid" ? "search-grid" : "search-list-view"}>
                {Array.from({ length: 50 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="empty-state">
                <i className="ri-search-eye-line" />
                <h3>{t("empty.title")}</h3>
                <p>{t("empty.description")}</p>
                <button className="btn btn--outline" type="button" onClick={clearFilters}>{t("empty.clearFilters")}</button>
              </div>
            ) : (
              <>
                {viewMode === "grid" ? (
                  <div className="search-grid">
                    {filteredProviders.map((p) => (
                      <ProviderCard key={p.providerId ?? p.id} provider={p} />
                    ))}
                  </div>
                ) : (
                  <div className="search-list-view">
                    {filteredProviders.map((p) => (
                      <ProviderCard key={p.providerId ?? p.id} provider={p} listMode />
                    ))}
                  </div>
                )}

                {showPagination && !error && (
                  <nav className="search-pagination" aria-label={t("pagination.ariaLabel")}>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      disabled={!pagination.hasPreviousPage || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <i className="ri-arrow-left-s-line" /> {t("pagination.previous")}
                    </button>
                    <span className="search-pagination__meta">
                      {pagination.totalPages != null
                        ? t("pagination.pageOf", {
                          page: pagination.page,
                          pages: pagination.totalPages,
                        })
                        : t("pagination.pageOnly", { page: pagination.page })}
                      {pagination.totalCount != null ? (
                        <span className="search-pagination__total">
                          {" "}
                          {t("pagination.totalParen", { count: pagination.totalCount })}
                        </span>
                      ) : pagination.hasNextPage ? (
                        <span className="search-pagination__total">
                          {" "}
                          {t("pagination.moreOnNextParen")}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      disabled={!pagination.hasNextPage || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("pagination.next")} <i className="ri-arrow-right-s-line" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </main>
        </div>

      </div>
    </div>
  );
}
