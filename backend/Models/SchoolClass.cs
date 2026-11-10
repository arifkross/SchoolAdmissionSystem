
using System.ComponentModel.DataAnnotations;

namespace backend.Models
{
    public class SchoolClass
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        public List<ClassShift> Shifts { get; set; } = new();
    }
}
