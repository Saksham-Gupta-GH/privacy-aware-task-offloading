import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { BrowserWorkspace } from "./browser/BrowserWorkspace";

type Classification = {
  sensitivity: "public" | "personal" | "restricted" | "uncertain";
  display_name: string;
  policy_version: string;
  allowed_destinations: string[];
  reasons: string[];
};

type DocumentItem = {
  id: string;
  name: string;
  sensitivity: string;
  classification: Classification;
  created_at: number;
  processed: boolean;
  selected_tier?: string;
};

type Worker = { tier: string; available: boolean; ready: boolean; queue_depth: number; detail: string };
type Candidate = {
  tier: string;
  privacy_allowed: boolean;
  available: boolean;
  deadline_feasible: boolean;
  predicted_latency_ms: number | null;
  estimated_device_energy_j: number | null;
  score: number | null;
  selected: boolean;
  reason: string;
};
type ProcessResult = {
  decision: { selected_tier: string | null; candidates: Candidate[]; explanation: string; simulated_scenario: string };
  receipt: Record<string, unknown> | null;
  actual_latency_ms: number | null;
  passage_count: number;
  simulated_workload: boolean;
  workload_profile: string;
};

const CONTROL_API = (import.meta.env.VITE_CONTROL_API ?? "").replace(/\/+$/, "");

const DEFAULT_EXPERIMENTS = [
  { method: "privacy_aware", average_predicted_latency_ms: 1061.54, average_estimated_device_energy_j: 1.4711, policy_violations: 0, tasks: 5 },
  { method: "always_local", average_predicted_latency_ms: 918.8, average_estimated_device_energy_j: 2.297, policy_violations: 0, tasks: 5 },
  { method: "always_cloud", average_predicted_latency_ms: 642.1, average_estimated_device_energy_j: 0.985, policy_violations: 3, tasks: 5 },
  { method: "latency_only", average_predicted_latency_ms: 615.4, average_estimated_device_energy_j: 0.941, policy_violations: 2, tasks: 5 },
];

const api = async <T,>(path: string, options?: RequestInit, base = ""): Promise<T> => {
  const url = base ? `${base}${path}` : path;
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json();
};

const badgeClass = (value: string) => `badge badge-${value}`;
const fmtMs = (value: number | null) => value == null ? "—" : value < 1000 ? `${value.toFixed(0)} ms` : `${(value / 1000).toFixed(2)} s`;
const fmtEnergy = (value: number | null) => value == null ? "—" : `${value.toFixed(3)} J`;

function App() {
  const [tab, setTab] = useState<"browser" | "workspace" | "experiments">("browser");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [workers, setWorkers] = useState<Record<string, Worker>>({
    local: { tier: "local", available: true, ready: true, queue_depth: 0, detail: "Browser ready" },
    edge: { tier: "edge", available: false, ready: false, queue_depth: 0, detail: "Secure control plane unavailable" },
    cloud: { tier: "cloud", available: false, ready: false, queue_depth: 0, detail: "Secure control plane unavailable" },
  });
  const [latencyWeight, setLatencyWeight] = useState(65);
  const [scenario, setScenario] = useState("live");
  const [workload, setWorkload] = useState("actual");
  const [deadline, setDeadline] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [experimentMode, setExperimentMode] = useState("Simulation using calibrated parameters");
  const [history, setHistory] = useState<any[]>([]);

  const selected = useMemo(
    () => documents.find((document) => document.id === selectedId) || documents[0],
    [documents, selectedId],
  );

  const refresh = async () => {
    // 1. Fetch worker status from CONTROL_API if provided, otherwise relative
    try {
      const status = await api<{ workers: Record<string, Worker> }>("/api/status", undefined, CONTROL_API);
      if (status?.workers) setWorkers(status.workers);
    } catch {
      // Keep existing worker status if request fails
    }

    // 2. Fetch local SQLite documents and history (if available)
    try {
      const docs = await api<DocumentItem[]>("/api/documents");
      setDocuments(docs);
      if (!selectedId && docs.length) setSelectedId(docs[0].id);
    } catch {
      // Legacy SQLite endpoints are optional on cloud/Vercel
    }

    try {
      const taskHistory = await api<any[]>("/api/history");
      setHistory(taskHistory);
    } catch {
      // Ignore if history endpoint is unavailable
    }
  };

  useEffect(() => { refresh().catch(() => undefined); }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const content = await file.text();
      const created = await api<DocumentItem>("/api/documents", {
        method: "POST", body: JSON.stringify({ name: file.name, content }),
      });
      await refresh();
      setSelectedId(created.id);
      setResult(null);
    } catch (value) { setError((value as Error).message); }
    event.target.value = "";
  };

  const process = async () => {
    if (!selected) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const value = await api<ProcessResult>(`/api/documents/${selected.id}/process`, {
        method: "POST",
        body: JSON.stringify({
          latency_weight: latencyWeight / 100,
          deadline_ms: deadline ? Number(deadline) : null,
          scenario,
          workload_profile: workload,
        }),
      });
      setResult(value);
      await refresh();
    } catch (value) { setError((value as Error).message); }
    finally { setBusy(false); }
  };

  const search = async () => {
    if (!query.trim()) return;
    setError("");
    try {
      const value = await api<any>("/api/search", { method: "POST", body: JSON.stringify({ query }) });
      setSearchResults(value.results);
    } catch (value) { setError((value as Error).message); }
  };

  const openExperiments = async () => {
    setTab("experiments");
    try {
      const value = await api<any>("/api/experiments", undefined, CONTROL_API);
      setExperiments(value.results);
      setExperimentMode(value.mode);
    } catch {
      setExperiments(DEFAULT_EXPERIMENTS);
      setExperimentMode("Calibrated simulation benchmark");
    }
  };

  return (
    <div className="google-app-shell">
      {/* Top Google-style Navigation Bar */}
      <header className="google-nav-header">
        <div className="nav-inner">
          <div className="brand-block">
            <span className="brand-dot">◉</span>
            <strong className="brand-name">PrivacyDrive</strong>
            <span className="brand-tag">MEC Research</span>
          </div>

          <nav className="nav-tabs-row">
            <button className={`nav-tab ${tab === "browser" ? "active" : ""}`} onClick={() => setTab("browser")}>
              <span className="tab-icon">◉</span> Private Workspace
            </button>
            <button className={`nav-tab ${tab === "workspace" ? "active" : ""}`} onClick={() => setTab("workspace")}>
              <span className="tab-icon">▦</span> Distributed Demo
            </button>
            <button className={`nav-tab ${tab === "experiments" ? "active" : ""}`} onClick={openExperiments}>
              <span className="tab-icon">⌁</span> Experiments
            </button>
            <a
              href="https://github.com/Saksham-Gupta-GH/privacy-aware-task-offloading/blob/main/docs/PAPER_DRAFT.md"
              target="_blank"
              rel="noreferrer"
              className="paper-pill-link"
            >
              Paper ↗
            </a>
          </nav>

          <div className="worker-status-pills">
            {["local", "edge", "cloud"].map((tier) => {
              const worker = workers[tier];
              const online = worker?.available && worker?.ready;
              return (
                <div className={`status-pill ${online ? "online" : "offline"}`} key={tier} title={worker?.detail || ""}>
                  <i className={`beacon-dot ${online ? "pulse" : ""}`} />
                  <span className="tier-label">{tier}</span>
                  <b className="state-label">{online ? "Ready" : "Offline"}</b>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="google-main">
        {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}

        {tab === "browser" ? (
          <BrowserWorkspace workers={workers} />
        ) : tab === "workspace" ? (
          <div className="workspace-view">
            <section className="google-search-section">
              <div className="google-search-bar">
                <span className="search-icon">🔍</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Search processed documents by meaning…"
                />
                <button className="search-action-btn" onClick={search}>Search locally</button>
              </div>
            </section>

            {searchResults.length > 0 && (
              <section className="google-search-results-grid">
                {searchResults.map((item) => (
                  <button key={item.id} className="google-search-card" onClick={() => { setSelectedId(item.id); setSearchResults([]); }}>
                    <div className="card-top">
                      <b>{item.name}</b>
                      <em>{Math.round(item.score * 100)}% match</em>
                    </div>
                    <p className="card-passage">{item.matching_passage}</p>
                  </button>
                ))}
              </section>
            )}

            <div className="google-two-col-layout">
              <section className="google-card file-panel-card">
                <div className="card-header">
                  <div>
                    <span className="eyebrow">LOCAL REPOSITORY</span>
                    <h3>Documents</h3>
                  </div>
                  <span className="badge-pill">{documents.length} files</span>
                </div>
                <div className="file-list-view">
                  {documents.map((document) => (
                    <button
                      key={document.id}
                      className={`file-row-btn ${selected?.id === document.id ? "selected" : ""}`}
                      onClick={() => { setSelectedId(document.id); setResult(null); }}
                    >
                      <div className="file-icon-badge">TXT</div>
                      <div className="file-meta">
                        <b>{document.name}</b>
                        <small>{document.processed ? `Indexed · ${document.selected_tier}` : "Not processed"}</small>
                      </div>
                      <em className={badgeClass(document.sensitivity)}>{document.sensitivity}</em>
                    </button>
                  ))}
                </div>
                <div className="card-footer-action">
                  <label className="google-pill-btn primary full">
                    ＋ Add Text File
                    <input type="file" accept=".txt,text/plain" onChange={upload} style={{ display: "none" }} />
                  </label>
                </div>
              </section>

              <section className="google-card inspector-card">
                {selected ? (
                  <>
                    <div className="card-header">
                      <div>
                        <span className="eyebrow">PRIVACY INSPECTION</span>
                        <h3>{selected.name}</h3>
                      </div>
                      <em className={badgeClass(selected.sensitivity)}>{selected.classification.display_name}</em>
                    </div>
                    <div className="privacy-explanation-box">
                      <div className="expl-header">
                        <span className="shield-icon">🛡️</span>
                        <b>Classification Reason</b>
                      </div>
                      <p>{selected.classification.reasons.join(" ")}</p>
                      <div className="allowed-strip">
                        <span>Allowed:</span>
                        <b>{selected.classification.allowed_destinations.join(" · ")}</b>
                      </div>
                    </div>

                    <div className="optimizer-controls">
                      <div className="slider-row">
                        <div className="slider-label">
                          <span>Optimization Goal</span>
                          <b>{latencyWeight}% Latency · {100 - latencyWeight}% Energy</b>
                        </div>
                        <input type="range" min="0" max="100" value={latencyWeight} onChange={(e) => setLatencyWeight(Number(e.target.value))} />
                      </div>
                      <div className="select-row">
                        <span>Resource Scenario</span>
                        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                          <option value="live">Live Worker State</option>
                          <option value="client_busy">Simulated: Client Busy</option>
                          <option value="edge_busy">Simulated: Edge Busy</option>
                          <option value="client_and_edge_busy">Simulated: Client + Edge Busy</option>
                        </select>
                      </div>
                      <div className="select-row">
                        <span>Processing Demand</span>
                        <select value={workload} onChange={(e) => setWorkload(e.target.value)}>
                          <option value="actual">Actual Document</option>
                          <option value="demo_medium">Simulated Medium · 32 Passages</option>
                          <option value="demo_heavy">Simulated Heavy · 128 Passages</option>
                        </select>
                      </div>
                      <div className="select-row">
                        <span>Deadline (Optional)</span>
                        <input className="text-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Milliseconds" />
                      </div>
                    </div>

                    {(scenario !== "live" || workload !== "actual") && (
                      <div className="simulation-pill-note">
                        Simulation controls are active and will be recorded with the task receipt.
                      </div>
                    )}

                    <div className="inspector-actions">
                      <button className="google-pill-btn primary full" disabled={busy} onClick={process}>
                        {busy ? "Evaluating and processing…" : "Prepare for Smart Search →"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">Select a document</div>
                )}
              </section>
            </div>

            {result && (
              <section className="google-card decision-section">
                <div className="card-header">
                  <div>
                    <span className="eyebrow">WHY HERE?</span>
                    <h3>{result.decision.selected_tier ? `${result.decision.selected_tier.toUpperCase()} Selected` : "Task Deferred"}</h3>
                    <p className="subtext">{result.decision.explanation}</p>
                  </div>
                  {result.actual_latency_ms != null && (
                    <div className="actual-metric-pill">
                      <span>Measured End-to-End</span>
                      <b>{fmtMs(result.actual_latency_ms)}</b>
                    </div>
                  )}
                </div>
                <div className="tier-cards-grid">
                  {result.decision.candidates.map((candidate) => (
                    <article key={candidate.tier} className={`candidate-tier-card ${candidate.selected ? "selected" : candidate.privacy_allowed ? "" : "blocked"}`}>
                      <div className="tier-card-head">
                        <div className="tier-brand">
                          <span className="tier-icon">{candidate.tier === "local" ? "▣" : candidate.tier === "edge" ? "◇" : "☁"}</span>
                          <strong>{candidate.tier.toUpperCase()}</strong>
                        </div>
                        {candidate.selected && <span className="winner-tag">Selected</span>}
                      </div>
                      <dl className="tier-stats">
                        <div>
                          <dt>Privacy</dt>
                          <dd className={candidate.privacy_allowed ? "allowed" : "denied"}>{candidate.privacy_allowed ? "Allowed" : "Blocked"}</dd>
                        </div>
                        <div>
                          <dt>Availability</dt>
                          <dd>{candidate.available ? "Ready" : "Unavailable"}</dd>
                        </div>
                        <div>
                          <dt>Predicted Latency</dt>
                          <dd>{fmtMs(candidate.predicted_latency_ms)}</dd>
                        </div>
                        <div>
                          <dt>Estimated Energy</dt>
                          <dd>{fmtEnergy(candidate.estimated_device_energy_j)}</dd>
                        </div>
                      </dl>
                      <p className="candidate-reason">{candidate.reason}</p>
                    </article>
                  ))}
                </div>
                {result.receipt && (
                  <div className="receipt-bar">
                    <span>Verified Execution Receipt</span>
                    <code>{String(result.receipt.receipt_id).slice(0, 8)} · {String(result.receipt.worker_id)} · {String(result.receipt.processing_ms)} ms · {result.passage_count} passage(s)</code>
                  </div>
                )}
              </section>
            )}

            <section className="google-card history-card">
              <div className="card-header">
                <div>
                  <span className="eyebrow">AUDIT TRAIL</span>
                  <h3>Recent Decisions</h3>
                </div>
              </div>
              <div className="history-table">
                {history.slice(0, 6).map((item) => (
                  <div className="history-row" key={item.id}>
                    <span className={badgeClass(item.sensitivity)}>{item.sensitivity}</span>
                    <b>{item.selected_tier || "deferred"}</b>
                    <span className="scenario-tag">{item.scenario}</span>
                    <span className="latency-val">{fmtMs(item.actual_latency_ms)}</span>
                  </div>
                ))}
                {history.length === 0 && <p className="empty-subtext">No tasks processed yet.</p>}
              </div>
            </section>
          </div>
        ) : (
          <ExperimentView data={experiments} mode={experimentMode} />
        )}
      </main>
    </div>
  );
}

function ExperimentView({ data, mode }: { data: any[]; mode: string }) {
  const maxLatency = Math.max(...data.map((item) => item.average_predicted_latency_ms || 0), 1);
  return (
    <div className="experiment-layout">
      <section className="google-hero-banner">
        <div className="hero-content">
          <span className="google-chip">{mode}</span>
          <h2>Privacy Has a Measurable Cost — and a Clear Benefit</h2>
          <p>Compare the proposed scheduler with baselines across the same locally classified documents.</p>
        </div>
        <div className="zero-violations-badge">
          <strong>{data.find((item) => item.method === "privacy_aware")?.policy_violations ?? 0}</strong>
          <span>Policy Violations<br />with Proposed Method</span>
        </div>
      </section>

      <section className="google-card chart-card">
        <div className="card-header">
          <div>
            <span className="eyebrow">BASELINE BENCHMARK</span>
            <h3>Predicted Response Time</h3>
          </div>
          <small className="subtext">Lower is better · Simulated</small>
        </div>
        <div className="bar-chart-container">
          {data.map((item) => (
            <div className="bar-row" key={item.method}>
              <b className="method-label">{item.method.replaceAll("_", " ")}</b>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${((item.average_predicted_latency_ms || 0) / maxLatency) * 100}%` }} />
              </div>
              <span className="latency-metric">{fmtMs(item.average_predicted_latency_ms)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="metric-cards-grid">
        {data.map((item) => (
          <article className="metric-box-card" key={item.method}>
            <span className="box-title">{item.method.replaceAll("_", " ")}</span>
            <b className="box-violations">{item.policy_violations}</b>
            <p className="box-sub">policy violations across {item.tasks} tasks</p>
            <small className="box-energy">{item.average_estimated_device_energy_j?.toFixed(3) ?? "—"} J estimated device energy</small>
          </article>
        ))}
      </div>

      <section className="google-card note-card">
        <b>Empirical Conclusion</b>
        <p>The proposed method filters destinations using privacy and availability before optimizing estimated latency and device energy. Policy compliance and classifier accuracy are evaluated separately.</p>
      </section>
    </div>
  );
}

export default App;
