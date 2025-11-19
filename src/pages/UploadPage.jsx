import { useState, useRef, useEffect } from "react";
import { API_URL } from "../config";
export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [percent, setPercent] = useState(0);
  const [uploadBytes, setUploadBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes/sec
  const [eta, setEta] = useState(null);
  const [insertPercent, setInsertPercent] = useState(0);
  const [insertedCount, setInsertedCount] = useState(0);
  const [insertTotal, setInsertTotal] = useState(null);
  const [lastPollData, setLastPollData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [jobs, setJobs] = useState([]); // {id, status, percent, error, fileName}
  const pollingRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function startUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setPercent(0);

    try {
      // use XHR to get upload progress events
      const data = await new Promise((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/upload/`);

        // track bytes/time to compute upload speed and ETA
        let lastLoaded = 0;
        let lastTime = Date.now();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const p = Math.round((e.loaded / e.total) * 100);
            setPercent(p);
            setUploadBytes(e.loaded);
            setUploadTotalBytes(e.total);

            const now = Date.now();
            const dt = Math.max(1, now - lastTime) / 1000;
            const dBytes = e.loaded - lastLoaded;
            const speed = dBytes / dt; // bytes/sec
            if (Number.isFinite(speed) && speed > 0) setUploadSpeed(Math.round(speed));
            lastLoaded = e.loaded;
            lastTime = now;

            if (e.lengthComputable && speed > 0) {
              const remaining = e.total - e.loaded;
              const secs = Math.max(0, Math.round(remaining / speed));
              setEta(secs);
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText || xhr.response);
              resolve(json);
            } catch (err) {
              reject(err);
            }
          } else {
            // include response text when possible
            const txt = xhr.responseText || String(xhr.status);
            reject(new Error(`Upload failed (${xhr.status}) ${txt}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));

        xhr.send(form);
      });

  // server returned a job id — show it in UI and start polling
      const returnedJobId = data.job_id || data.id || null;
      setJobId(returnedJobId);
      setStatus("pending");
      // add to jobs list so Recent Upload Jobs shows immediately
      setJobs((jobs) => [
        { id: returnedJobId || Date.now(), status: "pending", percent: data.percent || percent || 0, error: "", fileName: file?.name || "" },
        ...jobs,
      ]);
      pollStatus(returnedJobId, file?.name || "");
    } catch (err) {
      setUploadError(err?.message || "Network error");
      setJobs((jobs) => [
        { id: Date.now(), status: "failed", percent: 0, error: err?.message || "Network error", fileName: file?.name || "" },
        ...jobs,
      ]);
    } finally {
      setUploading(false);
      // reset upload speed/eta after upload finished (processing may continue)
      // keep percent as last uploaded until server-side processing updates it
      setUploadSpeed((s) => s);
    }
  }

  function pollStatus(id, fileName) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_URL}/upload/${id}`);
        if (!r.ok) {
          clearInterval(pollingRef.current);
          setStatus("failed");
          const msg = `Status fetch failed (${r.status})`;
          setUploadError(msg);
          setJobs((jobs) => [
            { id, status: "failed", percent: 0, error: msg, fileName },
            ...jobs,
          ]);
          return;
        }

  const d = await r.json();
  setLastPollData(d);
        // normalize percent (server may return 0-1 or 0-100)
        let remotePercent = 0;
        if (typeof d.percent === 'number') remotePercent = d.percent;
        else if (typeof d.percent === 'string') remotePercent = Number(d.percent) || 0;
        if (remotePercent > 0 && remotePercent <= 1) remotePercent = Math.round(remotePercent * 100);
        remotePercent = Math.max(0, Math.min(100, Math.round(remotePercent)));

  setStatus(d.status);
  setPercent(remotePercent);

  // server may report insertion progress nested anywhere — try to find candidates
  const candidates = findInObject(d, ['insert_percent','insert_progress','inserted','inserted_count','total_records','total','records_total','records_processed','progress']);
  let ip = 0;
  let foundInserted = null;
  let foundTotal = null;
  if (candidates) {
    for (const c of candidates) {
      const k = c.key;
      const v = Number(c.value) || 0;
      if (k.includes('insert') || k.includes('inserted') || k.includes('processed')) {
        // likely a numerator
        if (k.includes('total') || k.includes('count') === false) {
          // if it's percent-like
          if (v > 0 && v <= 1) ip = Math.round(v * 100);
          else if (v > 1 && v <= 100) ip = Math.round(v);
          else foundInserted = v;
        } else {
          // fallback
          foundInserted = v;
        }
      }
      if (k.includes('total') || k === 'total') {
        foundTotal = v;
      }
      if (k === 'progress') {
        if (v > 0 && v <= 1) ip = Math.round(v * 100);
        else ip = Math.round(v);
      }
    }
  }

  // if we found inserted and total, compute percent
  if ((!ip || ip === 0) && foundInserted !== null && foundTotal !== null && foundTotal > 0) {
    ip = Math.max(0, Math.min(100, Math.round((foundInserted / foundTotal) * 100)));
  }

  // fallback to top-level keys if nothing found
  if ((!ip || ip === 0) && d.insert_percent !== undefined) ip = Number(d.insert_percent) || 0;
  if ((!ip || ip === 0) && d.insert_progress !== undefined) ip = Number(d.insert_progress) || 0;
  if ((!ip || ip === 0) && d.progress !== undefined) ip = Number(d.progress) || 0;

  if (ip > 0 && ip <= 1) ip = Math.round(ip * 100);
  ip = Math.max(0, Math.min(100, Math.round(ip || 0)));

  // if server finished but didn't report insertion, show 100% as a fallback
  const finalInsertPercent = (d.status === 'complete' && ip < 100) ? 100 : ip;
  setInsertPercent(finalInsertPercent);
  if (foundInserted !== null) setInsertedCount(foundInserted);
  else if (d.inserted !== undefined) setInsertedCount(Number(d.inserted) || 0);
  else if (d.inserted_count !== undefined) setInsertedCount(Number(d.inserted_count) || 0);
  if (foundTotal !== null) setInsertTotal(foundTotal);
  else if (d.total_records !== undefined) setInsertTotal(Number(d.total_records) || null);
  else if (d.total !== undefined) setInsertTotal(Number(d.total) || null);
  else if (d.records_total !== undefined) setInsertTotal(Number(d.records_total) || null);

        // update jobs list entry if present
        setJobs((jobs) => {
          const found = jobs.some((j) => String(j.id) === String(id));
          const updated = jobs.map((j) => (String(j.id) === String(id) ? { ...j, status: d.status, percent: remotePercent, insertPercent: finalInsertPercent, insertedCount: d.inserted || d.inserted_count || 0, insertTotal: d.total_records || d.total || null, error: d.status === 'failed' ? (d.error || 'Job failed') : '' } : j));
          if (found) return updated;
          // prepend if not found — include insertion fields so Recent Jobs UI can show them
          return [{ id, status: d.status, percent: remotePercent, insertPercent: finalInsertPercent, insertedCount: maybeNumber(d.inserted) || maybeNumber(d.inserted_count) || 0, insertTotal: maybeNumber(d.total_records) || maybeNumber(d.total) || maybeNumber(d.records_total) || null, error: d.status === 'failed' ? (d.error || 'Job failed') : '', fileName }, ...jobs];
        });

        if (d.status === "complete" || d.status === "failed") {
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        clearInterval(pollingRef.current);
        setStatus("failed");
        const msg = err?.message || "Network error while polling";
        setUploadError(msg);
        setJobs((jobs) => [
          { id, status: "failed", percent: 0, error: msg, fileName },
          ...jobs,
        ]);
      }
    }, 1000);
  }

  function resetUpload() {
    setFile(null);
    setJobId(null);
    setStatus(null);
    setPercent(0);
    setUploadBytes(0);
    setUploadTotalBytes(0);
    setUploadSpeed(0);
    setEta(null);
  setInsertPercent(0);
  setInsertedCount(0);
  setInsertTotal(null);
    setUploadError("");
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Upload CSV</h2>

        <div className="form-row">
          <input
            className="input"
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
            disabled={uploading || (status && status !== "failed" && status !== "complete")}
          />

          <button
            className="btn btn-primary"
            disabled={!file || uploading || (status && status !== "failed" && status !== "complete")}
            onClick={startUpload}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <button className="btn" onClick={resetUpload} disabled={uploading}>
            reset
          </button>
        </div>

        {uploadError && (
          <div style={{ marginTop: 12 }}>
            <div className="small" style={{ color: "#b91c1c" }}>{uploadError}</div>
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={startUpload} disabled={uploading || !file}>retry</button>
            </div>
          </div>
        )}

        {jobId && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Job ID: {jobId}</div>
                <div className="small muted">Status: {status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {uploadSpeed > 0 && <div className="small">Speed: {formatBytes(uploadSpeed)}/s</div>}
                {eta !== null && <div className="small muted">ETA: {formatETA(eta)}</div>}
              </div>
            </div>

            {/* Upload progress (client -> server) */}
            <div style={{ marginTop: 12 }}>
              <div className="small muted">Uploading file to server</div>
              <div className="progress" style={{ marginTop: 6 }}>
                <div className="bar" style={{ width: `${percent}%` }} />
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>{formatBytes(uploadBytes)} of {uploadTotalBytes ? formatBytes(uploadTotalBytes) : '—'} ({percent}%)</div>
            </div>

            {/* Server processing progress (server-side) */}
            <div style={{ marginTop: 12 }}>
              <div className="small muted">Server processing</div>
              <div className="progress" style={{ marginTop: 6 }}>
                <div className="bar" style={{ width: `${percent}%`, background: 'linear-gradient(90deg,#0366d6,#06b6d4)' }} />
              </div>
            </div>

            {/* Insertion progress (records being inserted into DB) */}
            <div style={{ marginTop: 12 }}>
              <div className="small muted">Inserting records</div>
              <div className="progress" style={{ marginTop: 6 }}>
                <div className="bar" style={{ width: `${insertPercent}%`, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>{insertedCount}{insertTotal ? ` of ${insertTotal}` : ''} ({insertPercent}%)</div>
            </div>

            {/* debug: last poll response */}
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setShowDebug(s => !s)} style={{ marginBottom: 8 }}>{showDebug ? 'Hide' : 'Show'} server response</button>
              {showDebug && (
                <pre style={{ maxHeight: 220, overflow: 'auto', background: '#f8fafc', padding: 10, borderRadius: 8 }}>{JSON.stringify(lastPollData, null, 2)}</pre>
              )}
            </div>
          </div>
        )}
      </div>

      {jobs.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16 }}>Recent Upload Jobs</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Job/File</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.fileName || job.id}</td>
                  <td style={{ color: job.status === "failed" ? "#b91c1c" : job.status === "complete" ? "#10b981" : undefined }}>
                    {job.status}
                  </td>
                  <td>{job.percent}%</td>
                  <td className="small">{job.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// helpers
function formatBytes(n) {
  if (!n && n !== 0) return "-";
  const units = ['B','KB','MB','GB','TB'];
  let i = 0;
  let v = Number(n);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatETA(sec) {
  if (sec === null || sec === undefined) return '-';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

// deep search helper: look for numeric values under likely insertion keys
function findInObject(obj, keys = []) {
  if (!obj || typeof obj !== 'object') return null;
  const lowerKeys = keys.map(k => k.toLowerCase());
  const results = [];

  function walk(o) {
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) {
        const val = o[k];
        const lk = k.toLowerCase();
        if (lowerKeys.includes(lk) && (typeof val === 'number' || typeof val === 'string')) {
          const n = Number(val);
          if (!Number.isNaN(n)) results.push({ key: lk, value: n });
        }
        if (val && typeof val === 'object') walk(val);
      }
      if (Array.isArray(o)) {
        for (const item of o) if (typeof item === 'object') walk(item);
      }
    }
  }

  walk(obj);
  return results.length ? results : null;
}
