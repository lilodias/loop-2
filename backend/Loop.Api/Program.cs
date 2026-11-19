using System.Data;
using System.Text.Json.Serialization;
using Loop.Api.Contracts;
using Loop.Api.Data;
using Loop.Api.Models;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddCors(options => options.AddPolicy("frontend", policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var invalidBody = context.Features.Get<IExceptionHandlerFeature>()?.Error is BadHttpRequestException;
    context.Response.StatusCode = invalidBody ? 400 : 500;
    await context.Response.WriteAsJsonAsync(new
    {
        error = invalidBody ? "Dados inválidos. Confira os campos enviados." : "Ocorreu um erro interno. Tente novamente."
    });
}));
app.UseCors("frontend");
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
    await SeedData.InitializeAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>());

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/users", async (AppDbContext db) =>
    Results.Ok(await db.Users.OrderBy(u => u.Id).Select(u => new { u.Id, u.Name, u.Email, u.Role }).ToListAsync()));

app.MapPost("/api/users", async (CreateUserRequest request, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@') ||
        request.Role is not (UserRole.Driver or UserRole.Owner))
        return Results.BadRequest(new { error = "Informe nome, e-mail válido e perfil." });
    var email = request.Email.Trim().ToLowerInvariant();
    if (await db.Users.AnyAsync(u => u.Email == email)) return Results.Conflict(new { error = "E-mail já cadastrado." });
    var user = new AppUser { Name = request.Name.Trim(), Email = email, Role = request.Role };
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Created($"/api/users/{user.Id}", new { user.Id, user.Name, user.Email, user.Role });
});

app.MapGet("/api/spots", async (AppDbContext db, bool includeInactive = false) =>
{
    var spots = await db.Spots.AsNoTracking().Include(s => s.Owner).Include(s => s.Availabilities)
        .Where(s => includeInactive || s.IsActive).OrderBy(s => s.Id).ToListAsync();
    return Results.Ok(spots.Select(ToSpotResponse));
});

app.MapGet("/api/spots/{id:int}", async (int id, AppDbContext db) =>
{
    var spot = await db.Spots.AsNoTracking().Include(s => s.Owner).Include(s => s.Availabilities).FirstOrDefaultAsync(s => s.Id == id);
    return spot is null ? Results.NotFound(new { error = "Vaga não encontrada." }) : Results.Ok(ToSpotResponse(spot));
});

app.MapPost("/api/spots", async (SaveSpotRequest request, AppDbContext db) =>
{
    var error = ValidateSpot(request);
    if (error is not null) return Results.BadRequest(new { error });
    var owner = await db.Users.FindAsync(request.OwnerId);
    if (owner?.Role != UserRole.Owner) return Results.BadRequest(new { error = "Selecione um proprietário válido." });
    var spot = new ParkingSpot();
    ApplySpot(spot, request);
    db.Spots.Add(spot);
    await db.SaveChangesAsync();
    return Results.Created($"/api/spots/{spot.Id}", ToCreatedSpotResponse(spot, owner.Name));
});

app.MapPut("/api/spots/{id:int}", async (int id, SaveSpotRequest request, AppDbContext db) =>
{
    var error = ValidateSpot(request);
    if (error is not null) return Results.BadRequest(new { error });
    var spot = await db.Spots.Include(s => s.Availabilities).FirstOrDefaultAsync(s => s.Id == id);
    if (spot is null || !spot.IsActive) return Results.NotFound(new { error = "Vaga não encontrada." });
    if (spot.OwnerId != request.OwnerId) return Results.BadRequest(new { error = "A vaga pertence a outro proprietário." });
    if (await db.Bookings.AnyAsync(b => b.ParkingSpotId == id && b.Status == BookingStatus.Confirmed && b.EndsAtUtc > DateTime.UtcNow))
        return Results.Conflict(new { error = "Não é possível alterar uma vaga com reservas futuras." });
    db.Availabilities.RemoveRange(spot.Availabilities);
    ApplySpot(spot, request);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapDelete("/api/spots/{id:int}", async (int id, int ownerId, AppDbContext db) =>
{
    var spot = await db.Spots.FindAsync(id);
    if (spot is null || !spot.IsActive) return Results.NotFound(new { error = "Vaga não encontrada." });
    if (spot.OwnerId != ownerId) return Results.BadRequest(new { error = "A vaga pertence a outro proprietário." });
    if (await db.Bookings.AnyAsync(b => b.ParkingSpotId == id && b.Status == BookingStatus.Confirmed && b.EndsAtUtc > DateTime.UtcNow))
        return Results.Conflict(new { error = "Cancele as reservas futuras antes de remover a vaga." });
    spot.IsActive = false;
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapGet("/api/bookings", async (AppDbContext db, int? driverId, int? ownerId) =>
{
    var query = db.Bookings.AsNoTracking().Include(b => b.Driver).Include(b => b.ParkingSpot).AsQueryable();
    if (driverId.HasValue) query = query.Where(b => b.DriverId == driverId.Value);
    if (ownerId.HasValue) query = query.Where(b => b.ParkingSpot.OwnerId == ownerId.Value);
    var bookings = await query.OrderByDescending(b => b.StartsAtUtc).ToListAsync();
    return Results.Ok(bookings.Select(ToBookingResponse));
});

app.MapPost("/api/bookings", async (CreateBookingRequest request, AppDbContext db) =>
{
    if (request.StartsAtUtc.Kind != DateTimeKind.Utc || request.EndsAtUtc.Kind != DateTimeKind.Utc ||
        request.StartsAtUtc < DateTime.UtcNow || request.EndsAtUtc <= request.StartsAtUtc ||
        request.EndsAtUtc - request.StartsAtUtc > TimeSpan.FromDays(30))
        return Results.BadRequest(new { error = "Informe um período futuro válido de até 30 dias, em UTC." });

    var driver = await db.Users.FindAsync(request.DriverId);
    if (driver?.Role != UserRole.Driver) return Results.BadRequest(new { error = "Selecione um motorista válido." });

    await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
    try
    {
        var spot = await db.Spots.Include(s => s.Availabilities)
            .FirstOrDefaultAsync(s => s.Id == request.ParkingSpotId && s.IsActive);
        if (spot is null) return Results.NotFound(new { error = "Vaga não encontrada." });
        if (!FitsAvailability(spot, request.StartsAtUtc, request.EndsAtUtc))
            return Results.BadRequest(new { error = "Período fora da disponibilidade da vaga." });

        var overlaps = await db.Bookings.AnyAsync(b => b.ParkingSpotId == spot.Id &&
            b.Status == BookingStatus.Confirmed && b.StartsAtUtc < request.EndsAtUtc && b.EndsAtUtc > request.StartsAtUtc);
        if (overlaps) return Results.Conflict(new { error = "A vaga já está reservada nesse período." });

        var duration = request.EndsAtUtc - request.StartsAtUtc;
        var total = spot.PricingType switch
        {
            PricingType.Hourly => Math.Ceiling((decimal)duration.TotalMinutes / 60) * spot.Price,
            PricingType.Daily => Math.Ceiling((decimal)duration.TotalMinutes / 1440) * spot.Price,
            _ => spot.Price
        };
        var booking = new Booking { ParkingSpotId = spot.Id, DriverId = driver.Id,
            StartsAtUtc = request.StartsAtUtc, EndsAtUtc = request.EndsAtUtc, Total = total };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        booking.Driver = driver;
        booking.ParkingSpot = spot;
        return Results.Created($"/api/bookings/{booking.Id}", ToBookingResponse(booking));
    }
    catch (PostgresException ex) when (ex.SqlState == "40001")
    {
        return Results.Conflict(new { error = "Outra reserva foi feita ao mesmo tempo. Atualize e tente novamente." });
    }
    catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "40001" })
    {
        return Results.Conflict(new { error = "Outra reserva foi feita ao mesmo tempo. Atualize e tente novamente." });
    }
});

app.MapDelete("/api/bookings/{id:int}", async (int id, int driverId, AppDbContext db) =>
{
    var booking = await db.Bookings.FindAsync(id);
    if (booking is null) return Results.NotFound(new { error = "Reserva não encontrada." });
    if (booking.DriverId != driverId) return Results.BadRequest(new { error = "A reserva pertence a outro motorista." });
    if (booking.Status == BookingStatus.Cancelled) return Results.BadRequest(new { error = "Reserva já cancelada." });
    if (booking.StartsAtUtc <= DateTime.UtcNow) return Results.BadRequest(new { error = "Não é possível cancelar uma reserva iniciada." });
    booking.Status = BookingStatus.Cancelled;
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();

static string? ValidateSpot(SaveSpotRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Address) ||
        request.Title.Length > 100 || request.Address.Length > 200)
        return "Informe título e endereço (máximo de 100 e 200 caracteres).";
    if (request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180 ||
        (request.Latitude == 0 && request.Longitude == 0)) return "Selecione uma localização válida no mapa.";
    if (request.Price <= 0 || !Enum.IsDefined(request.PricingType)) return "Informe modalidade e preço válidos.";
    if (request.Availabilities is null || request.Availabilities.Count == 0) return "Cadastre ao menos um horário disponível.";
    if (request.Availabilities.Any(a => (a.SpecificDate.HasValue == a.DayOfWeek.HasValue) ||
        a.EndTime <= a.StartTime || (a.DayOfWeek.HasValue && !Enum.IsDefined(a.DayOfWeek.Value))))
        return "Cada horário deve ter uma data ou dia da semana e início anterior ao fim.";
    return null;
}

static void ApplySpot(ParkingSpot spot, SaveSpotRequest request)
{
    spot.OwnerId = request.OwnerId;
    spot.Title = request.Title.Trim();
    spot.Address = request.Address.Trim();
    spot.Description = request.Description?.Trim() ?? "";
    spot.Latitude = request.Latitude;
    spot.Longitude = request.Longitude;
    spot.PricingType = request.PricingType;
    spot.Price = request.Price;
    spot.Availabilities = request.Availabilities.Select(a => new Availability
    { SpecificDate = a.SpecificDate, DayOfWeek = a.DayOfWeek, StartTime = a.StartTime, EndTime = a.EndTime }).ToList();
}

static bool FitsAvailability(ParkingSpot spot, DateTime startUtc, DateTime endUtc)
{
    var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
    var localStart = TimeZoneInfo.ConvertTimeFromUtc(startUtc, zone);
    var localEnd = TimeZoneInfo.ConvertTimeFromUtc(endUtc, zone);
    var cursor = localStart;
    while (cursor < localEnd)
    {
        var nextMidnight = cursor.Date.AddDays(1);
        var segmentEnd = localEnd < nextMidnight ? localEnd : nextMidnight;
        var date = DateOnly.FromDateTime(cursor);
        var windows = spot.Availabilities.Where(a => a.SpecificDate == date ||
            (!a.SpecificDate.HasValue && a.DayOfWeek == cursor.DayOfWeek))
            .OrderBy(a => a.StartTime).ToList();
        var coveredUntil = cursor.TimeOfDay;
        var requiredUntil = segmentEnd == nextMidnight ? TimeSpan.FromDays(1) : segmentEnd.TimeOfDay;
        foreach (var window in windows)
        {
            if (window.StartTime.ToTimeSpan() > coveredUntil) break;
            var windowEnd = window.EndTime.ToTimeSpan();
            if (windowEnd == new TimeSpan(23, 59, 0)) windowEnd = TimeSpan.FromDays(1);
            if (windowEnd > coveredUntil) coveredUntil = windowEnd;
        }
        if (coveredUntil < requiredUntil) return false;
        cursor = segmentEnd;
    }
    return true;
}

static SpotResponse ToSpotResponse(ParkingSpot spot) => ToCreatedSpotResponse(spot, spot.Owner.Name);
static SpotResponse ToCreatedSpotResponse(ParkingSpot spot, string ownerName) =>
    new(spot.Id, spot.OwnerId, ownerName, spot.Title, spot.Address, spot.Description,
        spot.Latitude, spot.Longitude, spot.PricingType, spot.Price, spot.IsActive,
        spot.Availabilities.OrderBy(a => a.SpecificDate).ThenBy(a => a.DayOfWeek)
            .Select(a => new AvailabilityResponse(a.Id, a.SpecificDate, a.DayOfWeek, a.StartTime, a.EndTime)).ToList());
static BookingResponse ToBookingResponse(Booking booking) =>
    new(booking.Id, booking.ParkingSpotId, booking.ParkingSpot.Title, booking.DriverId,
        booking.Driver.Name, booking.StartsAtUtc, booking.EndsAtUtc, booking.Total,
        booking.Status, booking.CreatedAtUtc);
