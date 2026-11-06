import json


# -------------------- File Handling --------------------

try:
    with open("students.json", "r") as file:
        student = json.load(file)
except FileNotFoundError:
    student = {}


def save_students():
    with open("students.json", "w") as file:
        json.dump(student, file, indent=4)


# -------------------- Grade Function --------------------

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


# -------------------- Add Student --------------------

def add_student():
    name = input("Enter Your Name: ").strip()

    if name == "":
        print("Student name cannot be empty!")

    elif name in student:
        print(f"Student '{name}' already exists!")

    else:
        try:
            marks = int(input("Enter marks: "))

            if 0 <= marks <= 100:
                student[name] = marks
                save_students()
                print(f"{name} successfully added!")

            else:
                print("Invalid marks! Please enter marks between 0 and 100.")

        except ValueError:
            print("Invalid input! Please enter marks as a number.")


# -------------------- View One Student --------------------

def view_student():
    if not student:
        print("No students found!")
        return

    name = input("Enter Your Name: ")

    if name in student:
        marks = student[name]
        grade = get_grade(marks)
        print(f"{name}: {marks} marks - Grade {grade}")

    else:
        print("Student not found!")


# -------------------- View All Students --------------------

def view_all_students():
    if not student:
        print("No students found!")
        return

    print("All Students:")

    for name, marks in student.items():
        grade = get_grade(marks)
        print(f"{name}: {marks} marks - Grade {grade}")


# -------------------- Check Result --------------------

def check_result():
    name = input("Enter Your Name: ")

    if name in student:
        marks = student[name]
        grade = get_grade(marks)

        if grade == "Fail":
            print(f"{name}: {marks} marks - Failed")
        else:
            print(f"{name}: {marks} marks - Grade {grade}")

    else:
        print("No student found")


# -------------------- Update Student Name --------------------

def update_student_name():
    old_name = input("Enter the old name of the student: ")

    if old_name in student:

        new_name = input("Enter the new name of the student: ").strip()

        if new_name == "":
            print("Student name cannot be empty!")

        elif new_name in student:
            print(f"Student '{new_name}' already exists!")

        else:
            # Remove old name and use its marks for the new name
            student[new_name] = student.pop(old_name)

            save_students()

            print(
                f"Student name updated from "
                f"{old_name} to {new_name}."
            )

    else:
        print("Student not found!")


# -------------------- Update Student Marks --------------------

def update_student_marks():
    name = input("Enter the name of student, to update marks: ")

    if name not in student:
        print("Student not found!")
        return

    try:
        old_marks = int(input("Enter old marks of student: "))

        if old_marks == student[name]:

            new_marks = int(input("Enter new marks of student: "))

            if new_marks == old_marks:
                print(
                    "Old marks are same as new marks, "
                    "please enter new marks to update"
                )

            elif 0 <= new_marks <= 100:
                student[name] = new_marks

                save_students()

                print(
                    f"Marks updated for {name} "
                    f"from {old_marks} to {new_marks}."
                )

            else:
                print(
                    "Invalid marks! "
                    "Please enter marks between 0 and 100."
                )

        else:
            print(
                f"Old marks do not match "
                f"the current marks for {name}."
            )

    except ValueError:
        print("Invalid input! Please enter marks as a number.")


# -------------------- Delete Student --------------------

def delete_student():
    name = input("Enter the name of student to delete: ")

    if name in student:
        del student[name]

        save_students()

        print(f"Student '{name}' has been deleted successfully!")

    else:
        print("Student not found!")


# -------------------- Class Statistics --------------------

def show_statistics():
    if not student:
        print("No students found!")
        return

    total_students = len(student)

    total_marks = sum(student.values())

    average_marks = total_marks / total_students

    highest_marks = max(student.values())

    lowest_marks = min(student.values())

    passed_students = sum(
        1 for marks in student.values()
        if marks >= 40
    )

    failed_students = total_students - passed_students

    print(f"Total Students: {total_students}")
    print(f"Average Marks: {average_marks:.2f}")
    print(f"Highest Marks: {highest_marks}")
    print(f"Lowest Marks: {lowest_marks}")
    print(f"Passed Students: {passed_students}")
    print(f"Failed Students: {failed_students}")


# -------------------- Student Ranking --------------------

def show_ranking():
    if not student:
        print("No students found!")
        return

    sorted_students = sorted(
        student.items(),
        key=lambda x: x[1],
        reverse=True
    )

    print("\n----- Student Ranking -----")

    for rank, (name, marks) in enumerate(
        sorted_students,
        start=1
    ):
        grade = get_grade(marks)

        print(
            f"Rank {rank}: "
            f"{name} - {marks} marks - Grade {grade}"
        )


# -------------------- Search Students --------------------

def search_students():
    if not student:
        print("No students found!")
        return

    search_name = input(
        "Enter the name of the student to search: "
    ).strip().lower()

    found = False

    for name, marks in student.items():

        if search_name in name.lower():

            grade = get_grade(marks)

            print(
                f"Student found: "
                f"{name} - {marks} marks - Grade {grade}"
            )

            found = True

    if not found:
        print("Student not found!")


# -------------------- Main Menu --------------------

while True:

    print("\n------ Student Manager App ------")

    print("1. Add Student")
    print("2. View Student")
    print("3. View All Students")
    print("4. Check Results")
    print("5. Update Student Name")
    print("6. Update Student Marks")
    print("7. Delete Student")
    print("8. Class Statistics")
    print("9. Student Ranking")
    print("10. Search Students")
    print("11. Exit")

    choice = input("Enter your choice: ")

    if choice == "1":
        add_student()

    elif choice == "2":
        view_student()

    elif choice == "3":
        view_all_students()

    elif choice == "4":
        check_result()

    elif choice == "5":
        update_student_name()

    elif choice == "6":
        update_student_marks()

    elif choice == "7":
        delete_student()

    elif choice == "8":
        show_statistics()

    elif choice == "9":
        show_ranking()

    elif choice == "10":
        search_students()

    elif choice == "11":
        print("Exiting the Student Manager App. Goodbye!")
        break

    else:
        print("Invalid choice! Please try again.")
