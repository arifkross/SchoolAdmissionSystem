
namespace backend.Models
{
    public enum HoldStatus
    {
        Pending,
        Confirmed,
        Cancelled,
        Expired
    }

    public class AdmissionHold
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid StudentId { get; set; }

        public Student? Student { get; set; }

        public Guid ClassShiftId { get; set; }

        public ClassShift? ClassShift { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public DateTime? ConfirmedAt { get; set; }

        public HoldStatus Status { get; set; } = HoldStatus.Pending;
    }
}
