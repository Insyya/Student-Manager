import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type RankingEntry,
  type Statistics,
  type SearchResult,
  type Student,
  type User,
} from "./api";
import AuthPage from "./AuthPage";
import "./App.css";

type FormErrors = { name?: string; marks?: string };

type EditForm = { name: string; marks: number; originalName: string; originalMarks: number };

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [students, setStudents] = useState<RankingEntry[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Add student modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addMarks, setAddMarks] = useState("");
  const [addErrors, setAddErrors] = useState<FormErrors>({});
  const [addLoading, setAddLoading] = useState(false);

  // Edit student modal
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Focus management for modals
  const addModalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async (activeSearch: string | null = null) => {
    setLoading(true);
    setError(null);
    try {
      const [rankingData, statsData, searchData] = await Promise.all([
        api.getRanking(),
        api.getStatistics(),
        activeSearch ? api.searchStudents(activeSearch) : Promise.resolve(null),
      ]);
      setStudents(rankingData);
      setStatistics(statsData);
      setSearchResults(searchData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore the signed-in user before requesting private student data.
  useEffect(() => {
    let active = true;
    api.getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        if (currentUser) void loadData();
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not restore session");
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    const handleExpiredSession = () => {
      setUser(null);
      setStudents([]);
      setStatistics(null);
      setSearchResults(null);
    };
    window.addEventListener("auth-expired", handleExpiredSession);
    return () => {
      active = false;
      window.removeEventListener("auth-expired", handleExpiredSession);
    };
  }, [loadData]);

  async function handleLogout() {
    setError(null);
    try {
      await api.logout();
      setUser(null);
      setStudents([]);
      setStatistics(null);
      setSearchResults(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out");
    }
  }

  // Search handler
  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await api.searchStudents(query);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
  }

  // Add student validation
  function validateAddForm(): boolean {
    const errors: FormErrors = {};
    const name = addName.trim();
    const marks = Number(addMarks);

    if (!name) errors.name = "Name is required";
    else if (name.length > 100) errors.name = "Name is too long (max 100 characters)";

    if (addMarks === "") errors.marks = "Marks are required";
    else if (Number.isNaN(marks)) errors.marks = "Marks must be a number";
    else if (!Number.isInteger(marks)) errors.marks = "Marks must be a whole number";
    else if (marks < 0 || marks > 100) errors.marks = "Marks must be between 0 and 100";

    setAddErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAddStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateAddForm()) return;

    setAddLoading(true);
    setError(null);
    try {
      await api.addStudent(addName.trim(), Number(addMarks));
      setShowAddModal(false);
      setAddName("");
      setAddMarks("");
      await loadData(searchResults === null ? null : searchQuery.trim() || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setAddLoading(false);
    }
  }

  // Edit student
  function openEditModal(student: Pick<Student, "name" | "marks">) {
    setEditForm({
      name: student.name,
      marks: student.marks,
      originalName: student.name,
      originalMarks: student.marks,
    });
    setEditErrors({});
  }

  function closeEditModal() {
    setEditForm(null);
    setEditErrors({});
  }

  function validateEditForm(): boolean {
    if (!editForm) return false;
    const errors: FormErrors = {};
    const name = editForm.name.trim();
    const marks = editForm.marks;

    if (!name) errors.name = "Name is required";
    else if (name.length > 100) errors.name = "Name is too long (max 100 characters)";

    if (!Number.isInteger(marks)) errors.marks = "Marks must be a whole number";
    else if (marks < 0 || marks > 100) errors.marks = "Marks must be between 0 and 100";
    else if (marks === editForm.originalMarks && name === editForm.originalName) {
      errors.marks = "No changes detected";
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEditStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editForm || !validateEditForm()) return;

    setEditLoading(true);
    setError(null);
    try {
      const newName = editForm.name.trim();
      const nameChanged = newName !== editForm.originalName;
      const marksChanged = editForm.marks !== editForm.originalMarks;

      if (nameChanged) {
        await api.updateName(editForm.originalName, newName);
      }
      if (marksChanged) {
        await api.updateMarks(
          nameChanged ? newName : editForm.originalName,
          editForm.originalMarks,
          editForm.marks,
        );
      }
      closeEditModal();
      await loadData(searchResults === null ? null : searchQuery.trim() || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update student");
    } finally {
      setEditLoading(false);
    }
  }

  // Delete student
  function openDeleteConfirm(name: string) {
    setDeleteConfirm(name);
  }

  function closeDeleteConfirm() {
    setDeleteConfirm(null);
  }

  async function handleDeleteStudent() {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await api.deleteStudent(deleteConfirm);
      closeDeleteConfirm();
      await loadData(searchResults === null ? null : searchQuery.trim() || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete student");
    } finally {
      setDeleteLoading(false);
    }
  }

  // Trap focus in modal
  function trapFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Tab") {
      const modal = e.currentTarget;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === "Escape") {
      setShowAddModal(false);
      closeEditModal();
      closeDeleteConfirm();
    }
  }

  const rankingByName = new Map(students.map(({ name, rank }) => [name, rank]));
  const displayedStudents: Array<SearchResult & { rank?: number }> = searchResults
    ? searchResults.map((student) => ({
        ...student,
        rank: rankingByName.get(student.name),
      }))
    : students;

  if (authLoading) {
    return (
      <main className="auth-page">
        <p className="loading" role="status">Checking your session...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthPage onAuthenticated={(authenticatedUser) => {
      setUser(authenticatedUser);
      void loadData();
    }} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Student Manager</h1>
          <p>Manage student results easily</p>
        </div>
        <div className="header-actions">
          <span className="signed-in-user">{user.email}</span>
          <button className="secondary-button" onClick={handleLogout}>Sign out</button>
          <button
            className="add-button"
            onClick={() => setShowAddModal(true)}
            aria-label="Add new student"
          >
            + Add Student
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
        </div>
      )}

      <main className="main">
        {/* Statistics */}
        <section className="stats" aria-label="Statistics">
          <div className="stat-card">
            <span>Total Students</span>
            <strong>{statistics?.total_students ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Average Marks</span>
            <strong>{(statistics?.average_marks ?? 0).toFixed(2)}</strong>
          </div>
          <div className="stat-card">
            <span>Passed</span>
            <strong>{statistics?.passed_students ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Failed</span>
            <strong>{statistics?.failed_students ?? 0}</strong>
          </div>
        </section>

        {/* Students */}
        <section className="students-section">
          <div className="section-header">
            <div>
              <h2>Students</h2>
              <p>All registered students and their results</p>
            </div>
            <div className="search-group">
              <input
                className="search-input"
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                aria-label="Search students by name"
                disabled={searchLoading}
              />
              <button
                className="search-button"
                onClick={handleSearch}
                disabled={searchLoading}
                aria-label={searchLoading ? "Searching..." : "Search"}
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
              {searchQuery && (
                <button
                  className="clear-button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loading" aria-live="polite">
              <span className="spinner" aria-hidden="true"></span>
              Loading students...
            </div>
          ) : displayedStudents.length === 0 ? (
            <div className="empty">
              {searchQuery ? "No matching students found." : "No students found. Click \"Add Student\" to get started."}
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Name</th>
                    <th scope="col">Marks</th>
                    <th scope="col">Grade</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.map((student) => {
                    const passed = student.marks >= 40;
                    return (
                      <tr key={student.name}>
                        <td>{student.rank ?? "—"}</td>
                        <td className="student-name">{student.name}</td>
                        <td>{student.marks}</td>
                        <td>
                          <span className="grade">{student.grade}</span>
                        </td>
                        <td>
                          <span className={passed ? "passed" : "failed"}>
                            {passed ? "Passed" : "Failed"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="action-button"
                            onClick={() => openEditModal(student)}
                            aria-label={`Edit ${student.name}`}
                          >
                            Edit
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => openDeleteConfirm(student.name)}
                            aria-label={`Delete ${student.name}`}
                          >
                            Delete
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

      {/* Add Student Modal */}
      {showAddModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAddModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-modal-title"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapFocus}
            ref={addModalRef}
          >
            <header className="modal-header">
              <h2 id="add-modal-title">Add Student</h2>
              <button
                className="modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <form onSubmit={handleAddStudent} noValidate>
              <div className="form-group">
                <label htmlFor="add-name">Name <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="add-name"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onBlur={() => validateAddForm()}
                  placeholder="Enter student name"
                  maxLength={100}
                  autoFocus
                  disabled={addLoading}
                  aria-invalid={!!addErrors.name}
                  aria-describedby={addErrors.name ? "add-name-error" : undefined}
                />
                {addErrors.name && (
                  <span id="add-name-error" className="error-text" role="alert">
                    {addErrors.name}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="add-marks">Marks <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="add-marks"
                  type="number"
                  value={addMarks}
                  onChange={(e) => setAddMarks(e.target.value)}
                  onBlur={() => validateAddForm()}
                  placeholder="Enter marks (0-100)"
                  min={0}
                  max={100}
                  step={1}
                  disabled={addLoading}
                  aria-invalid={!!addErrors.marks}
                  aria-describedby={addErrors.marks ? "add-marks-error" : undefined}
                />
                {addErrors.marks && (
                  <span id="add-marks-error" className="error-text" role="alert">
                    {addErrors.marks}
                  </span>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={addLoading}
                >
                  {addLoading ? "Adding..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editForm && (
        <div
          className="modal-overlay"
          onClick={closeEditModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapFocus}
            ref={editModalRef}
          >
            <header className="modal-header">
              <h2 id="edit-modal-title">Edit Student</h2>
              <button
                className="modal-close"
                onClick={closeEditModal}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <form onSubmit={handleEditStudent} noValidate>
              <div className="form-group">
                <label htmlFor="edit-name">Name <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="edit-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  onBlur={() => validateEditForm()}
                  placeholder="Enter student name"
                  maxLength={100}
                  autoFocus
                  disabled={editLoading}
                  aria-invalid={!!editErrors.name}
                  aria-describedby={editErrors.name ? "edit-name-error" : undefined}
                />
                {editErrors.name && (
                  <span id="edit-name-error" className="error-text" role="alert">
                    {editErrors.name}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="edit-marks">Marks <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="edit-marks"
                  type="number"
                  value={editForm.marks}
                  onChange={(e) => setEditForm({ ...editForm, marks: Number(e.target.value) || 0 })}
                  onBlur={() => validateEditForm()}
                  placeholder="Enter marks (0-100)"
                  min={0}
                  max={100}
                  step={1}
                  disabled={editLoading}
                  aria-invalid={!!editErrors.marks}
                  aria-describedby={editErrors.marks ? "edit-marks-error" : undefined}
                />
                {editErrors.marks && (
                  <span id="edit-marks-error" className="error-text" role="alert">
                    {editErrors.marks}
                  </span>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeEditModal}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={editLoading}
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={closeDeleteConfirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="modal modal-danger"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapFocus}
            ref={deleteModalRef}
          >
            <header className="modal-header">
              <h2 id="delete-modal-title">Delete Student</h2>
              <button
                className="modal-close"
                onClick={closeDeleteConfirm}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <p className="modal-message">
              Are you sure you want to delete <strong>{deleteConfirm}</strong>? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeDeleteConfirm}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleDeleteStudent}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
