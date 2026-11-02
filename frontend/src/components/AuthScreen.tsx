import { FormEvent, useState } from "react";
import { AuthSession, loginAccount, registerAccount } from "../auth";
import { IconBrandLogo } from "./Icons";

type AuthMode = "login" | "register";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = mode === "register"
        ? await registerAccount(name, email, password)
        : await loginAccount(email, password);
      onAuthenticated(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <IconBrandLogo size={40} />
          <div><strong>PrivacyDrive</strong><span>Privacy-aware task offloading</span></div>
        </div>
        <div className="auth-message">
          <span className="auth-kicker">PRIVATE BY DESIGN</span>
          <h1>Your files choose the safest path.</h1>
          <p>Process sensitive documents on your device, use a trusted edge when permitted, and send only public work to the cloud.</p>
        </div>
        <div className="privacy-route" aria-label="Privacy routing overview">
          <div><span>Restricted</span><strong>Device</strong></div>
          <div><span>Personal</span><strong>Device · Edge</strong></div>
          <div><span>Public</span><strong>Device · Edge · Cloud</strong></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand"><IconBrandLogo size={34} /><strong>PrivacyDrive</strong></div>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Sign in</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Create account</button>
          </div>

          <div className="auth-card-heading">
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>{mode === "login" ? "Sign in to open your private workspace." : "Your documents stay in this browser."}</p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <label>
                <span>Name</span>
                <input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
              </label>
            )}
            <label>
              <span>Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label>
              <span>Password</span>
              <div className="password-field">
                <input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button>
              </div>
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" disabled={busy} type="submit">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-note">Account data is stored securely. Document content remains on your device.</p>
        </div>
      </section>
    </main>
  );
}

