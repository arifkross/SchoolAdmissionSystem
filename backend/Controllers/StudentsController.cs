
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StudentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public StudentsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Register a new student
        [HttpPost]
        public async Task<IActionResult> CreateStudent(Student student)
        {
            bool exists = await _context.Students.AnyAsync(
                s => s.BirthRegistrationNumber ==
                student.BirthRegistrationNumber
            );

            if (exists)
            {
                return Conflict(new
                {
                    message = "This student is already registered."
                });
            }

            student.Id = Guid.NewGuid();

            _context.Students.Add(student);
            student.DateOfBirth = DateTime.SpecifyKind(
    student.DateOfBirth,
    DateTimeKind.Utc
);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetStudent),
                new { birthRegistrationNumber = student.BirthRegistrationNumber },
                student
            );
        }

        // Find student by birth registration number
        [HttpGet("{birthRegistrationNumber}")]
        public async Task<IActionResult> GetStudent(
            string birthRegistrationNumber)
        {
            var student = await _context.Students.FirstOrDefaultAsync(
                s => s.BirthRegistrationNumber == birthRegistrationNumber
            );

            if (student == null)
            {
                return NotFound(new
                {
                    message = "Student not found."
                });
            }

            return Ok(student);
        }
    }
}
