
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("holds")]
    public class HoldsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public HoldsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // POST /holds
        [HttpPost]
        public async Task<IActionResult> CreateHold(
            [FromBody] CreateHoldRequest request,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            return await CreateHoldInternal(request, studentId, null);
        }

        // POST /classes/{classId}/holds
        [HttpPost("/classes/{classId:guid}/holds")]
        public async Task<IActionResult> CreateClassHold(
            [FromRoute] Guid classId,
            [FromBody] CreateHoldRequest request,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            return await CreateHoldInternal(request, studentId, classId);
        }

        private async Task<IActionResult> CreateHoldInternal(
            CreateHoldRequest request,
            string studentId,
            Guid? classId)
        {
            if (request == null || request.ClassShiftId == Guid.Empty)
                return BadRequest(new { message = "Valid class shift ID is required." });

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
                .FromSqlInterpolated($"""
                    SELECT * FROM "ClassShifts"
                    WHERE "Id" = {request.ClassShiftId}
                    FOR UPDATE
                    """)
                .FirstOrDefaultAsync();

            if (shift == null)
                return NotFound(new { message = "Class shift not found." });

            if (classId.HasValue && shift.SchoolClassId != classId.Value)
                return NotFound(new { message = "Class shift not found in this class." });

            var now = DateTime.UtcNow;

            // Expire old pending holds for this shift
            var expiredHolds = await _context.AdmissionHolds
                .Where(h => h.ClassShiftId == shift.Id
                    && h.Status == HoldStatus.Pending
                    && h.ExpiresAt <= now)
                .ToListAsync();

            foreach (var expired in expiredHolds)
                expired.Status = HoldStatus.Expired;

            shift.HeldSeats = Math.Max(
                0, shift.HeldSeats - expiredHolds.Count);

            // Check duplicate application
            bool alreadyApplied = await _context.AdmissionHolds.AnyAsync(
                h => h.StudentId == student.Id
                && h.ClassShiftId == shift.Id
                && (h.Status == HoldStatus.Pending
                    || h.Status == HoldStatus.Confirmed));

            if (alreadyApplied)
            {
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Conflict(new
                {
                    message = "You already have an active application."
                });
            }

            // Check seat availability
            if (shift.HeldSeats + shift.ConfirmedSeats >= shift.TotalSeats)
            {
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Conflict(new { message = "No seats available." });
            }

            int duration = int.TryParse(
                Environment.GetEnvironmentVariable("HOLD_DURATION_SECONDS"),
                out int seconds) ? seconds : 600;

            if (duration <= 0)
                duration = 600;

            var hold = new AdmissionHold
            {
                StudentId = student.Id,
                ClassShiftId = shift.Id,
                CreatedAt = now,
                ExpiresAt = now.AddSeconds(duration),
                Status = HoldStatus.Pending
            };

            shift.HeldSeats++;
            _context.AdmissionHolds.Add(hold);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                hold.Id,
                hold.Status,
                hold.CreatedAt,
                hold.ExpiresAt,
                message = "Seat temporarily reserved."
            });
        }

        // GET /holds/{holdId}
        [HttpGet("{holdId:guid}")]
        public async Task<IActionResult> GetHold(
            Guid holdId,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            studentId = studentId.Trim();

            var hold = await _context.AdmissionHolds
                .Include(h => h.Student)
                .Include(h => h.ClassShift)
                .ThenInclude(s => s!.SchoolClass)
                .FirstOrDefaultAsync(h => h.Id == holdId);

            if (hold == null ||
                hold.Student == null ||
                hold.Student.BirthRegistrationNumber != studentId)
                return NotFound(new { message = "Hold not found." });

            if (hold.Status == HoldStatus.Pending &&
                hold.ExpiresAt <= DateTime.UtcNow)
            {
                await using var transaction =
                    await _context.Database.BeginTransactionAsync();

                var shift = await _context.ClassShifts
                    .FromSqlInterpolated($"""
                        SELECT * FROM "ClassShifts"
                        WHERE "Id" = {hold.ClassShiftId}
                        FOR UPDATE
                        """)
                    .FirstOrDefaultAsync();

                if (shift != null)
                {
                    var currentHold = await _context.AdmissionHolds
                        .FirstOrDefaultAsync(h => h.Id == holdId);

                    if (currentHold != null &&
                        currentHold.Status == HoldStatus.Pending &&
                        currentHold.ExpiresAt <= DateTime.UtcNow)
                    {
                        currentHold.Status = HoldStatus.Expired;
                        shift.HeldSeats = Math.Max(0, shift.HeldSeats - 1);

                        await _context.SaveChangesAsync();
                    }
                }

                await transaction.CommitAsync();
            }

            var updatedHold = await _context.AdmissionHolds
                .FirstAsync(h => h.Id == holdId);

            return Ok(new
            {
                holdId = hold.Id,
                className = hold.ClassShift?.SchoolClass?.Name ?? "Unknown Class",
                shiftName = hold.ClassShift?.ShiftName ?? "Unknown Shift",
                status = updatedHold.Status.ToString().ToUpper(),
                expiresAt = hold.ExpiresAt
            });
        }

        // POST /holds/{holdId}/confirm
        [HttpPost("{holdId:guid}/confirm")]
        public async Task<IActionResult> ConfirmHold(
            Guid holdId,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            studentId = studentId.Trim();

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId);

            if (student == null)
                return NotFound(new { message = "Student not found." });

            var holdInfo = await _context.AdmissionHolds
                .Where(h => h.Id == holdId)
                .Select(h => new { h.ClassShiftId, h.StudentId })
                .FirstOrDefaultAsync();

            if (holdInfo == null || holdInfo.StudentId != student.Id)
                return NotFound(new { message = "Hold not found." });

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            var shift = await _context.ClassShifts
                .FromSqlInterpolated($"""
                    SELECT * FROM "ClassShifts"
                    WHERE "Id" = {holdInfo.ClassShiftId}
                    FOR UPDATE
                    """)
                .FirstOrDefaultAsync();

            var hold = await _context.AdmissionHolds
                .FirstOrDefaultAsync(h => h.Id == holdId);

            if (shift == null || hold == null ||
                hold.StudentId != student.Id)
                return NotFound(new { message = "Hold not found." });

            // Idempotent confirmation
            if (hold.Status == HoldStatus.Confirmed)
            {
                await transaction.CommitAsync();
                return Ok(new { message = "Admission already confirmed." });
            }

            if (hold.Status != HoldStatus.Pending)
                return Conflict(new { message = "This hold is no longer active." });

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
            hold.ConfirmedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = "Admission confirmed successfully." });
        }

        // DELETE /holds/{holdId}
        [HttpDelete("{holdId:guid}")]
        public async Task<IActionResult> CancelHold(
            Guid holdId,
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            studentId = studentId.Trim();

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId);

            if (student == null)
                return NotFound(new { message = "Student not found." });

            var holdInfo = await _context.AdmissionHolds
                .Where(h => h.Id == holdId)
                .Select(h => new { h.ClassShiftId, h.StudentId })
                .FirstOrDefaultAsync();

            if (holdInfo == null || holdInfo.StudentId != student.Id)
                return NotFound(new { message = "Hold not found." });

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            var shift = await _context.ClassShifts
                .FromSqlInterpolated($"""
                    SELECT * FROM "ClassShifts"
                    WHERE "Id" = {holdInfo.ClassShiftId}
                    FOR UPDATE
                    """)
                .FirstOrDefaultAsync();

            var hold = await _context.AdmissionHolds
                .FirstOrDefaultAsync(h => h.Id == holdId);

            if (shift == null || hold == null ||
                hold.StudentId != student.Id)
                return NotFound(new { message = "Hold not found." });

            if (hold.Status != HoldStatus.Pending)
                return Conflict(new { message = "This hold cannot be cancelled." });

            hold.Status = HoldStatus.Cancelled;
            shift.HeldSeats = Math.Max(0, shift.HeldSeats - 1);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = "Hold cancelled successfully." });
        }

        // GET /me/holds
        [HttpGet("/me/holds")]
        public async Task<IActionResult> GetMyHolds(
            [FromHeader(Name = "X-Student-Id")] string studentId)
        {
            if (string.IsNullOrWhiteSpace(studentId))
                return BadRequest(new { message = "Student ID is required." });

            studentId = studentId.Trim();

            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == studentId);

            if (student == null)
                return NotFound(new { message = "Student not found." });

            var now = DateTime.UtcNow;

            // Find expired pending holds
            var expiredShiftIds = await _context.AdmissionHolds
                .Where(h => h.StudentId == student.Id
                    && h.Status == HoldStatus.Pending
                    && h.ExpiresAt <= now)
                .Select(h => h.ClassShiftId)
                .Distinct()
                .OrderBy(id => id)
                .ToListAsync();

            // Release expired seats
            foreach (var shiftId in expiredShiftIds)
            {
                await using var transaction =
                    await _context.Database.BeginTransactionAsync();

                var shift = await _context.ClassShifts
                    .FromSqlInterpolated($"""
                        SELECT * FROM "ClassShifts"
                        WHERE "Id" = {shiftId}
                        FOR UPDATE
                        """)
                    .FirstOrDefaultAsync();

                if (shift != null)
                {
                    var expiredHolds = await _context.AdmissionHolds
                        .Where(h => h.ClassShiftId == shiftId
                            && h.Status == HoldStatus.Pending
                            && h.ExpiresAt <= DateTime.UtcNow)
                        .ToListAsync();

                    foreach (var expired in expiredHolds)
                        expired.Status = HoldStatus.Expired;

                    shift.HeldSeats = Math.Max(
                        0,
                        shift.HeldSeats - expiredHolds.Count
                    );

                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
            }

            // Load all applications of this student
            var holds = await _context.AdmissionHolds
                .Where(h => h.StudentId == student.Id)
                .Include(h => h.ClassShift)
                .ThenInclude(s => s!.SchoolClass)
                .ToListAsync();

            // Return a simple response for React
            var result = holds.Select(h => new
            {
                Id = h.Id,
                StudentId = h.StudentId,
                ClassShiftId = h.ClassShiftId,
                Status = h.Status.ToString(),
                CreatedAt = h.CreatedAt,
                ExpiresAt = h.ExpiresAt,
                ConfirmedAt = h.ConfirmedAt,
                ClassName = h.ClassShift?.SchoolClass?.Name ?? "Unknown Class",
                ShiftName = h.ClassShift?.ShiftName ?? "Unknown Shift"
            }).ToList();

            return Ok(result);
        }
    }

    public class CreateHoldRequest
    {
        public Guid ClassShiftId { get; set; }
    }
}
