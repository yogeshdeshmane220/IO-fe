import { useEffect, useState } from "react";
import { API_URL } from "../config";
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/products`);
      if (!res.ok) {
        let msg = `Failed to load products (${res.status})`;
        try {
          const text = await res.text();
          if (text) msg = text;
        } catch (e) {}
        setError(msg);
        setProducts([]);
        return;
      }

      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err?.message || "Network error");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container product-list">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2>Products</h2>
          <div>
            <button className="btn" onClick={loadProducts} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {loading && <div className="muted">Loading products…</div>}

        {error && (
          <div style={{ marginBottom: 12 }}>
            <div className="small" style={{ color: "#b91c1c" }}>{error}</div>
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={loadProducts}>retry</button>
            </div>
          </div>
        )}

        {!loading && !error && products.length === 0 && <div className="muted">No products found</div>}

        {!loading && !error && products.map((p) => (
          <div className="product-item" key={p.id}>
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}
