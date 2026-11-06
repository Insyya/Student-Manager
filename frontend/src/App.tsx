import { useEffect, useState } from "react";
import "./App.css";

type Student = {
  name: string;
  marks: number;
};

function getGrade(marks: number) {
  if (marks >= 90) return "A+";
  if (marks >= 80) return "A";
  if (marks >= 70) return "B";
  if (marks >= 60) return "C";
  if (marks >= 50) return "D";
  if (marks >= 40) return "E";
  return "Fail";
}

function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/students")
      .then((response) => response.json())
      .then((data) => {
        const studentList = Object.entries(data).map(
          ([name, marks]) => ({
            name,
            marks: Number(marks),
          })
        );

        setStudents(studentList);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching students:", error);
        setLoading(false);
      });
  }, []);

  const totalStudents = students.length;

  const averageMarks =
    totalStudents > 0
      ? students.reduce((total, student) => total + student.marks, 0) /
        totalStudents
      : 0;

  const passedStudents = students.filter(
    (student) => student.marks >= 40
  ).length;

  const failedStudents = totalStudents - passedStudents;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Student Manager</h1>
          <p>Manage student results easily</p>
        </div>

        <button className="add-button">+ Add Student</button>
      </header>

      <main className="main">
        {/* Statistics */}
        <section className="stats">
          <div className="stat-card">
            <span>Total Students</span>
            <strong>{totalStudents}</strong>
          </div>

          <div className="stat-card">
            <span>Average Marks</span>
            <strong>{averageMarks.toFixed(2)}</strong>
          </div>

          <div className="stat-card">
            <span>Passed</span>
            <strong>{passedStudents}</strong>
          </div>

          <div className="stat-card">
            <span>Failed</span>
            <strong>{failedStudents}</strong>
          </div>
        </section>

        {/* Students */}
        <section className="students-section">
          <div className="section-header">
            <div>
              <h2>Students</h2>
              <p>All registered students and their results</p>
            </div>

            <input
              className="search-input"
              type="text"
              placeholder="Search students..."
            />
          </div>

          {loading ? (
            <p className="loading">Loading students...</p>
          ) : students.length === 0 ? (
            <p className="empty">No students found.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Marks</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map((student) => {
                    const grade = getGrade(student.marks);
                    const passed = student.marks >= 40;

                    return (
                      <tr key={student.name}>
                        <td className="student-name">
                          {student.name}
                        </td>

                        <td>{student.marks}</td>

                        <td>
                          <span className="grade">
                            {grade}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              passed ? "passed" : "failed"
                            }
                          >
                            {passed ? "Passed" : "Failed"}
                          </span>
                        </td>

                        <td>
                          <button className="action-button">
                            Edit
                          </button>

                          <button className="delete-button">
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
    </div>
  );
}

export default App;