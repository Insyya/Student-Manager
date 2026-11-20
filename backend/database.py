import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg import sql
from psycopg.rows import dict_row

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(Path(__file__).resolve().with_name(".env"))
load_dotenv(PROJECT_ROOT / ".env.local")

AUTH_OWNERSHIP_MIGRATION = "students-auth-ownership-v1"


class DatabaseConfigurationError(RuntimeError):
    pass


def connect_database():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise DatabaseConfigurationError(
            "DATABASE_URL is not set. Configure it in backend/.env or the "
            "repository .env.local file, or in the deployment environment."
        )

    if database_url.startswith("postgres://"):
        database_url = "postgresql://" + database_url[len("postgres://"):]

    return psycopg.connect(database_url, row_factory=dict_row)


def get_user_by_email(email):
    with connect_database() as connection:
        return connection.execute(
            "SELECT id, email, password_hash FROM users WHERE email = %s",
            (email,),
        ).fetchone()


def create_user(email, password_hash):
    with connect_database() as connection:
        user = connection.execute(
            """
            INSERT INTO users (email, password_hash)
            VALUES (%s, %s)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email
            """,
            (email, password_hash),
        ).fetchone()
        if user is None:
            return "duplicate", None

    return "created", user


def get_all_students(user_id):
    with connect_database() as connection:
        rows = connection.execute(
            "SELECT name, marks FROM students WHERE user_id = %s ORDER BY name",
            (user_id,),
        ).fetchall()
    return {row["name"]: row["marks"] for row in rows}


def get_student_record(user_id, name):
    with connect_database() as connection:
        return connection.execute(
            "SELECT name, marks FROM students WHERE user_id = %s AND name = %s",
            (user_id, name),
        ).fetchone()


def add_student_record(user_id, name, marks):
    with connect_database() as connection:
        row = connection.execute(
            """
            INSERT INTO students (user_id, name, marks)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING name
            """,
            (user_id, name, marks),
        ).fetchone()
    return row is not None


def rename_student_record(user_id, old_name, new_name):
    with connect_database() as connection:
        student = connection.execute(
            """
            SELECT marks FROM students
            WHERE user_id = %s AND name = %s
            FOR UPDATE
            """,
            (user_id, old_name),
        ).fetchone()
        if student is None:
            return "not_found"

        inserted = connection.execute(
            """
            INSERT INTO students (user_id, name, marks)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING name
            """,
            (user_id, new_name, student["marks"]),
        ).fetchone()
        if inserted is None:
            return "duplicate"

        connection.execute(
            "DELETE FROM students WHERE user_id = %s AND name = %s",
            (user_id, old_name),
        )
    return "updated"


def update_student_marks_record(user_id, name, old_marks, new_marks):
    with connect_database() as connection:
        student = connection.execute(
            """
            SELECT marks FROM students
            WHERE user_id = %s AND name = %s
            FOR UPDATE
            """,
            (user_id, name),
        ).fetchone()
        if student is None:
            return "not_found"
        if student["marks"] != old_marks:
            return "conflict"

        connection.execute(
            "UPDATE students SET marks = %s WHERE user_id = %s AND name = %s",
            (new_marks, user_id, name),
        )
    return "updated"


def delete_student_record(user_id, name):
    with connect_database() as connection:
        row = connection.execute(
            """
            DELETE FROM students
            WHERE user_id = %s AND name = %s
            RETURNING name
            """,
            (user_id, name),
        ).fetchone()
    return row is not None


def check_database_health():
    with connect_database() as connection:
        connection.execute("SELECT 1")


def initialize_database():
    with connect_database() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS students (
                name TEXT NOT NULL,
                marks SMALLINT NOT NULL CHECK (marks BETWEEN 0 AND 100),
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS "
            "user_id BIGINT REFERENCES users(id) ON DELETE CASCADE"
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS app_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        ownership_migration = connection.execute(
            "SELECT name FROM app_migrations WHERE name = %s",
            (AUTH_OWNERSHIP_MIGRATION,),
        ).fetchone()
        if ownership_migration is None:
            primary_key = connection.execute(
                """
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'students'::regclass AND contype = 'p'
                """
            ).fetchone()
            if primary_key is not None:
                connection.execute(
                    sql.SQL("ALTER TABLE students DROP CONSTRAINT {}").format(
                        sql.Identifier(primary_key["conname"])
                    )
                )
            connection.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS students_owner_name_unique
                ON students (COALESCE(user_id, 0), name)
                """
            )
            connection.execute(
                "INSERT INTO app_migrations (name) VALUES (%s)",
                (AUTH_OWNERSHIP_MIGRATION,),
            )
