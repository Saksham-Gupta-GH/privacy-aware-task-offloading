import { useEffect, useState } from "react";
import { BrowserWorkspace } from "./browser/BrowserWorkspace";
import { IconBrandLogo, IconGitHub } from "./components/Icons";

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
  const [activePage, setActivePage] = useState<"files" | "search">("files");
  const [menuOpen, setMenuOpen] = useState(false);
  const [workers, setWorkers] = useState<Record<string, Worker>>({
    local: { tier: "local", available: true, ready: true, queue_depth: 0, detail: "Browser ready" },
    edge: { tier: "edge", available: false, ready: false, queue_depth: 0, detail: "Edge worker offline" },
    cloud: { tier: "cloud", available: false, ready: false, queue_depth: 0, detail: "Cloud gateway ready" },
  });

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
      {/* MoveInSync-Style Clean Header */}
      <header className="moveinsync-header">
        <div className="header-inner">
          <button
            className="nav-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
          <div className="brand-group">
            <IconBrandLogo size={32} />
            <div className="brand-titles">
              <strong className="brand-title-main">PrivacyDrive</strong>
              <span className="brand-title-sub">MEC Cloud Offloading</span>
            </div>
          </div>

          <div className="header-right-group">
            <a
              href="https://github.com/Saksham-Gupta-GH/privacy-aware-task-offloading"
              target="_blank"
              rel="noreferrer"
              className="github-header-btn"
            >
              <IconGitHub size={14} />
              <span>GitHub</span>
            </a>

            <div className="user-avatar-circle" title="Saksham Gupta · Administrator">
              S
            </div>
          </div>
        </div>
        {menuOpen && (
          <nav className="app-menu" aria-label="Main navigation">
            <button className={activePage === "files" ? "active" : ""} onClick={() => { setActivePage("files"); setMenuOpen(false); }}>Files</button>
            <button className={activePage === "search" ? "active" : ""} onClick={() => { setActivePage("search"); setMenuOpen(false); }}>Smart Search</button>
          </nav>
        )}
      </header>

      <main className="moveinsync-main">
        <BrowserWorkspace workers={workers} page={activePage} onOpenFile={() => setActivePage("files")} />
      </main>
    </div>
  );
}

export default App;
