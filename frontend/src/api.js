
const API_BASE_URL = "http://localhost:5154";

export async function getClasses() {
  const response = await fetch(`${API_BASE_URL}/classes`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load classes");
  }

  return data;
}

export async function registerStudent(student) {
  const response = await fetch(`${API_BASE_URL}/api/Students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(student),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Registration failed");
  }

  return data;
}

export async function createHold(classId, shiftId, studentId) {
  const response = await fetch(
    `${API_BASE_URL}/classes/${classId}/holds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Id": studentId,
      },
      body: JSON.stringify({
        classShiftId: shiftId,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Admission application failed");
  }

  return data;
}

export async function getMyHolds(studentId) {
  const response = await fetch(`${API_BASE_URL}/me/holds`, {
    headers: {
      "X-Student-Id": studentId,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load applications");
  }

  return data;
}

export async function confirmHold(holdId, studentId) {
  const response = await fetch(
    `${API_BASE_URL}/holds/${holdId}/confirm`,
    {
      method: "POST",
      headers: {
        "X-Student-Id": studentId,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Confirmation failed");
  }

  return data;
}

export async function cancelHold(holdId, studentId) {
  const response = await fetch(
    `${API_BASE_URL}/holds/${holdId}`,
    {
      method: "DELETE",
      headers: {
        "X-Student-Id": studentId,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Cancellation failed");
  }

  return data;
}
// Create a new class
export async function createClass(name) {
  const response = await fetch(`${API_BASE_URL}/classes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Class creation failed");
  }

  return data;
}

// Create a shift for a class
export async function createShift(classId, shiftName, totalSeats) {
  const response = await fetch(
    `${API_BASE_URL}/classes/${classId}/shifts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shiftName,
        totalSeats: Number(totalSeats),
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Shift creation failed");
  }

  return data;
}

export async function getAdmissionFee() {
  const response = await fetch(
    `${API_BASE_URL}/settings/admission-fee`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load admission fee");
  }

  return data;
}

export async function updateAdmissionFee(admissionFee) {
  const response = await fetch(
    `${API_BASE_URL}/settings/admission-fee`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        admissionFee: Number(admissionFee)
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update admission fee");
  }

  return data;
}
// Pay Admission Fee
export async function payAdmissionFee(holdId, studentId, amount) {
  const response = await fetch(
    `${API_BASE_URL}/holds/${holdId}/pay`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Id": studentId
      },
      body: JSON.stringify({
        amount: Number(amount)
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Payment failed");
  }

  return data;
}
