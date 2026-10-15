using Loop.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Loop.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<ParkingSpot> Spots => Set<ParkingSpot>();
    public DbSet<Availability> Availabilities => Set<Availability>();
    public DbSet<Booking> Bookings => Set<Booking>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>().HasIndex(x => x.Email).IsUnique();
        modelBuilder.Entity<ParkingSpot>().Property(x => x.Price).HasPrecision(10, 2);
        modelBuilder.Entity<ParkingSpot>().Property(x => x.Latitude).HasPrecision(9, 6);
        modelBuilder.Entity<ParkingSpot>().Property(x => x.Longitude).HasPrecision(9, 6);
        modelBuilder.Entity<Booking>().Property(x => x.Total).HasPrecision(10, 2);
        modelBuilder.Entity<Booking>().HasIndex(x => new { x.ParkingSpotId, x.StartsAtUtc, x.EndsAtUtc });
        modelBuilder.Entity<AppUser>().HasMany(x => x.Spots).WithOne(x => x.Owner).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AppUser>().HasMany(x => x.Bookings).WithOne(x => x.Driver).HasForeignKey(x => x.DriverId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ParkingSpot>().HasMany(x => x.Bookings).WithOne(x => x.ParkingSpot).HasForeignKey(x => x.ParkingSpotId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ParkingSpot>().HasMany(x => x.Availabilities).WithOne(x => x.ParkingSpot).HasForeignKey(x => x.ParkingSpotId).OnDelete(DeleteBehavior.Cascade);
    }
}
