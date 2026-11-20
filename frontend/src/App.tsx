import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type RankingEntry, type Statistics, type User } from "./api";
import AuthPage from "./AuthPage";
import { Alert, Field, Icon, Modal, Spinner } from "./ui";
import "./App.css";

const PASS_MARK = 40;

type StudentDraft = { name: string; marks: string };
type DraftErrors = { name?: string; marks?: string };
type EditTarget = { name: string; marks: number } | null;

function validateStudent(
  draft: StudentDraft,
  existingNames: string[],
  original: EditTarget,
): DraftErrors {
  const errors: DraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Name is required";
  else if (name.length > 100) errors.name = "Name must be 100 characters or fewer";
  else if (name !== original?.name && existingNames.includes(name)) {
    errors.name = "A student with this name already exists";
  }

  const raw = draft.marks.trim();
  const marks = Number(raw);
  if (raw === "") errors.marks = "Marks are required";
  else if (!Number.isFinite(marks)) errors.marks = "Marks must be a number";
  else if (!Number.isInteger(marks)) errors.marks = "Marks must be a whole number";
  else if (marks < 0 || marks > 100) errors.marks = "Marks must be between 0 and 100";
  return errors;
}

function gradeTone(grade: string) {
  if (grade === "A+" || grade === "A") return "success";
  if (grade === "B" || grade === "C") return "info";
  if (grade === "D" || grade === "E") return "warning";
  return "danger";
}

/* ---------- Add / edit modal ---------- */

type StudentModalProps = {
  target: EditTarget;
  existingNames: string[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
};

function StudentModal({ target, existingNames, onClose, onSaved }: StudentModalProps) {
  const isEdit = target !== null;
  const [draft, setDraft] = useState<StudentDraft>({
    name: target?.name ?? "",
    marks: target ? String(target.marks) : "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = validateStudent(draft, existingNames, target);
  const show = (f: keyof DraftErrors) => (submitted || touched[f] ? errors[f] : undefined);
  const name = draft.name.trim();
  const marks = Number(draft.marks);
  const unchanged = isEdit && name === target.name && marks === target.marks;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0 || unchanged) return;

    setBusy(true);
    try {
      if (!isEdit) {
        await api.addStudent(name, marks);
        await onSaved(`${name} was added`);
      } else {
        if (name !== target.name) await api.updateName(target.name, name);
        if (marks !== target.marks) await api.updateMarks(name, target.marks, marks);
        await onSaved(`${name} was updated`);
      }
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not save the student");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Edit student" : "Add student"}
      description={isEdit ? "Update the name or marks." : "Enter the student's name and marks out of 100."}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {serverError && <Alert>{serverError}</Alert>}
          <Field
            label="Full name"
            placeholder="e.g. Ayesha Khan"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            error={show("name")}
            maxLength={100}
            autoComplete="off"
            disabled={busy}
            required
          />
          <Field
            label="Marks"
            type="number"
            inputMode="numeric"
            placeholder="0 – 100"
            value={draft.marks}
            onChange={(e) => setDraft({ ...draft, marks: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, marks: true }))}
            error={show("marks")}
            hint={`Pass mark is ${PASS_MARK}.`}
            min={0}
            max={100}
            step={1}
            disabled={busy}
            required
          />
          {submitted && unchanged && Object.keys(errors).length === 0 && (
            <p className="field-hint">No changes to save.</p>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />}
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add student"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

/* ---------- Delete modal ---------- */

function DeleteModal({
  name,
  onClose,
  onDeleted,
}: {
  name: string;
  onClose: () => void;
  onDeleted: (message: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setServerError(null);
    try {
      await api.deleteStudent(name);
      await onDeleted(`${name} was deleted`);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not delete the student");
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete student?" onClose={onClose} busy={busy}>
      <div className="modal-body">
        {serverError && <Alert>{serverError}</Alert>}
        <p className="modal-text">
          <strong>{name}</strong> and their marks will be permanently removed. This can't be undone.
        </p>
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Deleting…" : "Delete"}
        </button>
      </footer>
    </Modal>
  );
}

/* ---------- App ---------- */

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [students, setStudents] = useState<RankingEntry[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    { kind: "add" } | { kind: "edit"; student: RankingEntry } | { kind: "delete"; name: string } | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ranking, stats] = await Promise.all([api.getRanking(), api.getStatistics()]);
      setStudents(ranking);
      setStatistics(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, []);

  const resetSession = useCallback(() => {
    setUser(null);
    setStudents([]);
    setStatistics(null);
    setQuery("");
    setModal(null);
  }, []);

  useEffect(() => {
    let active = true;
    api.getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        if (currentUser) void loadData();
      })
      .catch(() => undefined)
      .finally(() => active && setAuthLoading(false));
    window.addEventListener("auth-expired", resetSession);
    return () => {
      active = false;
      window.removeEventListener("auth-expired", resetSession);
    };
  }, [loadData, resetSession]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleSaved(message: string) {
    await loadData();
    setToast(message);
  }

  async function handleLogout() {
    try {
      await api.logout();
      resetSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
  }, [students, query]);

  if (authLoading) {
    return (
      <div className="page-center">
        <Spinner /> <span>Loading…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuthenticated={(u) => {
          setUser(u);
          void loadData();
        }}
      />
    );
  }

  const total = statistics?.total_students ?? 0;
  const passRate = total ? Math.round(((statistics?.passed_students ?? 0) / total) * 100) : 0;

  const stats = [
    { label: "Total students", value: total, icon: <Icon.Users />, tone: "accent" },
    { label: "Average marks", value: total ? (statistics?.average_marks ?? 0).toFixed(1) : "–", icon: <Icon.Chart />, tone: "info" },
    { label: "Pass rate", value: total ? `${passRate}%` : "–", sub: total ? `${statistics?.passed_students} passed · ${statistics?.failed_students} failed` : undefined, icon: <Icon.Badge />, tone: "success" },
    { label: "Top score", value: statistics?.highest_marks ?? "–", icon: <Icon.Trophy />, tone: "warning" },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark"><Icon.Logo /></span>
            Student Manager
          </div>
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">{user.email[0].toUpperCase()}</span>
            <span className="topbar-email">{user.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <Icon.Logout /> <span className="hide-sm">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="page-head">
          <div>
            <h1>Students</h1>
            <p>Manage your class results, grades and rankings.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({ kind: "add" })}>
            <Icon.Plus /> Add student
          </button>
        </div>

        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

        <section className="stats" aria-label="Class statistics">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <span className={`stat-icon tone-${s.tone}`}>{s.icon}</span>
              <div>
                <p className="stat-label">{s.label}</p>
                <p className="stat-value">{s.value}</p>
                {s.sub && <p className="stat-sub">{s.sub}</p>}
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-toolbar">
            <div className="search">
              <Icon.Search />
              <input
                type="search"
                placeholder="Search by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search students by name"
              />
              {query && (
                <button className="icon-button" onClick={() => setQuery("")} aria-label="Clear search">
                  <Icon.X size={14} />
                </button>
              )}
            </div>
            <span className="muted">
              {query ? `${filtered.length} of ${students.length}` : `${students.length}`} student
              {students.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="empty"><Spinner /> Loading students…</div>
          ) : students.length === 0 ? (
            <div className="empty">
              <span className="empty-icon"><Icon.Users size={22} /></span>
              <h3>No students yet</h3>
              <p>Add your first student to see grades, ranking and statistics.</p>
              <button className="btn btn-primary" onClick={() => setModal({ kind: "add" })}>
                <Icon.Plus /> Add student
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <h3>No matches</h3>
              <p>No student name contains “{query.trim()}”.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="col-rank">#</th>
                    <th scope="col">Name</th>
                    <th scope="col">Marks</th>
                    <th scope="col">Grade</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="col-actions"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const passed = s.marks >= PASS_MARK;
                    return (
                      <tr key={s.name}>
                        <td className="col-rank">{s.rank}</td>
                        <td className="cell-name">{s.name}</td>
                        <td>
                          <div className="marks">
                            <span className="marks-value">{s.marks}</span>
                            <span className="marks-bar" aria-hidden="true">
                              <span className={passed ? "pass" : "fail"} style={{ width: `${s.marks}%` }} />
                            </span>
                          </div>
                        </td>
                        <td><span className={`badge tone-${gradeTone(s.grade)}`}>{s.grade}</span></td>
                        <td>
                          <span className={`status ${passed ? "status-pass" : "status-fail"}`}>
                            {passed ? "Passed" : "Failed"}
                          </span>
                        </td>
                        <td className="col-actions">
                          <button
                            className="icon-button"
                            onClick={() => setModal({ kind: "edit", student: s })}
                            aria-label={`Edit ${s.name}`}
                            title="Edit"
                          >
                            <Icon.Edit />
                          </button>
                          <button
                            className="icon-button icon-danger"
                            onClick={() => setModal({ kind: "delete", name: s.name })}
                            aria-label={`Delete ${s.name}`}
                            title="Delete"
                          >
                            <Icon.Trash />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {(modal?.kind === "add" || modal?.kind === "edit") && (
        <StudentModal
          target={modal.kind === "edit" ? { name: modal.student.name, marks: modal.student.marks } : null}
          existingNames={students.map((s) => s.name)}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.kind === "delete" && (
        <DeleteModal name={modal.name} onClose={() => setModal(null)} onDeleted={handleSaved} />
      )}

      {toast && (
        <div className="toast" role="status">
          <Icon.Check /> {toast}
        </div>
      )}
    </div>
  );
}

export default App;
