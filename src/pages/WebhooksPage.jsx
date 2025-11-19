import { useState, useEffect } from "react";

export default function WebhooksPage() {
  const [hooks, setHooks] = useState([]);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [opError, setOpError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("http://localhost:8000/webhooks");
      if (!r.ok) {
        let msg = `Failed to load (${r.status})`;
        try {
          const text = await r.text();
          if (text) msg = text;
        } catch (e) {}
        setError(msg);
        setHooks([]);
        return;
      }
      setHooks(await r.json());
    } catch (err) {
      setError(err?.message || "Network error");
      setHooks([]);
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!url) return;
    setCreating(true);
    setOpError("");
    try {
      const r = await fetch("http://localhost:8000/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, enabled }),
      });
      if (!r.ok) {
        let msg = `Create failed (${r.status})`;
        try { const text = await r.text(); if (text) msg = text; } catch(e){}
        setOpError(msg);
        return;
      }
      setUrl("");
      setEnabled(true);
      load();
    } catch (err) {
      setOpError(err?.message || "Network error");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id) {
    setProcessingId(id);
    setOpError("");
    try {
      const r = await fetch(`http://localhost:8000/webhooks/${id}`, { method: "DELETE" });
      if (!r.ok) {
        let msg = `Delete failed (${r.status})`;
        try { const text = await r.text(); if (text) msg = text; } catch(e){}
        setOpError(msg);
        return;
      }
      load();
    } catch (err) {
      setOpError(err?.message || "Network error");
    } finally {
      setProcessingId(null);
    }
  }

  async function toggle(id, current) {
    setProcessingId(id);
    setOpError("");
    try {
      const r = await fetch(`http://localhost:8000/webhooks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      if (!r.ok) {
        let msg = `Update failed (${r.status})`;
        try { const text = await r.text(); if (text) msg = text; } catch(e){}
        setOpError(msg);
        return;
      }
      load();
    } catch (err) {
      setOpError(err?.message || "Network error");
    } finally {
      setProcessingId(null);
    }
  }

  async function test(id) {
    setProcessingId(id);
    setOpError("");
    try {
      const r = await fetch(`http://localhost:8000/webhooks/${id}/test`, { method: "POST" });
      if (!r.ok) {
        let msg = `Test failed (${r.status})`;
        try { const text = await r.text(); if (text) msg = text; } catch(e){}
        setOpError(msg);
        return;
      }
    } catch (err) {
      setOpError(err?.message || "Network error");
    } finally {
      setProcessingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2>Webhook Manager</h2>
          <div>
            <button className="btn" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>

        <div style={{ marginBottom: 20 }} className="form-row">
          <input
            className="input"
            placeholder="webhook url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={creating}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={creating}
            />
            enabled
          </label>
          <button className="btn btn-primary" onClick={create} disabled={creating || !url}>
            {creating ? 'Adding…' : 'add'}
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 8 }}>
            <div className="small" style={{ color: "#b91c1c" }}>{error}</div>
          </div>
        )}

        <table className="table">
        <thead>
          <tr>
            <th>id</th>
            <th>url</th>
            <th>enabled</th>
            <th>test</th>
            <th>delete</th>
          </tr>
        </thead>

        <tbody>
          {hooks.map((h) => (
            <tr key={h.id}>
              <td>{h.id}</td>
              <td>{h.url}</td>
              <td>
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={() => toggle(h.id, h.enabled)}
                  disabled={processingId === h.id}
                />
              </td>
              <td>
                <button className="btn" onClick={() => test(h.id)} disabled={processingId === h.id}> {processingId === h.id ? '…' : 'test'}</button>
              </td>
              <td>
                <button className="btn btn-danger" onClick={() => remove(h.id)} disabled={processingId === h.id}>{processingId === h.id ? '…' : 'delete'}</button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>

        {opError && <div className="small" style={{ marginTop: 12, color: '#b91c1c' }}>{opError}</div>}
      </div>
    </div>
  );
}
