
using System.ComponentModel.DataAnnotations;

namespace backend.Models
{
    public class Student
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(20)]
        public string BirthRegistrationNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        public DateTime DateOfBirth { get; set; }

        [Required]
        [MaxLength(100)]
        public string GuardianName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string GuardianPhone { get; set; } = string.Empty;
    }
}
