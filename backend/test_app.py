import unittest
from unittest.mock import patch

from backend import app as app_module
from backend.database import DatabaseConfigurationError
from werkzeug.security import generate_password_hash


class StudentApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()
        self.headers = {"X-CSRF-Token": "test-csrf"}
        with self.client.session_transaction() as session:
            session["user_id"] = 1
            session["user_email"] = "teacher@example.com"
            session["csrf_token"] = "test-csrf"

    @patch("backend.app.add_student_record", return_value=True)
    def test_add_student_trims_name_and_returns_grade(self, add_record):
        response = self.client.post(
            "/api/students",
            json={"name": "  Ada  ", "marks": 95},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["student"]["name"], "Ada")
        self.assertEqual(response.get_json()["student"]["grade"], "A+")
        add_record.assert_called_once_with(1, "Ada", 95)

    def test_add_student_rejects_boolean_marks(self):
        response = self.client.post(
            "/api/students",
            json={"name": "Ada", "marks": True},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Marks must be a number")

    @patch("backend.app.add_student_record", return_value=False)
    def test_add_student_rejects_duplicate_name(self, _add_record):
        response = self.client.post(
            "/api/students",
            json={"name": "Ada", "marks": 95},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Student already exists")

    @patch("backend.app.update_student_marks_record", return_value="conflict")
    def test_update_marks_requires_a_matching_old_value(self, update_record):
        response = self.client.put(
            "/api/students/update-marks",
            json={"name": "Ada", "old_marks": 80, "marks": 90},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 409)
        update_record.assert_called_once_with(1, "Ada", 80, 90)

    @patch("backend.app.update_student_marks_record", return_value="updated")
    def test_update_marks_success(self, update_record):
        response = self.client.put(
            "/api/students/update-marks",
            json={"name": "Ada", "old_marks": 80, "marks": 90},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["student"]["marks"], 90)
        update_record.assert_called_once_with(1, "Ada", 80, 90)

    @patch("backend.app.load_students", return_value={"Ada": 90, "Ben": 30})
    def test_search_and_statistics(self, _load_students):
        search = self.client.get("/api/students/search?name=ad")
        statistics = self.client.get("/api/students/statistics")

        self.assertEqual(search.status_code, 200)
        self.assertEqual(search.get_json()[0]["name"], "Ada")
        self.assertEqual(statistics.get_json()["total_students"], 2)
        self.assertEqual(statistics.get_json()["passed_students"], 1)

    @patch("backend.app.load_students", return_value={})
    def test_empty_students_and_statistics(self, _load_students):
        students = self.client.get("/api/students")
        statistics = self.client.get("/api/students/statistics")

        self.assertEqual(students.get_json(), {})
        self.assertEqual(statistics.get_json()["total_students"], 0)
        self.assertIsNone(statistics.get_json()["highest_marks"])

    @patch("backend.app.load_students", return_value={"Ada": 90, "Ben": 30})
    def test_ranking_and_empty_search(self, _load_students):
        ranking = self.client.get("/api/students/ranking")
        search = self.client.get("/api/students/search")

        self.assertEqual(ranking.status_code, 200)
        self.assertEqual(ranking.get_json()[0]["name"], "Ada")
        self.assertEqual(len(search.get_json()), 2)

    @patch("backend.app.get_student_record", return_value={"name": "Ada", "marks": 40})
    def test_get_student_includes_grade(self, _get_student):
        response = self.client.get("/api/students/Ada")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["grade"], "E")

    @patch("backend.app.get_student_record", return_value=None)
    def test_get_missing_student(self, _get_student):
        response = self.client.get("/api/students/Missing")

        self.assertEqual(response.status_code, 404)

    @patch("backend.app.delete_student_record", return_value=False)
    def test_delete_missing_student(self, _delete_record):
        response = self.client.delete(
            "/api/students/Missing",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 404)

    @patch("backend.app.delete_student_record", return_value=True)
    def test_delete_student(self, delete_record):
        response = self.client.delete(
            "/api/students/Ada",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        delete_record.assert_called_once_with(1, "Ada")

    @patch("backend.app.rename_student_record", return_value="updated")
    def test_rename_student(self, rename_record):
        response = self.client.put(
            "/api/students/update-name",
            json={"old_name": "Ada", "new_name": "  Ada Lovelace  "},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["new_name"], "Ada Lovelace")
        rename_record.assert_called_once_with(1, "Ada", "Ada Lovelace")

    def test_student_data_requires_authentication(self):
        response = app_module.app.test_client().get("/api/students")

        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_write_fails_before_csrf_check(self):
        response = app_module.app.test_client().post(
            "/api/students",
            json={"name": "Ada", "marks": 90},
        )

        self.assertEqual(response.status_code, 401)

    def test_cors_preflight_is_not_blocked_by_authentication(self):
        response = app_module.app.test_client().options(
            "/api/students",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,x-csrf-token",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["Access-Control-Allow-Origin"],
            "http://localhost:5173",
        )

    def test_login_creates_a_persistent_user_session(self):
        client = app_module.app.test_client()
        csrf = client.get("/api/auth/csrf").get_json()["csrf_token"]
        with patch(
            "backend.app.get_user_by_email",
            return_value={
                "id": 7,
                "email": "teacher@example.com",
                "password_hash": generate_password_hash("a-long-password"),
            },
        ):
            response = client.post(
                "/api/auth/login",
                json={"email": "TEACHER@example.com", "password": "a-long-password"},
                headers={"X-CSRF-Token": csrf},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            client.get("/api/auth/me").get_json()["user"],
            {"id": 7, "email": "teacher@example.com"},
        )
        self.assertIn("HttpOnly", response.headers.get("Set-Cookie", ""))

    def test_student_write_requires_csrf_token(self):
        response = app_module.app.test_client()
        with response.session_transaction() as session:
            session["user_id"] = 1
            session["csrf_token"] = "expected-token"

        result = response.post(
            "/api/students",
            json={"name": "Ada", "marks": 90},
        )

        self.assertEqual(result.status_code, 403)

    @patch("backend.app.load_students", side_effect=DatabaseConfigurationError(
        "DATABASE_URL is not configured"
    ))
    def test_missing_database_configuration_is_reported(self, _load_students):
        response = self.client.get("/api/students")

        self.assertEqual(response.status_code, 503)
        self.assertIn("DATABASE_URL", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
