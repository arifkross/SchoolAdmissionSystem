
import { useEffect, useState } from "react";
import "./App.css";

import {
  getClasses,
  registerStudent,
  createHold,
  getMyHolds,
  cancelHold,
  createClass,
  createShift,
  payAdmissionFee
} from "./api";

const ADMISSION_FEE = 500;

// Backend enum number অথবা text থেকে Status নির্ধারণ
const getStatus = (value) => {
  const statuses = {
    0: "pending",
    1: "confirmed",
    2: "cancelled",
    3: "expired"
  };

  const text = String(value ?? "unknown").toLowerCase();

  if (statuses[text] !== undefined) return statuses[text];

  return text;
};

// API response-এর camelCase / PascalCase support
const normalizeHold = (hold) => ({
  id: hold.id ?? hold.Id,
  classShiftId: hold.classShiftId ?? hold.ClassShiftId,
  studentId: hold.studentId ?? hold.StudentId,
  status: getStatus(hold.status ?? hold.Status),
  createdAt: hold.createdAt ?? hold.CreatedAt,
  expiresAt: hold.expiresAt ?? hold.ExpiresAt,
  confirmedAt: hold.confirmedAt ?? hold.ConfirmedAt,
  paymentStatus: String(
    hold.paymentStatus ?? hold.PaymentStatus ?? "Unpaid"
  ),
  paymentAmount: hold.paymentAmount ?? hold.PaymentAmount ?? 0,
  paidAt: hold.paidAt ?? hold.PaidAt,
  className: hold.className ?? hold.ClassName ?? "Unknown Class",
  shiftName: hold.shiftName ?? hold.ShiftName ?? "Unknown Shift"
});

const normalizeClass = (item) => ({
  id: item.id ?? item.Id,
  name: item.name ?? item.Name,
  shifts: (item.shifts ?? item.Shifts ?? []).map((shift) => ({
    id: shift.id ?? shift.Id,
    shiftName: shift.shiftName ?? shift.ShiftName,
    totalSeats: Number(shift.totalSeats ?? shift.TotalSeats ?? 0),
    heldSeats: Number(shift.heldSeats ?? shift.HeldSeats ?? 0),
    confirmedSeats: Number(
      shift.confirmedSeats ?? shift.ConfirmedSeats ?? 0
    )
  }))
});

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
    guardianPhone: ""
  });

  const [newClassName, setNewClassName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [newShiftName, setNewShiftName] = useState("");
  const [totalSeats, setTotalSeats] = useState(30);
  const [adminMessage, setAdminMessage] = useState("");

  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [payingHoldId, setPayingHoldId] = useState("");

  // Load classes
  const loadClasses = async () => {
    try {
      const data = await getClasses();

      const classList = Array.isArray(data)
        ? data
        : data?.$values ?? [];

      setClasses(classList.map(normalizeClass));
    } catch (err) {
      console.error(err);
      setError(err.message || "Class loading failed");
    }
  };

  // Load student applications
  const loadMyHolds = async (id = studentId) => {
    const brn = String(id || "").trim();

    if (!brn) return [];

    try {
      setLoadingApplications(true);

      const data = await getMyHolds(brn);

      let applications = [];

      if (Array.isArray(data)) {
        applications = data;
      } else if (Array.isArray(data?.holds)) {
        applications = data.holds;
      } else if (Array.isArray(data?.applications)) {
        applications = data.applications;
      } else if (Array.isArray(data?.$values)) {
        applications = data.$values;
      }

      const normalized = applications.map(normalizeHold);

      setHolds(normalized);

      return normalized;
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not load applications");
      setHolds([]);
      return [];
    } finally {
      setLoadingApplications(false);
    }
  };

  // Initial loading
  useEffect(() => {
    loadClasses();
  }, []);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Countdown calculation
  const getRemainingTime = (expiresAt) => {
    if (!expiresAt) return 0;

    const remaining = new Date(expiresAt).getTime() - currentTime;

    return Math.max(0, Math.ceil(remaining / 1000));
  };

  const formatCountdown = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

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
        const data = await response.json();

        setStudent({
          fullName: data.fullName ?? data.FullName ?? "",
          dateOfBirth: (data.dateOfBirth ?? data.DateOfBirth ?? "").split("T")[0],
          guardianName: data.guardianName ?? data.GuardianName ?? "",
          guardianPhone: data.guardianPhone ?? data.GuardianPhone ?? ""
        });

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
    setStudent((previous) => ({
      ...previous,
      [e.target.name]: e.target.value
    }));
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
      setSuccess("");

      await registerStudent({
        birthRegistrationNumber: studentId.trim(),
        fullName: student.fullName.trim(),
        dateOfBirth: student.dateOfBirth,
        guardianName: student.guardianName.trim(),
        guardianPhone: student.guardianPhone.trim()
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

      if (
        !Number.isInteger(Number(totalSeats)) ||
        Number(totalSeats) < 1 ||
        Number(totalSeats) > 1000
      ) {
        setError("Total seats 1 থেকে 1000 এর মধ্যে হতে হবে");
        return;
      }

      await createShift(
        selectedClassId,
        newShiftName.trim(),
        Number(totalSeats)
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
        "Seat temporarily reserved! Please pay within 10 minutes."
      );

      await loadMyHolds(studentId.trim());
      await loadClasses();
    } catch (err) {
      setError(err.message || "Admission application failed");

      await loadMyHolds(studentId.trim());
      await loadClasses();
    }
  };

  // Payment
  const handlePayment = async (holdId) => {
    try {
      setError("");
      setSuccess("");

      const enteredAmount = paymentAmounts[holdId];

      if (String(enteredAmount ?? "").trim() === "") {
        setError("Please enter payment amount");
        return;
      }

      const amount = Number(enteredAmount);

      if (amount !== ADMISSION_FEE) {
        setError("Admission Fee অবশ্যই ৳500 হতে হবে");
        return;
      }

      const hold = holds.find((item) => item.id === holdId);

      if (
        !hold ||
        hold.status !== "pending" ||
        getRemainingTime(hold.expiresAt) <= 0
      ) {
        setError("আপনার ১০ মিনিটের Hold সময় শেষ হয়েছে।");
        await loadMyHolds(studentId);
        return;
      }

      setPayingHoldId(holdId);

      await payAdmissionFee(holdId, studentId.trim(), amount);

      setSuccess("✓ ePayment Success");

      setPaymentAmounts((previous) => ({
        ...previous,
        [holdId]: ""
      }));

      await loadMyHolds(studentId.trim());
      await loadClasses();
    } catch (err) {
      setError(err.message || "Payment failed");

      await loadMyHolds(studentId.trim());
      await loadClasses();
    } finally {
      setPayingHoldId("");
    }
  };

  // Cancel hold
  const handleCancel = async (hold) => {
    try {
      setError("");
      setSuccess("");

      if (
        hold.status !== "pending" ||
        getRemainingTime(hold.expiresAt) <= 0
      ) {
        setError("এই Hold আর Cancel করা যাবে না।");
        await loadMyHolds(studentId);
        return;
      }

      const result = await cancelHold(hold.id, studentId.trim());

      setSuccess(result.message || "Hold cancelled successfully!");

      await loadMyHolds(studentId.trim());
      await loadClasses();
    } catch (err) {
      setError(err.message || "Cancellation failed");

      await loadMyHolds(studentId.trim());
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return "N/A";

    return parsedDate.toLocaleString();
  };

  return (
    <div className="app">
      <header>
        <h1>School Admission System</h1>
        <p>Online School Admission Portal</p>
      </header>

      <nav className="main-nav">
        <a href="#admin">Admin Panel</a>
        <a href="#student">Student Registration</a>
        <a href="#classes">Available Classes</a>
        <a href="#applications">My Applications</a>
      </nav>

      <main>
        {/* Admin Panel */}
        <section className="admin-section" id="admin">
          <h2>Admin Panel</h2>

          <div className="fee-admin-card">
            <h3>Admission Fee</h3>
            <p>
              Fixed Admission Fee: <strong>৳ {ADMISSION_FEE}</strong>
            </p>
          </div>

          <hr />

          <h3>Create New Class</h3>

          <input
            type="text"
            placeholder="Enter class name"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />

          <button onClick={handleCreateClass}>Create Class</button>

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
            max="1000"
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
          />

          <button onClick={handleCreateShift}>Create Shift</button>

          {adminMessage && (
            <p className="success-message">{adminMessage}</p>
          )}
        </section>

        {/* Student Information */}
        <section className="student-section" id="student">
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
            <div className="registration-form">
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
                type="tel"
                name="guardianPhone"
                value={student.guardianPhone}
                onChange={handleChange}
                placeholder="Phone Number"
              />

              <button onClick={handleRegister}>Register Student</button>
            </div>
          )}

          {registered && (
            <div className="registered-info">
              <h3>Student Details</h3>
              <p><strong>Name:</strong> {student.fullName || "N/A"}</p>
              <p><strong>Birth Registration Number:</strong> {studentId}</p>
              <p><strong>Date of Birth:</strong> {student.dateOfBirth || "N/A"}</p>
              <p><strong>Guardian:</strong> {student.guardianName || "N/A"}</p>
              <p><strong>Guardian Phone:</strong> {student.guardianPhone || "N/A"}</p>

              <button
                onClick={() => loadMyHolds(studentId)}
                disabled={loadingApplications}
              >
                {loadingApplications ? "Loading..." : "View My Applications"}
              </button>
            </div>
          )}

          {error && (
            <p className="error-message" role="alert">{error}</p>
          )}

          {success && (
            <p className="success-message" role="status">{success}</p>
          )}
        </section>

        {/* Available Classes */}
        <section className="classes-section" id="classes">
          <h2>Available Classes</h2>

          <div className="student-fee-display">
            <span>Admission Fee</span>
            <strong>৳ {ADMISSION_FEE}</strong>
          </div>

          {classes.length === 0 && (
            <p>No classes available at the moment.</p>
          )}

          {classes.map((item) => (
            <div className="class-card" key={item.id}>
              <h3>{item.name}</h3>

              {item.shifts.length === 0 && (
                <p>No shifts available for this class.</p>
              )}

              {item.shifts.map((shift) => {
                const statusExists = holds.some((hold) =>
                  String(hold.classShiftId).toLowerCase() ===
                    String(shift.id).toLowerCase() &&
                  ["pending", "confirmed"].includes(hold.status) &&
                  !(hold.status === "pending" &&
                    getRemainingTime(hold.expiresAt) <= 0)
                );

                const availableSeats = Math.max(
                  0,
                  shift.totalSeats -
                  shift.heldSeats -
                  shift.confirmedSeats
                );

                return (
                  <div className="shift-card" key={shift.id}>
                    <h4>{shift.shiftName}</h4>

                    <p>Total Seats: {shift.totalSeats}</p>

                    <p className="available-seats">
                      Available Seats: {availableSeats}
                    </p>

                    <button
                      disabled={
                        !registered ||
                        loadingApplications ||
                        statusExists ||
                        availableSeats <= 0
                      }
                      onClick={() => handleApply(item.id, shift.id)}
                    >
                      {statusExists
                        ? "Already Applied"
                        : availableSeats <= 0
                        ? "No Seats Available"
                        : "Apply for Admission"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        {/* My Applications */}
        <section className="applications-section" id="applications">
          <h2>My Applications</h2>

          {loadingApplications && <p>Loading applications...</p>}

          {!loadingApplications && holds.length === 0 && (
            <p>No applications found.</p>
          )}

          {!loadingApplications && holds.map((hold) => {
            const remaining = getRemainingTime(hold.expiresAt);

            const expired =
              hold.status === "expired" ||
              (hold.status === "pending" && remaining <= 0);

            const displayStatus = expired
              ? "Expired"
              : hold.status.charAt(0).toUpperCase() + hold.status.slice(1);

            const isPaid =
              hold.paymentStatus.toLowerCase() === "paid";

            const isPending =
              hold.status === "pending" && !expired && !isPaid;

            return (
              <div className="application-card" key={hold.id}>
                <h3>{hold.className} - {hold.shiftName}</h3>

                <p>
                  Admission Fee: <strong>৳ {ADMISSION_FEE}</strong>
                </p>

                <p>
                  Admission Status:{" "}
                  <strong className={`status-${expired ? "expired" : hold.status}`}>
                    {displayStatus}
                  </strong>
                </p>

                <p>
                  Payment Status:{" "}
                  <strong>{isPaid ? "Paid" : "Unpaid"}</strong>
                </p>

                <p>Applied: {formatDate(hold.createdAt)}</p>

                {isPending && (
                  <div className="hold-countdown">
                    <h4>Time Remaining</h4>
                    <h2>{formatCountdown(remaining)}</h2>
                    <p>Please complete payment before the timer expires.</p>
                  </div>
                )}

                {isPaid && (
                  <>
                    <p>Paid Amount: ৳ {hold.paymentAmount}</p>
                    <p>Payment Date: {formatDate(hold.paidAt)}</p>
                    <h3 className="payment-success">✓ ePayment Success</h3>
                  </>
                )}

                {isPending && (
                  <div className="payment-section">
                    <h4>Admission Fee Payment</h4>

                    <p>
                      Required Amount: <strong>৳500</strong>
                    </p>

                    <label>Enter Payment Amount (BDT)</label>

                    <input
                      type="number"
                      min="1"
                      placeholder="Enter amount"
                      value={paymentAmounts[hold.id] ?? ""}
                      onChange={(e) =>
                        setPaymentAmounts((previous) => ({
                          ...previous,
                          [hold.id]: e.target.value
                        }))
                      }
                    />

                    <button
                      disabled={payingHoldId === hold.id}
                      onClick={() => handlePayment(hold.id)}
                    >
                      {payingHoldId === hold.id ? "Processing..." : "Submit Payment"}
                    </button>

                    <button
                      onClick={() => handleCancel(hold)}
                    >
                      Cancel Hold
                    </button>
                  </div>
                )}

                {hold.status === "confirmed" && isPaid && (
                  <p className="success-message">
                    Admission confirmed successfully.
                  </p>
                )}

                {hold.status === "confirmed" && !isPaid && (
                  <p className="error-message">
                    Admission is confirmed without payment. Please contact the administrator.
                  </p>
                )}

                {hold.status === "cancelled" && (
                  <p className="error-message">
                    This application has been cancelled.
                  </p>
                )}

                {expired && (
                  <p className="error-message">
                    This application has expired. Payment and cancellation are disabled. Please apply again.
                  </p>
                )}
              </div>
            );
          })}
        </section>
      </main>

      <footer className="app-footer">
        <p>School Admission System © 2026</p>
        <p>Online School Admission Portal</p>
      </footer>
    </div>
  );
}

export default App;
