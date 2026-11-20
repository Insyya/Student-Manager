import { useState } from "react";
import { api, type User } from "./api";
import { Alert, Field, Icon, PasswordField, Spinner } from "./ui";

type Props = { onAuthenticated: (user: User) => void };
type Mode = "login" | "signup";
type Errors = { email?: string; password?: string; confirm?: string };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(mode: Mode, email: string, password: string, confirm: string): Errors {
  const errors: Errors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(trimmed)) errors.email = "Enter a valid email address";

  if (!password) errors.password = "Password is required";
  else if (mode === "signup" && password.length < 10) {
    errors.password = "Password must be at least 10 characters";
  } else if (password.length > 128) errors.password = "Password must be 128 characters or fewer";

  if (mode === "signup") {
    if (!confirm) errors.confirm = "Please confirm your password";
    else if (confirm !== password) errors.confirm = "Passwords do not match";
  }
  return errors;
}

function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const errors = validate(mode, email, password, confirm);
  const show = (field: keyof Errors) => (submitted || touched[field] ? errors[field] : undefined);
  const touch = (field: keyof Errors) => () => setTouched((t) => ({ ...t, [field]: true }));

  function switchMode() {
    setMode(isSignup ? "login" : "signup");
    setTouched({});
    setSubmitted(false);
    setServerError(null);
    setConfirm("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const response = isSignup
        ? await api.signup(email.trim(), password)
        : await api.login(email.trim(), password);
      onAuthenticated(response.user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <aside className="auth-brand">
        <div className="brand">
          <span className="brand-mark"><Icon.Logo /></span>
          Student Manager
        </div>
        <div className="auth-brand-body">
          <h2>Keep every student's result in one place.</h2>
          <ul>
            <li><Icon.Check /> Add, edit and remove students in seconds</li>
            <li><Icon.Check /> Automatic grades, ranking and pass rate</li>
            <li><Icon.Check /> Private to your account, saved securely</li>
          </ul>
        </div>
        <p className="auth-brand-foot">Built with React, Flask and PostgreSQL</p>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand brand-mobile">
            <span className="brand-mark"><Icon.Logo /></span>
            Student Manager
          </div>
          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-subtitle">
            {isSignup
              ? "Sign up as a teacher to start adding students."
              : "Sign in to manage your students."}
          </p>

          {serverError && <Alert onClose={() => setServerError(null)}>{serverError}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="teacher@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={touch("email")}
              error={show("email")}
              maxLength={254}
              disabled={busy}
              required
            />
            <PasswordField
              label="Password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 10 characters" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={touch("password")}
              error={show("password")}
              hint={isSignup ? "Use 10 or more characters." : undefined}
              maxLength={128}
              disabled={busy}
              required
            />
            {isSignup && (
              <PasswordField
                label="Confirm password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={touch("confirm")}
                error={show("confirm")}
                maxLength={128}
                disabled={busy}
                required
              />
            )}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy && <Spinner />}
              {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button type="button" className="link-button" onClick={switchMode} disabled={busy}>
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default AuthPage;
