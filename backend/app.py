import logging
import os
import re
import secrets
from datetime import timedelta
from functools import wraps

from flask import Flask, g, jsonify, request, session
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

from .database import (
    DatabaseConfigurationError,
    add_student_record,
    check_database_health,
    create_user,
    delete_student_record,
    get_all_students,
    get_student_record,
    get_user_by_email,
    rename_student_record,
    update_student_marks_record,
)

APP_ENV = os.getenv("APP_ENV", "development").lower()
SESSION_SECRET = os.getenv("SESSION_SECRET_KEY")
if APP_ENV == "production" and (
    not SESSION_SECRET
    or len(SESSION_SECRET) < 32
    or SESSION_SECRET.startswith("replace-with-")
):
    raise RuntimeError(
        "Set SESSION_SECRET_KEY to a private random value of at least 32 characters"
    )

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
app = Flask(__name__)
app.config.update(
    SECRET_KEY=SESSION_SECRET or secrets.token_hex(32),
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=(
        APP_ENV == "production"
        or os.getenv("SESSION_COOKIE_SECURE", "").lower() == "true"
    ),
    SESSION_COOKIE_SAMESITE=os.getenv("SESSION_COOKIE_SAMESITE", "Lax"),
)
if not SESSION_SECRET and APP_ENV != "production":
    app.logger.warning(
        "SESSION_SECRET_KEY is unset; sessions will expire when the API restarts"
    )

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
CORS(
    app,
    resources={r"/api/*": {"origins": allowed_origins}},
    supports_credentials=True,
    allow_headers=["Content-Type", "X-CSRF-Token"],
)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.before_request
def enforce_csrf():
    if (
        request.method != "OPTIONS"
        and request.path.startswith("/api/students")
        and not isinstance(session.get("user_id"), int)
    ):
        return jsonify({"error": "Authentication required"}), 401
    if request.path.startswith("/api/") and request.method not in SAFE_METHODS:
        expected = session.get("csrf_token")
        supplied = request.headers.get("X-CSRF-Token", "")
        if not expected or not secrets.compare_digest(expected, supplied):
            return jsonify({"error": "CSRF token is missing or invalid"}), 403
    return None


@app.after_request
def prevent_api_caching(response):
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user_id = session.get("user_id")
        if not isinstance(user_id, int):
            return jsonify({"error": "Authentication required"}), 401
        g.user_id = user_id
        return view(*args, **kwargs)

    return wrapped


@app.errorhandler(DatabaseConfigurationError)
def handle_database_configuration_error(error):
    app.logger.error("Database configuration error: %s", error)
    return jsonify({"error": str(error)}), 503


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    if isinstance(error, HTTPException):
        return error
    app.logger.exception("Unhandled API error")
    return jsonify({"error": "Internal server error"}), 500


def load_students(user_id):
    return get_all_students(user_id)


def get_grade(marks):
    if 90 <= marks <= 100:
        return "A+"
    elif 80 <= marks < 90:
        return "A"
    elif 70 <= marks < 80:
        return "B"
    elif 60 <= marks < 70:
        return "C"
    elif 50 <= marks < 60:
        return "D"
    elif 40 <= marks < 50:
        return "E"
    else:
        return "Fail"


@app.route("/api/health", methods=["GET"])
def health_check():
    check_database_health()
    return jsonify({"status": "ok"})


@app.route("/api/auth/csrf", methods=["GET"])
def get_csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_urlsafe(32)
    return jsonify({"csrf_token": session["csrf_token"]})


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required"}), 400

    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not EMAIL_PATTERN.fullmatch(email.strip()):
        return jsonify({"error": "A valid email is required"}), 400
    if len(email.strip()) > 254:
        return jsonify({"error": "Email is too long"}), 400
    if not isinstance(password, str) or len(password) < 10 or len(password) > 128:
        return jsonify({"error": "Password must be 10 to 128 characters"}), 400

    status, user = create_user(
        email.strip().lower(),
        generate_password_hash(password),
    )
    if status == "duplicate":
        return jsonify({"error": "An account with this email already exists"}), 409

    session["user_id"] = user["id"]
    session["user_email"] = user["email"]
    session.permanent = True
    return jsonify({"user": {"id": user["id"], "email": user["email"]}}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required"}), 400

    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    user = get_user_by_email(email.strip().lower())
    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = user["id"]
    session["user_email"] = user["email"]
    session.permanent = True
    return jsonify({"user": {"id": user["id"], "email": user["email"]}})


@app.route("/api/auth/me", methods=["GET"])
def current_user():
    user_id = session.get("user_id")
    email = session.get("user_email")
    if not isinstance(user_id, int) or not isinstance(email, str):
        return jsonify({"user": None})
    return jsonify({"user": {"id": user_id, "email": email}})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/students", methods=["GET"])
@login_required
def get_students():
    return jsonify(load_students(g.user_id))


@app.route("/api/students/statistics", methods=["GET"])
@login_required
def get_statistics():
    marks = list(load_students(g.user_id).values())
    total_students = len(marks)

    if total_students == 0:
        return jsonify({
            "total_students": 0,
            "average_marks": 0,
            "highest_marks": None,
            "lowest_marks": None,
            "passed_students": 0,
            "failed_students": 0,
        })

    passed_students = sum(1 for mark in marks if mark >= 40)

    return jsonify({
        "total_students": total_students,
        "average_marks": round(sum(marks) / total_students, 2),
        "highest_marks": max(marks),
        "lowest_marks": min(marks),
        "passed_students": passed_students,
        "failed_students": total_students - passed_students,
    })


@app.route("/api/students/ranking", methods=["GET"])
@login_required
def get_student_ranking():
    ranked_students = sorted(
        load_students(g.user_id).items(),
        key=lambda student: student[1],
        reverse=True,
    )

    return jsonify([
        {
            "rank": rank,
            "name": name,
            "marks": marks,
            "grade": get_grade(marks),
        }
        for rank, (name, marks) in enumerate(ranked_students, start=1)
    ])


@app.route("/api/students/search", methods=["GET"])
@login_required
def search_students():
    search_name = request.args.get("name", "").strip().lower()
    students = load_students(g.user_id)

    return jsonify([
        {
            "name": name,
            "marks": marks,
            "grade": get_grade(marks),
        }
        for name, marks in students.items()
        if not search_name or search_name in name.lower()
    ])


@app.route("/api/students/<string:name>", methods=["GET"])
@login_required
def get_student(name):
    student = get_student_record(g.user_id, name)
    if student is None:
        return jsonify({"error": "Student not found"}), 404

    return jsonify({
        "name": student["name"],
        "marks": student["marks"],
        "grade": get_grade(student["marks"]),
    })


@app.route("/api/students/<string:name>", methods=["DELETE"])
@login_required
def delete_student(name):
    if not delete_student_record(g.user_id, name):
        return jsonify({"error": "Student not found"}), 404

    return jsonify({
        "message": "Student deleted successfully",
        "name": name,
    })


@app.route("/api/students", methods=["POST"])
@login_required
def add_student():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required"}), 400

    name = data.get("name")
    marks = data.get("marks")

    if not isinstance(name, str):
        return jsonify({"error": "Name must be a string"}), 400

    name = name.strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    if marks is None:
        return jsonify({"error": "Marks are required"}), 400

    if not isinstance(marks, int) or isinstance(marks, bool):
        return jsonify({"error": "Marks must be a number"}), 400

    if marks < 0 or marks > 100:
        return jsonify({"error": "Marks must be between 0 and 100"}), 400

    if not add_student_record(g.user_id, name, marks):
        return jsonify({"error": "Student already exists"}), 400

    return jsonify({
        "message": "Student added successfully",
        "student": {
            "name": name,
            "marks": marks,
            "grade": get_grade(marks),
        },
    }), 201


@app.route("/api/students/update-name", methods=["PUT"])
@login_required
def update_student_name():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required"}), 400

    old_name = data.get("old_name")
    new_name = data.get("new_name")

    if not isinstance(old_name, str) or not old_name:
        return jsonify({"error": "Old name is required"}), 400

    if not isinstance(new_name, str):
        return jsonify({"error": "New name is required"}), 400

    new_name = new_name.strip()
    if not new_name:
        return jsonify({"error": "Student name cannot be empty"}), 400

    result = rename_student_record(g.user_id, old_name, new_name)
    if result == "not_found":
        return jsonify({"error": "Student not found"}), 404
    if result == "duplicate":
        return jsonify({"error": "Student already exists"}), 400

    return jsonify({
        "message": "Student name updated successfully",
        "old_name": old_name,
        "new_name": new_name,
    })


@app.route("/api/students/update-marks", methods=["PUT"])
@login_required
def update_student_marks():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required"}), 400

    name = data.get("name")
    old_marks = data.get("old_marks")
    marks = data.get("marks")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Student name is required"}), 400

    name = name.strip()

    if not isinstance(old_marks, int) or isinstance(old_marks, bool):
        return jsonify({"error": "Old marks must be a number"}), 400

    if not isinstance(marks, int) or isinstance(marks, bool):
        return jsonify({"error": "Marks must be a number"}), 400

    if marks < 0 or marks > 100:
        return jsonify({"error": "Marks must be between 0 and 100"}), 400

    if marks == old_marks:
        return jsonify({
            "error": "New marks must be different from the current marks"
        }), 400

    result = update_student_marks_record(g.user_id, name, old_marks, marks)
    if result == "not_found":
        return jsonify({"error": "Student not found"}), 404
    if result == "conflict":
        return jsonify({
            "error": f"Old marks do not match the current marks for {name}"
        }), 409

    return jsonify({
        "message": "Student marks updated successfully",
        "student": {
            "name": name,
            "marks": marks,
            "grade": get_grade(marks),
        },
    })


if __name__ == "__main__":
    app.run(debug=False)
