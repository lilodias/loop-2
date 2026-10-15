namespace Loop.Api.Models;

public enum UserRole { Driver, Owner, Admin }
public enum PricingType { Hourly, Daily, Fixed }
public enum BookingStatus { Confirmed, Cancelled }

public class AppUser
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public UserRole Role { get; set; }
    public List<ParkingSpot> Spots { get; set; } = [];
    public List<Booking> Bookings { get; set; } = [];
}

public class ParkingSpot
{
    public int Id { get; set; }
    public int OwnerId { get; set; }
    public AppUser Owner { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Address { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public PricingType PricingType { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Availability> Availabilities { get; set; } = [];
    public List<Booking> Bookings { get; set; } = [];
}

public class Availability
{
    public int Id { get; set; }
    public int ParkingSpotId { get; set; }
    public ParkingSpot ParkingSpot { get; set; } = null!;
    public DateOnly? SpecificDate { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}

public class Booking
{
    public int Id { get; set; }
    public int ParkingSpotId { get; set; }
    public ParkingSpot ParkingSpot { get; set; } = null!;
    public int DriverId { get; set; }
    public AppUser Driver { get; set; } = null!;
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public decimal Total { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Confirmed;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
