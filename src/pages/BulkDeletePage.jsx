import { useState } from "react";
import { API_URL } from "../config";
export default function BulkDeletePage() {
  const [status, setStatus] = useState("idle"); // idle | processing | done | failed
  const [error, setError] = useState("");

  async function clearAll() {
    setStatus("processing");
    setError("");

    try {
      const r = await fetch(`${API_URL}/products/clear_all`, {
        method: "DELETE",
      });

      if (!r.ok) {
        // try to read message from body
        let msg = "Failed to delete products";
        try {
          const body = await r.text();
          if (body) msg = body;
        } catch (e) {}
        setError(msg);
        setStatus("failed");
        return;
      }

      setStatus("done");
    } catch (err) {
      setError(err?.message || "Network error");
      setStatus("failed");
    }
  }

  function reset() {
    setStatus("idle");
    setError("");
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Bulk Delete Products</h2>

        {status === "idle" && (
          <button
            className="btn btn-danger"
            onClick={() => {
              const ok = window.confirm(
                "Are you sure? This will permanently delete all products."
              );
              if (ok) clearAll();
            }}
          >
            delete all products
          </button>
        )}

        {status === "processing" && (
          <div>
            <button className="btn btn-danger" disabled>
              deleting…
            </button>
            <p className="muted">Please wait — this may take a moment.</p>
          </div>
        )}

        {status === "done" && (
          <div>
            <p className="muted">All products removed.</p>
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={reset}>
                ok
              </button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div>
            <p className="muted">Failed to delete products.</p>
            {error && <p className="small" style={{ color: "#b91c1c" }}>{error}</p>}
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button className="btn btn-danger" onClick={clearAll}>
                retry
              </button>
              <button className="btn" onClick={reset}>
                cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
