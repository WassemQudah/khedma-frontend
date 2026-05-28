import { useState, useCallback, useRef } from "react";
import { searchProviders } from "../api/services";
import parseApiError from "../utils/parseApiError";

/** @type {import("../api/models").ProviderSearchParams} */
const DEFAULT_PARAMS = { page: 1, limit: 10, categoryId: null, search: "" };

/**
 * useProviderSearch
 *
 * Encapsulates all state and logic for the paginated provider search.
 * Stores the full pagination metadata block returned by the API so the UI can
 * render page controls, total counts, etc. without any extra network calls.
 *
 * @param {import("../api/models").ProviderSearchParams} [initialParams]
 *
 * @example
 * const { providers, pagination, loading, error, search, goToPage, setFilter } =
 *   useProviderSearch({ limit: 12 });
 *
 * // Initial load
 * useEffect(() => { search(); }, []);
 *
 * // Filter by category
 * setFilter("categoryId", 2);
 * search();
 *
 * // Go to next page
 * goToPage(pagination.page + 1);
 */
export default function useProviderSearch(initialParams = {}) {
  const [providers,   setProviders]   = useState(/** @type {import("../api/models").Provider[]} */ ([]));
  const [pagination,  setPagination]  = useState(/** @type {import("../api/models").PaginationMeta|null} */ (null));
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [params,      setParams]      = useState({ ...DEFAULT_PARAMS, ...initialParams });

  // Ref to cancel stale requests: if the user fires two searches quickly,
  // only the last one updates state.
  const latestSearch = useRef(0);

  /**
   * Fire a search with optional one-off parameter overrides.
   * Overrides are merged into the current params and persisted for pagination.
   *
   * @param {Partial<import("../api/models").ProviderSearchParams>} [overrides]
   */
  const search = useCallback(async (overrides = {}) => {
    const nextParams = { ...params, ...overrides };
    setParams(nextParams);
    setLoading(true);
    setError("");

    const token = ++latestSearch.current;

    try {
      const result = await searchProviders(nextParams);
      if (token !== latestSearch.current) return; // stale — discard
      setProviders(result.data);
      setPagination(result.pagination);
    } catch (err) {
      if (token !== latestSearch.current) return;
      setError(parseApiError(err, "Failed to load providers."));
    } finally {
      if (token === latestSearch.current) setLoading(false);
    }
  }, [params]);

  /**
   * Navigate to a specific page, keeping all other filters intact.
   * @param {number} page
   */
  const goToPage = useCallback(
    (page) => search({ page }),
    [search]
  );

  /**
   * Update a single filter key and reset to page 1.
   * Call `search()` afterwards (or pass `autoSearch: true`).
   *
   * @param {keyof import("../api/models").ProviderSearchParams} key
   * @param {any} value
   * @param {{ autoSearch?: boolean }} [opts]
   */
  const setFilter = useCallback(
    (key, value, { autoSearch = false } = {}) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value, page: 1 };
        if (autoSearch) {
          // Trigger search asynchronously with the latest params
          setTimeout(() => search(next), 0);
        }
        return next;
      });
    },
    [search]
  );

  /** Reset all filters to defaults and clear results. */
  const clearFilters = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setProviders([]);
    setPagination(null);
    setError("");
  }, []);

  return {
    /** Current page of provider results */
    providers,
    /** Pagination metadata from the API (null for non-paged responses) */
    pagination,
    loading,
    error,
    /** Active search parameters */
    params,
    /** Fire a search; pass overrides to merge with current params */
    search,
    /** Navigate to a page number */
    goToPage,
    /** Update one filter key (resets to page 1) */
    setFilter,
    /** Reset everything */
    clearFilters,
  };
}
