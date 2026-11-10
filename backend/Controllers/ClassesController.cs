
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace backend.Controllers
{
    [ApiController]
    [Route("classes")]
    public class ClassesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ClassesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Create a new class
        [HttpPost]
        public async Task<IActionResult> CreateClass(CreateClassRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Class name is required." });

            var schoolClass = new SchoolClass
            {
                Name = request.Name.Trim()
            };

            _context.SchoolClasses.Add(schoolClass);
            await _context.SaveChangesAsync();

            return Ok(schoolClass);
        }

        // Get all classes with their shifts
        [HttpGet]
        public async Task<IActionResult> GetClasses()
        {
            var classes = await _context.SchoolClasses
                .Include(c => c.Shifts)
                .ToListAsync();

            return Ok(classes);
        }

        // Get a single class with its shifts
        [HttpGet("{classId:guid}")]
        public async Task<IActionResult> GetClass(Guid classId)
        {
            var schoolClass = await _context.SchoolClasses
                .Include(c => c.Shifts)
                .FirstOrDefaultAsync(c => c.Id == classId);

            if (schoolClass == null)
                return NotFound(new { message = "Class not found." });

            return Ok(schoolClass);
        }

        // Add a shift to a class
        [HttpPost("{classId:guid}/shifts")]
        public async Task<IActionResult> AddShift(
            Guid classId,
            CreateShiftRequest request)
        {
            var schoolClass = await _context.SchoolClasses
                .FirstOrDefaultAsync(c => c.Id == classId);

            if (schoolClass == null)
                return NotFound(new { message = "Class not found." });

            if (string.IsNullOrWhiteSpace(request.ShiftName))
                return BadRequest(new { message = "Shift name is required." });

            if (request.TotalSeats < 1)
                return BadRequest(new { message = "Seat capacity must be at least 1." });

            bool exists = await _context.ClassShifts.AnyAsync(s =>
                s.SchoolClassId == classId &&
                s.ShiftName == request.ShiftName.Trim());

            if (exists)
                return Conflict(new { message = "This shift already exists." });

            var shift = new ClassShift
            {
                SchoolClassId = classId,
                ShiftName = request.ShiftName.Trim(),
                TotalSeats = request.TotalSeats
            };

            _context.ClassShifts.Add(shift);
            await _context.SaveChangesAsync();

            return Ok(shift);
        }
    }

    public class CreateClassRequest
    {
        [Required]
        public string Name { get; set; } = string.Empty;
    }

    public class CreateShiftRequest
    {
        [Required]
        public string ShiftName { get; set; } = string.Empty;

        [Range(1, 1000)]
        public int TotalSeats { get; set; }
    }
}
