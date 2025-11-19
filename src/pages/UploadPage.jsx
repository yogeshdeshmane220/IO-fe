import { useState, useRef, useEffect } from "react";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [percent, setPercent] = useState(0);
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

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("http://localhost:8000/upload/", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try {
          const text = await res.text();
          if (text) msg = text;
        } catch (e) {}
        setUploadError(msg);
        setJobs((jobs) => [
          { id: Date.now(), status: "failed", percent: 0, error: msg, fileName: file?.name || "" },
          ...jobs,
        ]);
        return;
      }

      const data = await res.json();
      setJobId(data.job_id);
      setStatus("pending");
      pollStatus(data.job_id, file?.name || "");
    } catch (err) {
      setUploadError(err?.message || "Network error");
      setJobs((jobs) => [
        { id: Date.now(), status: "failed", percent: 0, error: err?.message || "Network error", fileName: file?.name || "" },
        ...jobs,
      ]);
    } finally {
      setUploading(false);
    }
  }

  function pollStatus(id, fileName) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch(`http://localhost:8000/upload/${id}`);
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
        setStatus(d.status);
        setPercent(d.percent || 0);

        if (d.status === "complete" || d.status === "failed") {
          clearInterval(pollingRef.current);
          setJobs((jobs) => [
            { id, status: d.status, percent: d.percent || 0, error: d.status === "failed" ? "Job failed" : "", fileName },
            ...jobs,
          ]);
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
            <div>Job ID: {jobId}</div>
            <div>Status: {status}</div>
            <div>Progress: {percent}%</div>

            <div className="progress" style={{ marginTop: 8 }}>
              <div className="bar" style={{ width: `${percent}%` }} />
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
