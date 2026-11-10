
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    public class HoldsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public HoldsController(
            ApplicationDbContext context,
            IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        private const decimal AdmissionFee = 500m;

        private int HoldDurationSeconds =>
            int.TryParse(
                _configuration["HOLD_DURATION_SECONDS"],
                out int seconds) && seconds > 0
                ? seconds
                : 600;

        // POST /holds
        [HttpPost("/holds")]
        public async Task<IActionResult> CreateHold(
            [FromBody] CreateHoldRequest request,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            return await CreateHoldInternal(
                request.ClassShiftId,
                null,
                studentId);
        }

        // POST /classes/{classId}/holds
        [HttpPost("/classes/{classId:guid}/holds")]
        public async Task<IActionResult> CreateClassHold(
            Guid classId,
            [FromBody] CreateHoldRequest request,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            return await CreateHoldInternal(
                request.ClassShiftId,
                classId,
                studentId);
        }

        private async Task<IActionResult> CreateHoldInternal(
            Guid shiftId,
            Guid? classId,
            string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            studentId = studentId.Trim();

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId);

            if (student == null)
                return NotFound(new { message = "Student not found." });

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            var shift = await _context.ClassShifts
                .FromSqlInterpolated(
                    $"SELECT * FROM \"ClassShifts\" WHERE \"Id\" = {shiftId} FOR UPDATE")
                .FirstOrDefaultAsync();

            if (shift == null ||
                (classId.HasValue && shift.SchoolClassId != classId.Value))
            {
                return NotFound(new { message = "Class shift not found." });
            }

            var now = DateTime.UtcNow;

            var expiredHolds = await _context.AdmissionHolds
                .Where(h =>
                    h.ClassShiftId == shiftId &&
                    h.Status == HoldStatus.Pending &&
                    h.ExpiresAt <= now)
                .ToListAsync();

            foreach (var expired in expiredHolds)
            {
                expired.Status = HoldStatus.Expired;
                shift.HeldSeats = Math.Max(0, shift.HeldSeats - 1);
            }

            var existingHold = await _context.AdmissionHolds
                .FirstOrDefaultAsync(h =>
                    h.StudentId == student.Id &&
                    h.ClassShiftId == shiftId &&
                    (h.Status == HoldStatus.Pending ||
                     h.Status == HoldStatus.Confirmed));

            if (existingHold != null)
            {
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Conflict(new
                {
                    message = "You already have an active application for this class and shift."
                });
            }

            if (shift.HeldSeats + shift.ConfirmedSeats >= shift.TotalSeats)
            {
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Conflict(new { message = "No seats available." });
            }

            var hold = new AdmissionHold
            {
                Id = Guid.NewGuid(),
                StudentId = student.Id,
                ClassShiftId = shiftId,
                CreatedAt = now,
                ExpiresAt = now.AddSeconds(HoldDurationSeconds),
                Status = HoldStatus.Pending
            };

            shift.HeldSeats++;

            _context.AdmissionHolds.Add(hold);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message = "Seat held successfully.",
                holdId = hold.Id,
                expiresAt = hold.ExpiresAt,
                status = hold.Status.ToString()
            });
        }

        // GET /holds/{holdId}
        [HttpGet("/holds/{holdId:guid}")]
        public async Task<IActionResult> GetHold(
            Guid holdId,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId.Trim());

            if (student == null)
                return NotFound(new { message = "Student not found." });

            var hold = await _context.AdmissionHolds
                .Include(h => h.ClassShift)
                    .ThenInclude(s => s.SchoolClass)
                .FirstOrDefaultAsync(h =>
                    h.Id == holdId && h.StudentId == student.Id);

            if (hold == null)
                return NotFound(new { message = "Application not found." });

            await ExpireHoldIfNeeded(hold);

            return Ok(new
            {
                hold.Id,
                hold.Status,
                hold.CreatedAt,
                hold.ExpiresAt,
                hold.PaymentStatus,
                hold.PaymentAmount,
                hold.PaidAt,
                ClassName = hold.ClassShift.SchoolClass.Name,
                ShiftName = hold.ClassShift.ShiftName
            });
        }

        // POST /holds/{holdId}/confirm
        [HttpPost("/holds/{holdId:guid}/confirm")]
        public async Task<IActionResult> ConfirmHold(
            Guid holdId,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId.Trim());

            if (student == null)
                return NotFound(new { message = "Student not found." });

            var hold = await _context.AdmissionHolds.FirstOrDefaultAsync(
                h => h.Id == holdId && h.StudentId == student.Id);

            if (hold == null)
                return NotFound(new { message = "Application not found." });

            if (hold.Status == HoldStatus.Confirmed &&
                hold.PaymentStatus == "Paid")
            {
                return Ok(new { message = "Admission already confirmed." });
            }

            return Conflict(new
            {
                message = "Please complete the admission fee payment to confirm your admission."
            });
        }

        // POST /holds/{holdId}/pay
        [HttpPost("/holds/{holdId:guid}/pay")]
        public async Task<IActionResult> PayAdmissionFee(
            Guid holdId,
            [FromBody] PaymentRequest request,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            if (request == null || request.Amount != AdmissionFee)
                return BadRequest(new
                {
                    message = $"Admission fee must be exactly {AdmissionFee}."
                });

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId.Trim());

            if (student == null)
                return NotFound(new { message = "Student not found." });

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            var hold = await _context.AdmissionHolds.FirstOrDefaultAsync(
                h => h.Id == holdId && h.StudentId == student.Id);

            if (hold == null)
                return NotFound(new { message = "Application not found." });

            if (hold.Status == HoldStatus.Confirmed &&
                hold.PaymentStatus == "Paid")
            {
                await transaction.CommitAsync();
                return Ok(new { message = "Payment already completed." });
            }

            var shift = await _context.ClassShifts
                .FromSqlInterpolated(
                    $"SELECT * FROM \"ClassShifts\" WHERE \"Id\" = {hold.ClassShiftId} FOR UPDATE")
                .FirstOrDefaultAsync();

            if (shift == null)
                return NotFound(new { message = "Class shift not found." });

            if (hold.Status != HoldStatus.Pending)
                return Conflict(new { message = "This application is no longer pending." });

            if (hold.ExpiresAt <= DateTime.UtcNow)
            {
                hold.Status = HoldStatus.Expired;
                shift.HeldSeats = Math.Max(0, shift.HeldSeats - 1);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Conflict(new { message = "Your seat hold has expired." });
            }

            shift.HeldSeats = Math.Max(0, shift.HeldSeats - 1);
            shift.ConfirmedSeats++;

            hold.Status = HoldStatus.Confirmed;
            hold.PaymentStatus = "Paid";
            hold.PaymentAmount = AdmissionFee;
            hold.PaidAt = DateTime.UtcNow;
            hold.ConfirmedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message = "ePayment Success",
                paymentStatus = hold.PaymentStatus,
                amount = hold.PaymentAmount,
                paidAt = hold.PaidAt
            });
        }

        // DELETE /holds/{holdId}
        [HttpDelete("/holds/{holdId:guid}")]
        public async Task<IActionResult> CancelHold(
            Guid holdId,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId.Trim());

            if (student == null)
                return NotFound(new { message = "Student not found." });

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            var hold = await _context.AdmissionHolds.FirstOrDefaultAsync(
                h => h.Id == holdId && h.StudentId == student.Id);

            if (hold == null)
                return NotFound(new { message = "Application not found." });

            if (hold.Status != HoldStatus.Pending)
                return Conflict(new { message = "Only pending applications can be cancelled." });

            var shift = await _context.ClassShifts
                .FromSqlInterpolated(
                    $"SELECT * FROM \"ClassShifts\" WHERE \"Id\" = {hold.ClassShiftId} FOR UPDATE")
                .FirstOrDefaultAsync();

            if (shift == null)
                return NotFound(new { message = "Class shift not found." });

            hold.Status = HoldStatus.Cancelled;
            shift.HeldSeats = Math.Max(0, shift.HeldSeats - 1);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = "Application cancelled successfully." });
        }

        // GET /me/holds
        [HttpGet("/me/holds")]
        public async Task<IActionResult> GetMyHolds(
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId.Trim());

            if (student == null)
                return NotFound(new { message = "Student not found." });

            var holds = await _context.AdmissionHolds
                .Include(h => h.ClassShift)
                    .ThenInclude(s => s.SchoolClass)
                .Where(h => h.StudentId == student.Id)
                .OrderByDescending(h => h.CreatedAt)
                .ToListAsync();

            foreach (var hold in holds)
            {
                await ExpireHoldIfNeeded(hold);
            }

            return Ok(holds.Select(h => new
            {
                h.Id,
                h.Status,
                h.CreatedAt,
                h.ExpiresAt,
                h.PaymentStatus,
                h.PaymentAmount,
                h.PaidAt,
                ClassName = h.ClassShift.SchoolClass.Name,
                ShiftName = h.ClassShift.ShiftName
            }));
        }

        private async Task ExpireHoldIfNeeded(AdmissionHold hold)
        {
            if (hold.Status != HoldStatus.Pending ||
                hold.ExpiresAt > DateTime.UtcNow)
                return;

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            var shift = await _context.ClassShifts
                .FromSqlInterpolated(
                    $"SELECT * FROM \"ClassShifts\" WHERE \"Id\" = {hold.ClassShiftId} FOR UPDATE")
                .FirstOrDefaultAsync();

            if (shift != null && hold.Status == HoldStatus.Pending)
            {
                hold.Status = HoldStatus.Expired;
                shift.HeldSeats = Math.Max(0, shift.HeldSeats - 1);

                await _context.SaveChangesAsync();
            }

            await transaction.CommitAsync();
        }
    }

    public class CreateHoldRequest
    {
        public Guid ClassShiftId { get; set; }
    }

    public class PaymentRequest
    {
        public decimal Amount { get; set; }
    }
}
