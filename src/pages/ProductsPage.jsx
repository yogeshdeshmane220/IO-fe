import { useEffect, useState } from "react";
import { API_URL } from "../config";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [totalPages, setTotalPages] = useState(null); // null = unknown

  useEffect(() => {
    loadProducts(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  async function loadProducts(p = 1, perPage = 20) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(p), limit: String(perPage) }).toString();
      const res = await fetch(`${API_URL}/products?${qs}`);
      if (!res.ok) {
        let msg = `Failed to load products (${res.status})`;
        try {
          const text = await res.text();
          if (text) msg = text;
        } catch (e) {}
        setError(msg);
        setProducts([]);
        setTotal(0);
        return;
      }

      const data = await res.json();


      // try header first (common: X-Total-Count)
      const totalHeader = res.headers.get("X-Total-Count") || res.headers.get("x-total-count");
      let totalCount = totalHeader ? parseInt(totalHeader, 10) : undefined;

      // parse Link header to detect next/last pages (e.g. GitHub-style)
      const linkHeader = res.headers.get("Link") || res.headers.get("link");
      let seenNext = false;
      let seenLastPage = null;
      if (linkHeader) {
        const parts = linkHeader.split(",");
        for (const part of parts) {
          const match = part.match(/<([^>]+)>\s*;\s*rel=\"([^\"]+)\"/);
          if (match) {
            const url = match[1];
            const rel = match[2];
            if (rel === "next") seenNext = true;
            if (rel === "last") {
              try {
                const u = new URL(url);
                const pnum = u.searchParams.get("page") || u.searchParams.get("_page");
                if (pnum) seenLastPage = parseInt(pnum, 10);
              } catch (e) {}
            }
          }
        }
      }

      // fallback to meta in response
      if ((totalCount === undefined || Number.isNaN(totalCount)) && data && typeof data === "object") {
        if (data.meta && typeof data.meta.total === "number") {
          totalCount = data.meta.total;
        } else if (typeof data.total === "number") {
          totalCount = data.total;
        }
      }

      // normalize items
      const items = Array.isArray(data) ? data : data.items || [];

      // final fallback: if we couldn't determine total, leave it as 0 and use link/header info
      if (totalCount === undefined || Number.isNaN(totalCount)) {
        totalCount = undefined;
      }

      setProducts(items);
      setTotal(typeof totalCount === 'number' ? totalCount : 0);

      // update Link/header derived info
      setHasNext(Boolean(seenNext) || (items.length >= perPage && !seenLastPage));
      setTotalPages(seenLastPage ? Math.max(1, seenLastPage) : (typeof totalCount === 'number' ? Math.max(1, Math.ceil(totalCount / perPage)) : null));
    } catch (err) {
      setError(err?.message || "Network error");
      setProducts([]);
      setTotal(0);
      setHasNext(false);
      setTotalPages(null);
    } finally {
      setLoading(false);
    }
  }

  const pageCount = totalPages !== null ? Math.max(1, totalPages) : Math.max(1, Math.ceil(total / pageSize));

  function gotoPage(n) {
    if (n < 1) return;
    if (totalPages !== null && n > totalPages) return;
    setPage(n);
  }

  function handlePageSizeChange(e) {
    const val = parseInt(e.target.value, 10) || 20;
    setPageSize(val);
    setPage(1);
  }

  // derived pagination helpers
  const canPrev = page > 1;
  const canNext = totalPages !== null ? page < totalPages : (hasNext || products.length >= pageSize);

  return (
    <div className="container product-list">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2>Products</h2>
          <div>
            <button className="btn" onClick={() => loadProducts(page, pageSize)} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {loading && <div className="muted">Loading products…</div>}

        {error && (
          <div style={{ marginBottom: 12 }}>
            <div className="small" style={{ color: "#b91c1c" }}>{error}</div>
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => loadProducts(page, pageSize)}>retry</button>
            </div>
          </div>
        )}

        {!loading && !error && products.length === 0 && <div className="muted">No products found</div>}

        {!loading && !error && products.map((p) => (
          <div className="product-item" key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {p.description && <div className="small muted" style={{ marginTop: 4 }}>{p.description}</div>}
                <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                  {p.sku && <div className="small">SKU: <strong>{p.sku}</strong></div>}
                  {typeof p.price !== 'undefined' && <div className="small">Price: <strong>{formatPrice(p.price)}</strong></div>}
                  {p.category && <div className="small">Category: <strong>{p.category}</strong></div>}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Pagination controls */}
        {!loading && !error && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <button className="btn" onClick={() => gotoPage(page - 1)} disabled={page <= 1}>Prev</button>
            </div>

            <div>
              {totalPages !== null ? (
                <>Page {page} of {pageCount}</>
              ) : (
                <>Page {page}</>
              )}
            </div>

            <div>
              <button className="btn" onClick={() => gotoPage(page + 1)} disabled={!canNext}>
                Next
              </button>
            </div>

            <div style={{ marginLeft: "auto" }}>
              <label className="small muted" style={{ marginRight: 8 }}>Per page</label>
              <select value={pageSize} onChange={handlePageSizeChange}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // helper
  function formatPrice(v) {
    if (v === null || v === undefined || v === "") return "-";
    // assume number in cents or number; try best-effort
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    // if large integer like 1999 assume cents
    if (n > 1000 && Math.round(n) === n) {
      return `$${(n / 100).toFixed(2)}`;
    }
    return `$${n.toFixed(2)}`;
  }
}
