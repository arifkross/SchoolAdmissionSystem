
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }
        public DbSet<AdmissionSettings> AdmissionSettings { get; set; }

        public DbSet<Student> Students => Set<Student>();
        public DbSet<SchoolClass> SchoolClasses => Set<SchoolClass>();
        public DbSet<ClassShift> ClassShifts => Set<ClassShift>();
        public DbSet<AdmissionHold> AdmissionHolds => Set<AdmissionHold>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Student>()
                .HasIndex(s => s.BirthRegistrationNumber)
                .IsUnique();

            modelBuilder.Entity<ClassShift>()
                .HasIndex(s => new { s.SchoolClassId, s.ShiftName })
                .IsUnique();

            modelBuilder.Entity<ClassShift>()
                .ToTable(t => t.HasCheckConstraint(
                    "CK_ClassShift_SeatCount",
                    "\"TotalSeats\" >= 1 AND \"HeldSeats\" >= 0 AND \"ConfirmedSeats\" >= 0 AND \"HeldSeats\" + \"ConfirmedSeats\" <= \"TotalSeats\""
                ));

            modelBuilder.Entity<AdmissionHold>()
                .HasIndex(h => new { h.StudentId, h.ClassShiftId })
                .IsUnique()
                .HasFilter("\"Status\" IN (0, 1)");

            modelBuilder.Entity<AdmissionHold>()
                .HasOne(h => h.Student)
                .WithMany()
                .HasForeignKey(h => h.StudentId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AdmissionHold>()
                .HasOne(h => h.ClassShift)
                .WithMany()
                .HasForeignKey(h => h.ClassShiftId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
