
using System.ComponentModel.DataAnnotations;

namespace backend.Models
{
    public class ClassShift
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid SchoolClassId { get; set; }

        public SchoolClass? SchoolClass { get; set; }

        [Required]
        [MaxLength(30)]
        public string ShiftName { get; set; } = string.Empty;

        [Range(1, 1000)]
        public int TotalSeats { get; set; }

        public int HeldSeats { get; set; } = 0;

        public int ConfirmedSeats { get; set; } = 0;
    }
}
