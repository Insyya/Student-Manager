from flask import Flask, jsonify, request
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)


# Load students from JSON
def load_students():
    try:
        with open("students.json", "r") as file:
            return json.load(file)
    except FileNotFoundError:
        return {}


@app.route("/api/students", methods=["GET"])
def get_students():
    students = load_students()
    return jsonify(students)

@app.route("/api/students", methods=["POST"])
def add_student():

    data = request.json

    name = data.get("name")
    marks = data.get("marks")

    if not name:
        return jsonify({"error": "Name is required"}), 400

    if marks is None:
        return jsonify({"error": "Marks are required"}), 400

    if name in load_students():
        return jsonify({"error": "Student already exists"}), 400

    if not isinstance(marks, int):
        return jsonify({"error": "Marks must be a number"}), 400

    if marks < 0 or marks > 100:
        return jsonify({"error": "Marks must be between 0 and 100"}), 400

    students = load_students()

    students[name] = marks

    save_students(students)

    return jsonify({
        "message": "Student added successfully",
        "student": {
            "name": name,
            "marks": marks,
            "grade": get_grade(marks)
        }
    }), 201


if __name__ == "__main__":
    app.run(debug=True)