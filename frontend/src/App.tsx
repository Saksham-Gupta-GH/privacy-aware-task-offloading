import { useEffect, useState } from "react";
import { AuthSession, CONTROL_API, clearSession, loadSession, logoutAccount, saveSession, verifySession } from "./auth";
import { BrowserWorkspace } from "./browser/BrowserWorkspace";
import { AuthScreen } from "./components/AuthScreen";
import { IconBrandLogo, IconGitHub } from "./components/Icons";

type Worker = { tier: string; available: boolean; ready: boolean; queue_depth: number; detail: string };

const api = async <T,>(path: string, token: string, options?: RequestInit, base = ""): Promise<T> => {
  const url = base ? `${base}${path}` : path;
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json();
};

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [authReady, setAuthReady] = useState(false);
  const [activePage, setActivePage] = useState<"files" | "search">("files");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [workers, setWorkers] = useState<Record<string, Worker>>({
    local: { tier: "local", available: true, ready: true, queue_depth: 0, detail: "Browser ready" },
    edge: { tier: "edge", available: false, ready: false, queue_depth: 0, detail: "Edge worker offline" },
    cloud: { tier: "cloud", available: false, ready: false, queue_depth: 0, detail: "Cloud gateway ready" },
  });

  const refreshWorkers = async (token: string) => {
    try {
      const status = await api<{ workers: Record<string, Worker> }>("/api/status", token, undefined, CONTROL_API);
      if (status?.workers) setWorkers(status.workers);
    } catch {
      // Fallback to default if control plane is warming up
    }
  };

  useEffect(() => {
    const current = loadSession();
    if (!current) {
      setAuthReady(true);
      return;
    }
    verifySession(current)
      .then((verified) => { saveSession(verified); setSession(verified); })
      .catch(() => { clearSession(); setSession(null); })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (authReady && session) refreshWorkers(session.token).catch(() => undefined);
  }, [authReady, session]);

  const authenticated = (nextSession: AuthSession) => {
    saveSession(nextSession);
    setSession(nextSession);
    setAuthReady(true);
  };

  const logout = async () => {
    const token = session?.token;
    clearSession();
    setSession(null);
    setAccountOpen(false);
    setActivePage("files");
    if (token) await logoutAccount(token).catch(() => undefined);
  };

  if (!authReady) {
    return <div className="auth-loading"><IconBrandLogo size={42} /><span>PrivacyDrive</span></div>;
  }

  if (!session) return <AuthScreen onAuthenticated={authenticated} />;

  const initial = session.user.name.trim().charAt(0).toUpperCase() || "U";

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

            <div className="account-control">
              <button className="user-avatar-circle" aria-label="Open account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}>{initial}</button>
              {accountOpen && (
                <div className="account-menu">
                  <strong>{session.user.name}</strong>
                  <span>{session.user.email}</span>
                  <button onClick={logout}>Sign out</button>
                </div>
              )}
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
        <BrowserWorkspace
          workers={workers}
          page={activePage}
          token={session.token}
          userId={session.user.id}
          onOpenFile={() => setActivePage("files")}
        />
      </main>
    </div>
  );
}

export default App;
