# Assumptions

The following assumptions were made while developing the School Admission System:

1. **Student Identification:** Each student is uniquely identified by their Birth Registration Number.

2. **Student Registration:** A student must complete registration before applying for admission.

3. **Class and Shift:** A school class can have multiple shifts, such as Morning, Day, and Evening.

4. **Separate Seat Capacity:** Each shift has its own total seat capacity. Seats are managed independently for each class and shift.

5. **Admission Policy:** Admission follows a first-come, first-served policy. No lottery system is used.

6. **Temporary Seat Reservation:** When a student applies, one seat is temporarily held for 10 minutes by default.

7. **Hold Confirmation:** Students must confirm their admission before the hold expires.

8. **Expired Holds:** If a student does not confirm within the hold duration, the application expires and the reserved seat is released.

9. **Cancellation:** A student can cancel a pending application. The reserved seat is then released.

10. **Active Application Restriction:** A student cannot have more than one active application for the same class and shift. Cancelled or expired applications do not count as active.

11. **Confirmation Idempotency:** Confirming an already confirmed application does not create another admission or increase the confirmed seat count.

12. **Seat Availability:** Held seats and confirmed seats together must never exceed the total capacity of a shift.

13. **Student Access:** For this assignment, the Birth Registration Number is used through the `X-Student-Id` request header to identify the student. Full authentication and authorization are outside the assignment scope.

14. **Data Persistence:** PostgreSQL is used to persist student, class, shift, and admission application data across application restarts.

15. **Hold Duration Configuration:** The hold duration is configurable through the `HOLD_DURATION_SECONDS` environment variable, with a default value of 600 seconds.