import { useEffect, useState } from "react";
import { BrowserWorkspace } from "./browser/BrowserWorkspace";
import { IconLogo } from "./components/Icons";

type Worker = { tier: string; available: boolean; ready: boolean; queue_depth: number; detail: string };

const CONTROL_API = (import.meta.env.VITE_CONTROL_API ?? "").replace(/\/+$/, "");

const api = async <T,>(path: string, options?: RequestInit, base = ""): Promise<T> => {
  const url = base ? `${base}${path}` : path;
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json();
};

function App() {
  const [workers, setWorkers] = useState<Record<string, Worker>>({
    local: { tier: "local", available: true, ready: true, queue_depth: 0, detail: "Browser ready" },
    edge: { tier: "edge", available: false, ready: false, queue_depth: 0, detail: "Edge worker offline" },
    cloud: { tier: "cloud", available: false, ready: false, queue_depth: 0, detail: "Cloud gateway ready" },
  });
  const [error, setError] = useState("");

  const refreshWorkers = async () => {
    try {
      const status = await api<{ workers: Record<string, Worker> }>("/api/status", undefined, CONTROL_API);
      if (status?.workers) setWorkers(status.workers);
    } catch {
      // Fallback to default if control plane is warming up
    }
  };

  useEffect(() => {
    refreshWorkers().catch(() => undefined);
  }, []);

  return (
    <div className="google-app-shell">
      {/* Top Google-style Navigation Bar */}
      <header className="google-nav-header">
        <div className="nav-inner">
          <div className="brand-block">
            <span className="brand-logo-icon">
              <IconLogo size={20} />
            </span>
            <strong className="brand-name">PrivacyDrive</strong>
            <span className="brand-tag">MEC Research</span>
          </div>

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
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        <BrowserWorkspace workers={workers} />
      </main>
    </div>
  );
}

export default App;
