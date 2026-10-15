using Loop.Api.Models;

namespace Loop.Api.Contracts;

public record CreateUserRequest(string Name, string Email, UserRole Role);
public record AvailabilityRequest(DateOnly? SpecificDate, DayOfWeek? DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);
public record SaveSpotRequest(int OwnerId, string Title, string Address, string Description, decimal Latitude, decimal Longitude, PricingType PricingType, decimal Price, List<AvailabilityRequest> Availabilities);
public record CreateBookingRequest(int ParkingSpotId, int DriverId, DateTime StartsAtUtc, DateTime EndsAtUtc);

public record SpotResponse(int Id, int OwnerId, string OwnerName, string Title, string Address, string Description, decimal Latitude, decimal Longitude, PricingType PricingType, decimal Price, bool IsActive, List<AvailabilityResponse> Availabilities);
public record AvailabilityResponse(int Id, DateOnly? SpecificDate, DayOfWeek? DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);
public record BookingResponse(int Id, int ParkingSpotId, string SpotTitle, int DriverId, string DriverName, DateTime StartsAtUtc, DateTime EndsAtUtc, decimal Total, BookingStatus Status, DateTime CreatedAtUtc);
