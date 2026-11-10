
import { useEffect, useState } from "react";
import "./App.css";

import {
  getClasses,
  registerStudent,
  createHold,
  getMyHolds,
  confirmHold,
  cancelHold,
  createClass,
  createShift,
} from "./api";

function App() {
  const [studentId, setStudentId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [checkingStudent, setCheckingStudent] = useState(false);

  const [classes, setClasses] = useState([]);
  const [holds, setHolds] = useState([]);

  const [loadingApplications, setLoadingApplications] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [student, setStudent] = useState({
    fullName: "",
    dateOfBirth: "",
    guardianName: "",
    guardianPhone: "",
  });

  const [newClassName, setNewClassName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [newShiftName, setNewShiftName] = useState("");
  const [totalSeats, setTotalSeats] = useState(30);
  const [adminMessage, setAdminMessage] = useState("");

  // Normalize application data
  const normalizeHold = (hold) => ({
    id: hold.id ?? hold.Id,
    classShiftId: hold.classShiftId ?? hold.ClassShiftId,
    studentId: hold.studentId ?? hold.StudentId,
    status: hold.status ?? hold.Status ?? "Unknown",
    createdAt: hold.createdAt ?? hold.CreatedAt,
    expiresAt: hold.expiresAt ?? hold.ExpiresAt,
    confirmedAt: hold.confirmedAt ?? hold.ConfirmedAt,
    className:
      hold.className ?? hold.ClassName ?? "Unknown Class",
    shiftName:
      hold.shiftName ?? hold.ShiftName ?? "Unknown Shift",
  });

  // Load classes
  const loadClasses = async () => {
    try {
      const data = await getClasses();
      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Class loading error:", err);
      setError(err.message || "Class loading failed");
    }
  };

  // Load applications
  const loadMyHolds = async (id = studentId) => {
    const studentNumber = String(id || "").trim();

    if (!studentNumber) {
      setError("Student ID পাওয়া যায়নি");
      return;
    }

    try {
      setLoadingApplications(true);
      setError("");

      const data = await getMyHolds(studentNumber);

      console.log("Applications API Response:", data);

      let applications = [];

      if (Array.isArray(data)) {
        applications = data;
      } else if (Array.isArray(data?.holds)) {
        applications = data.holds;
      } else if (Array.isArray(data?.applications)) {
        applications = data.applications;
      } else if (Array.isArray(data?.$values)) {
        applications = data.$values;
      } else if (data && (data.id || data.Id)) {
        applications = [data];
      }

      const normalizedApplications = applications.map(normalizeHold);

      console.log("Normalized Applications:", normalizedApplications);

      setHolds(normalizedApplications);

      if (normalizedApplications.length === 0) {
        setSuccess("No applications found.");
      }

      return normalizedApplications;
    } catch (err) {
      console.error("Application loading error:", err);
      setError(err.message || "Could not load applications");
      setHolds([]);
      return [];
    } finally {
      setLoadingApplications(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadClasses();
  }, []);

  // Update expiry timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check existing student
  const handleContinue = async () => {
    const brn = studentId.trim();

    if (!brn) {
      setError("Birth Registration Number দিন");
      return;
    }

    setError("");
    setSuccess("");
    setCheckingStudent(true);

    try {
      const response = await fetch(
        `http://localhost:5154/api/Students/${encodeURIComponent(brn)}`
      );

      if (response.ok) {
        setStudentId(brn);
        setRegistered(true);
        setShowForm(false);

        setSuccess("Welcome back! Student already registered.");

        await loadMyHolds(brn);
      } else if (response.status === 404) {
        setRegistered(false);
        setShowForm(true);
        setHolds([]);

        setSuccess("New student. Please complete registration.");
      } else {
        throw new Error("Student information check failed");
      }
    } catch (err) {
      setError(err.message || "Student check failed");
    } finally {
      setCheckingStudent(false);
    }
  };

  // Student form change
  const handleChange = (e) => {
    setStudent({
      ...student,
      [e.target.name]: e.target.value,
    });
  };

  // Register student
  const handleRegister = async () => {
    if (
      !student.fullName.trim() ||
      !student.dateOfBirth ||
      !student.guardianName.trim() ||
      !student.guardianPhone.trim()
    ) {
      setError("সব তথ্য পূরণ করুন");
      return;
    }

    try {
      setError("");

      await registerStudent({
        birthRegistrationNumber: studentId.trim(),
        fullName: student.fullName.trim(),
        dateOfBirth: student.dateOfBirth,
        guardianName: student.guardianName.trim(),
        guardianPhone: student.guardianPhone.trim(),
      });

      setRegistered(true);
      setShowForm(false);
      setSuccess("Student Registration Successful!");

      await loadMyHolds(studentId.trim());
    } catch (err) {
      setError(err.message || "Registration failed");
    }
  };

  // Create class
  const handleCreateClass = async () => {
    try {
      setError("");
      setAdminMessage("");

      if (!newClassName.trim()) {
        setError("Class name দিন");
        return;
      }

      await createClass(newClassName.trim());

      setAdminMessage("Class created successfully!");
      setNewClassName("");

      await loadClasses();
    } catch (err) {
      setError(err.message || "Class creation failed");
    }
  };

  // Create shift
  const handleCreateShift = async () => {
    try {
      setError("");
      setAdminMessage("");

      if (!selectedClassId) {
        setError("একটি Class select করুন");
        return;
      }

      if (!newShiftName.trim()) {
        setError("Shift name দিন");
        return;
      }

      if (Number(totalSeats) < 1) {
        setError("Total seats কমপক্ষে 1 হতে হবে");
        return;
      }

      await createShift(
        selectedClassId,
        newShiftName.trim(),
        totalSeats
      );

      setAdminMessage("Shift created successfully!");
      setNewShiftName("");
      setTotalSeats(30);

      await loadClasses();
    } catch (err) {
      setError(err.message || "Shift creation failed");
    }
  };

  // Apply for admission
  const handleApply = async (classId, shiftId) => {
    try {
      setError("");
      setSuccess("");

      if (!registered || !studentId.trim()) {
        setError("আগে Student Registration সম্পন্ন করুন");
        return;
      }

      await createHold(classId, shiftId, studentId.trim());

      setSuccess(
        "Seat temporarily reserved! Please confirm within 10 minutes."
      );

      await loadMyHolds(studentId.trim());
      await loadClasses();
    } catch (err) {
      setError(err.message || "Admission application failed");

      await loadMyHolds(studentId.trim());
      await loadClasses();
    }
  };

  // Confirm admission
  const handleConfirm = async (holdId) => {
    try {
      setError("");
      setSuccess("");

      const result = await confirmHold(holdId, studentId.trim());

      setSuccess(
        result.message || "Admission confirmed successfully!"
      );

      await loadMyHolds(studentId.trim());
      await loadClasses();
    } catch (err) {
      setError(err.message || "Confirmation failed");

      await loadMyHolds(studentId.trim());
      await loadClasses();
    }
  };

  // Cancel hold
  const handleCancel = async (holdId) => {
    try {
      setError("");
      setSuccess("");

      const result = await cancelHold(holdId, studentId.trim());

      setSuccess(
        result.message || "Hold cancelled successfully!"
      );

      await loadMyHolds(studentId.trim());
      await loadClasses();
    } catch (err) {
      setError(err.message || "Cancellation failed");
    }
  };

  return (
    <div className="app">
      <header>
        <h1>School Admission System</h1>
        <p>Online School Admission Portal</p>
      </header>

      <main>
        {/* Admin Panel */}
        <section className="admin-section">
          <h2>Admin Panel</h2>

          <h3>Create New Class</h3>

          <input
            type="text"
            placeholder="Enter class name"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />

          <button onClick={handleCreateClass}>
            Create Class
          </button>

          <hr />

          <h3>Create New Shift</h3>

          <label>Select Class</label>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Select a Class</option>

            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <label>Shift Name</label>

          <input
            type="text"
            placeholder="Morning / Day / Evening"
            value={newShiftName}
            onChange={(e) => setNewShiftName(e.target.value)}
          />

          <label>Total Seats</label>

          <input
            type="number"
            min="1"
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
          />

          <button onClick={handleCreateShift}>
            Create Shift
          </button>

          {adminMessage && (
            <p style={{ color: "green" }}>{adminMessage}</p>
          )}
        </section>

        {/* Student Information */}
        <section className="student-section">
          <h2>Student Information</h2>

          <label>Birth Registration Number</label>

          <input
            type="text"
            placeholder="Enter birth registration number"
            value={studentId}
            disabled={registered}
            onChange={(e) => setStudentId(e.target.value)}
          />

          {!registered && (
            <button
              onClick={handleContinue}
              disabled={checkingStudent}
            >
              {checkingStudent ? "Checking..." : "Continue"}
            </button>
          )}

          {showForm && !registered && (
            <div>
              <h2>Student Registration</h2>

              <label>Student Full Name</label>

              <input
                name="fullName"
                value={student.fullName}
                onChange={handleChange}
                placeholder="Full Name"
              />

              <label>Date of Birth</label>

              <input
                type="date"
                name="dateOfBirth"
                value={student.dateOfBirth}
                onChange={handleChange}
              />

              <label>Guardian Name</label>

              <input
                name="guardianName"
                value={student.guardianName}
                onChange={handleChange}
                placeholder="Guardian Name"
              />

              <label>Guardian Phone</label>

              <input
                name="guardianPhone"
                value={student.guardianPhone}
                onChange={handleChange}
                placeholder="Phone Number"
              />

              <button onClick={handleRegister}>
                Register Student
              </button>
            </div>
          )}

          {registered && (
            <div>
              <p>Student Registration Successful!</p>

              <button
                onClick={() => loadMyHolds(studentId)}
                disabled={loadingApplications}
              >
                {loadingApplications
                  ? "Loading..."
                  : "View My Applications"}
              </button>
            </div>
          )}

          {error && (
            <p style={{ color: "red" }}>{error}</p>
          )}

          {success && (
            <p style={{ color: "green" }}>{success}</p>
          )}
        </section>

        {/* Available Classes */}
        <section className="classes-section">
          <h2>Available Classes</h2>

          {classes.map((item) => (
            <div key={item.id}>
              <h3>{item.name}</h3>

              {(item.shifts || []).map((shift) => {
                const alreadyApplied = holds.some((hold) => {
                  const status = String(hold.status).toLowerCase();

                  return (
                    String(hold.classShiftId).toLowerCase() ===
                      String(shift.id).toLowerCase() &&
                    ["pending", "confirmed"].includes(status)
                  );
                });

                const availableSeats =
                  shift.totalSeats -
                  shift.heldSeats -
                  shift.confirmedSeats;

                return (
                  <div key={shift.id}>
                    <p>
                      {shift.shiftName} — Total Seats: {shift.totalSeats}
                    </p>

                    <p>
                      Available Seats: {availableSeats}
                    </p>

                    <button
                      disabled={
                        !registered ||
                        loadingApplications ||
                        alreadyApplied ||
                        availableSeats <= 0
                      }
                      onClick={() => handleApply(item.id, shift.id)}
                    >
                      {alreadyApplied
                        ? "Already Applied"
                        : "Apply for Admission"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        {/* My Applications */}
        <section className="applications-section">
          <h2>My Applications</h2>

          {loadingApplications && (
            <p>Loading applications...</p>
          )}

          {!loadingApplications && holds.length === 0 && (
            <p>No applications found.</p>
          )}

          {!loadingApplications &&
            holds.map((hold) => {
              const status = String(hold.status).toLowerCase();

              const expired =
                status === "pending" &&
                new Date(hold.expiresAt).getTime() <= currentTime;

              const displayStatus = expired
                ? "Expired"
                : hold.status;

              const statusClass = expired
                ? "expired"
                : status;

              return (
                <div className="application-card" key={hold.id}>
                  <h3>
                    {hold.className} - {hold.shiftName}
                  </h3>

                  <p>
                    Status:{" "}
                    <strong className={`status-${statusClass}`}>
                      {displayStatus}
                    </strong>
                  </p>

                  <p>
                    Applied:{" "}
                    {hold.createdAt
                      ? new Date(hold.createdAt).toLocaleString()
                      : "N/A"}
                  </p>

                  {status === "pending" && (
                    <>
                      <p>
                        Expires:{" "}
                        {new Date(hold.expiresAt).toLocaleString()}
                      </p>

                      <button
                        disabled={expired}
                        onClick={() => handleConfirm(hold.id)}
                      >
                        Confirm Admission
                      </button>

                      <button
                        disabled={expired}
                        onClick={() => handleCancel(hold.id)}
                      >
                        Cancel Hold
                      </button>
                    </>
                  )}

                  {status === "confirmed" && (
                    <p>Admission successfully confirmed.</p>
                  )}

                  {status === "cancelled" && (
                    <p>This application has been cancelled.</p>
                  )}

                  {(status === "expired" || expired) && (
                    <p>This application has expired.</p>
                  )}
                </div>
              );
            })}
        </section>
      </main>
    </div>
  );
}

export default App;
