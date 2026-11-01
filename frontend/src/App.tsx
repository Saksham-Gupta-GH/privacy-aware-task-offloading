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

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
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
  const [workers, setWorkers] = useState<Record<string, Worker>>({});
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
    const [docs, status, taskHistory] = await Promise.all([
      api<DocumentItem[]>("/api/documents"),
      api<any>("/api/status"),
      api<any[]>("/api/history"),
    ]);
    setDocuments(docs);
    setWorkers(status.workers);
    setHistory(taskHistory);
    if (!selectedId && docs.length) setSelectedId(docs[0].id);
  };

  useEffect(() => { refresh().catch((value) => setError(value.message)); }, []);

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
      const value = await api<any>("/api/experiments");
      setExperiments(value.results);
      setExperimentMode(value.mode);
    }
    catch (value) { setError((value as Error).message); }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><div><strong>PrivacyDrive</strong><span>Edge-aware workspace</span></div></div>
        <nav>
          <button className={tab === "browser" ? "active" : ""} onClick={() => setTab("browser")}><span>◉</span> Private workspace</button>
          <button className={tab === "workspace" ? "active" : ""} onClick={() => setTab("workspace")}><span>▦</span> Distributed demo</button>
          <button className={tab === "experiments" ? "active" : ""} onClick={openExperiments}><span>⌁</span> Experiments</button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="policy-card">
          <span className="eyebrow">Active policy</span>
          <strong>privacy-policy-v1</strong>
          <p>Classification happens locally before transmission.</p>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="eyebrow">MOBILE EDGE COMPUTING</span><h1>{tab === "browser" ? "Private document workspace" : tab === "workspace" ? "Distributed offloading demo" : "Research evidence"}</h1></div>
          <div className="worker-strip">
            {["local", "edge", "cloud"].map((tier) => {
              const worker = workers[tier]; const online = worker?.available && worker?.ready;
              return <div className="mini-status" key={tier}><i className={online ? "online" : "offline"} /><span>{tier}</span><b>{online ? "Ready" : "Offline"}</b></div>;
            })}
          </div>
        </header>

        {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}

        {tab === "browser" ? <BrowserWorkspace workers={workers} /> : tab === "workspace" ? <>
          <section className="toolbar">
            <div className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search your processed documents by meaning…" /><button onClick={search}>Search locally</button></div>
            <label className="upload-button">＋ Add text file<input type="file" accept=".txt,text/plain" onChange={upload} /></label>
          </section>

          {searchResults.length > 0 && <section className="search-results panel"><div className="panel-title"><div><span className="eyebrow">LOCAL SEMANTIC SEARCH</span><h2>Best matches</h2></div><button className="quiet" onClick={() => setSearchResults([])}>Close</button></div><div className="result-grid">{searchResults.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setSearchResults([]); }}><b>{item.name}</b><span>{item.matching_passage}</span><em>{Math.round(item.score * 100)}% match</em></button>)}</div></section>}

          <div className="workspace-grid">
            <section className="panel file-panel">
              <div className="panel-title"><div><span className="eyebrow">LOCAL WORKSPACE</span><h2>Documents</h2></div><span className="count">{documents.length} files</span></div>
              <div className="file-head"><span>Name</span><span>Privacy</span><span>Status</span></div>
              <div className="file-list">{documents.map((document) => <button key={document.id} className={selected?.id === document.id ? "selected" : ""} onClick={() => { setSelectedId(document.id); setResult(null); }}><span className="file-name"><i>TXT</i><b>{document.name}</b></span><span><em className={badgeClass(document.sensitivity)}>{document.sensitivity}</em></span><span className="file-status">{document.processed ? `Indexed · ${document.selected_tier}` : "Not processed"}</span></button>)}</div>
            </section>

            <section className="panel inspector">
              {selected ? <>
                <div className="panel-title"><div><span className="eyebrow">PRIVACY INSPECTOR</span><h2>{selected.name}</h2></div><em className={badgeClass(selected.sensitivity)}>{selected.classification.display_name}</em></div>
                <div className="classification-box"><span>Classification reason</span><p>{selected.classification.reasons.join(" ")}</p><small>Allowed: {selected.classification.allowed_destinations.join(" · ")}</small></div>
                <div className="control-grid">
                  <label><span>Optimize for</span><b>{latencyWeight}% latency · {100 - latencyWeight}% energy</b><input type="range" min="0" max="100" value={latencyWeight} onChange={(e) => setLatencyWeight(Number(e.target.value))} /></label>
                  <label><span>Resource scenario</span><select value={scenario} onChange={(e) => setScenario(e.target.value)}><option value="live">Live worker state</option><option value="client_busy">Simulated: client busy</option><option value="edge_busy">Simulated: edge busy</option><option value="client_and_edge_busy">Simulated: client + edge busy</option></select></label>
                  <label><span>Processing demand</span><select value={workload} onChange={(e) => setWorkload(e.target.value)}><option value="actual">Actual document</option><option value="demo_medium">Simulated medium · 32 passages</option><option value="demo_heavy">Simulated heavy · 128 passages</option></select></label>
                  <label><span>Deadline (optional)</span><input className="text-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="milliseconds" /></label>
                </div>
                {(scenario !== "live" || workload !== "actual") && <div className="simulation-note">Simulation controls are active and will be recorded with the task.</div>}
                <button className="primary" disabled={busy} onClick={process}>{busy ? "Evaluating and processing…" : "Prepare for smart search"}<span>→</span></button>
              </> : <div className="empty">Select a document</div>}
            </section>
          </div>

          {result && <section className="panel decision-panel">
            <div className="panel-title"><div><span className="eyebrow">WHY HERE?</span><h2>{result.decision.selected_tier ? `${result.decision.selected_tier.toUpperCase()} selected` : "Task deferred"}</h2><p>{result.decision.explanation}</p></div>{result.actual_latency_ms != null && <div className="actual-metric"><span>Measured end-to-end</span><b>{fmtMs(result.actual_latency_ms)}</b></div>}</div>
            <div className="tier-grid">{result.decision.candidates.map((candidate) => <article className={candidate.selected ? "winner" : candidate.privacy_allowed ? "" : "blocked"} key={candidate.tier}><div className="tier-title"><span>{candidate.tier === "local" ? "▣" : candidate.tier === "edge" ? "◇" : "☁"}</span><b>{candidate.tier}</b>{candidate.selected && <em>Selected</em>}</div><dl><div><dt>Privacy</dt><dd>{candidate.privacy_allowed ? "Allowed" : "Blocked"}</dd></div><div><dt>Availability</dt><dd>{candidate.available ? "Ready" : "Unavailable"}</dd></div><div><dt>Predicted latency</dt><dd>{fmtMs(candidate.predicted_latency_ms)}</dd></div><div><dt>Estimated device energy</dt><dd>{fmtEnergy(candidate.estimated_device_energy_j)}</dd></div></dl><p>{candidate.reason}</p></article>)}</div>
            {result.receipt && <div className="receipt"><span>Verified execution receipt</span><code>{String(result.receipt.receipt_id).slice(0, 8)} · {String(result.receipt.worker_id)} · {String(result.receipt.processing_ms)} ms · {result.passage_count} passage(s)</code></div>}
          </section>}

          <section className="panel history-panel"><div className="panel-title"><div><span className="eyebrow">AUDIT TRAIL</span><h2>Recent decisions</h2></div></div><div className="history-list">{history.slice(0, 6).map((item) => <div key={item.id}><span className={badgeClass(item.sensitivity)}>{item.sensitivity}</span><b>{item.selected_tier || "deferred"}</b><span>{item.scenario}</span><span>{fmtMs(item.actual_latency_ms)}</span></div>)}{history.length === 0 && <p>No tasks processed yet.</p>}</div></section>
        </> : <ExperimentView data={experiments} mode={experimentMode} />}
      </main>
    </div>
  );
}

function ExperimentView({ data, mode }: { data: any[]; mode: string }) {
  const maxLatency = Math.max(...data.map((item) => item.average_predicted_latency_ms || 0), 1);
  return <div className="experiment-layout">
    <section className="research-hero"><div><span className="eyebrow">{mode}</span><h2>Privacy has a measurable cost—and a clear benefit.</h2><p>Compare the proposed scheduler with baselines across the same locally classified documents.</p></div><div className="zero-card"><strong>{data.find((item) => item.method === "privacy_aware")?.policy_violations ?? 0}</strong><span>policy violations<br />with proposed method</span></div></section>
    <section className="panel chart-panel"><div className="panel-title"><div><span className="eyebrow">BASELINE COMPARISON</span><h2>Predicted response time</h2></div><small>Lower is better · simulated</small></div><div className="bar-chart">{data.map((item) => <div className="bar-row" key={item.method}><b>{item.method.replaceAll("_", " ")}</b><div><i style={{ width: `${((item.average_predicted_latency_ms || 0) / maxLatency) * 100}%` }} /></div><span>{fmtMs(item.average_predicted_latency_ms)}</span></div>)}</div></section>
    <div className="metric-cards">{data.map((item) => <article key={item.method}><span>{item.method.replaceAll("_", " ")}</span><b>{item.policy_violations}</b><p>policy violations across {item.tasks} tasks</p><small>{item.average_estimated_device_energy_j?.toFixed(3) ?? "—"} J estimated device energy</small></article>)}</div>
    <section className="method-note"><b>What this proves</b><p>The proposed method filters destinations using privacy and availability before optimizing estimated latency and device energy. Policy compliance and classifier accuracy are measured separately.</p></section>
  </div>;
}

export default App;

