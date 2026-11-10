# School Admission System

A web-based school admission management system that allows parents or guardians to register students, view available classes and shifts, reserve seats temporarily, and confirm admission.

## Technology Stack

### Backend
- C#
- ASP.NET Core Web API (.NET 8)
- Entity Framework Core
- PostgreSQL

### Frontend
- React 18
- JavaScript
- Vite

### Deployment
- Docker
- Docker Compose

## Features

- Student registration using Birth Registration Number.
- Create and manage school classes.
- Create multiple shifts for each class.
- Configure seat capacity separately for each shift.
- First-come, first-served admission process.
- Temporary seat reservation for 10 minutes.
- Confirm or cancel admission holds.
- Automatic hold expiration.
- View previous and current applications.
- Prevent duplicate active applications.
- Prevent seat overbooking through database-level locking and constraints.
- Persistent PostgreSQL database storage.

## Prerequisites

- Docker Desktop
- Docker Compose

No separate .NET SDK, Node.js, or PostgreSQL installation is required to run the application using Docker.

## Run the Application

Clone the repository:

```bash
git clone https://github.com/arifkross/SchoolAdmissionSystem
cd SchoolAdmissionSystem
```

Build and start all services:

```bash
docker compose up --build
```

Open the application:

**Frontend:** http://localhost:8080

**Backend API:** http://localhost:5154

Stop the application:

```bash
docker compose down
```

To stop the application without deleting database data, use the command above. PostgreSQL data is stored in a Docker volume.

## Configuration

The temporary hold duration can be configured using:

```env
HOLD_DURATION_SECONDS=600
```

The default duration is 600 seconds (10 minutes).

## Main API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/Students` | Register a student |
| GET | `/api/Students/{birthRegistrationNumber}` | Get student information |
| POST | `/classes` | Create a class |
| GET | `/classes` | Get all classes |
| GET | `/classes/{classId}` | Get class details |
| POST | `/classes/{classId}/shifts` | Create a class shift |
| POST | `/classes/{classId}/holds` | Create a temporary admission hold |
| GET | `/holds/{holdId}` | Get hold details |
| POST | `/holds/{holdId}/confirm` | Confirm admission |
| DELETE | `/holds/{holdId}` | Cancel a pending hold |
| GET | `/me/holds` | Get the student's applications |

Student-specific endpoints require the following HTTP header:

```http
X-Student-Id: <birth-registration-number>
```

## Admission Workflow

1. A parent or guardian registers the student.
2. The parent selects a class and shift.
3. The system temporarily reserves one seat.
4. The parent must confirm the admission before the hold expires.
5. If the hold expires or is cancelled, the reserved seat is released.
6. Confirmed admissions permanently occupy a seat.

## Concurrency and Seat Management

The backend uses PostgreSQL row-level locking and database constraints to protect seat availability during simultaneous admission requests.

The system ensures that:

- Held seats and confirmed seats never exceed total capacity.
- A student cannot have multiple active applications for the same class and shift.
- Repeated confirmation requests do not increase confirmed seat counts.
- Cancelled and expired holds release reserved seats.

## Project Structure

```text
SchoolAdmissionSystem/
├── backend/
│   ├── Controllers/
│   ├── Data/
│   ├── Models/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml
├── README.md
├── ASSUMPTIONS.md
└── AI_USAGE.md
```