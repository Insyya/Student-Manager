import { useState } from "react";
import { api, type User } from "./api";

type Props = {
  onAuthenticated: (user: User) => void;
};

function AuthPage({ onAuthenticated }: Props) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = isSignup
        ? await api.signup(email, password)
        : await api.login(email, password);
      onAuthenticated(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">{isSignup ? "Create your account" : "Sign in"}</h1>
        <p>
          {isSignup
            ? "Create a teacher account to start adding students."
            : "Sign in to manage your students."}
        </p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
            disabled={busy}
          />
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={10}
            maxLength={128}
            disabled={busy}
          />
          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
            className="auth-toggle"
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError(null);
            }}
            disabled={busy}
          >
            {isSignup ? "Already have an account? Sign in" : "Create a new account"}
          </button>
      </section>
    </main>
  );
}

export default AuthPage;
