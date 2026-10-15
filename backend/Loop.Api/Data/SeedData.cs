using Loop.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Loop.Api.Data;

public static class SeedData
{
    public static async Task InitializeAsync(AppDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        if (await db.Users.AnyAsync()) return;

        var driver = new AppUser { Name = "Marina Costa", Email = "marina@loop.demo", Role = UserRole.Driver };
        var owner = new AppUser { Name = "Lucas Almeida", Email = "lucas@loop.demo", Role = UserRole.Owner };
        var admin = new AppUser { Name = "Equipe Loop", Email = "admin@loop.demo", Role = UserRole.Admin };
        db.Users.AddRange(driver, owner, admin);

        var spots = new[]
        {
            new ParkingSpot { Owner = owner, Title = "Vaga coberta perto da UFSC", Address = "Rua Lauro Linhares, 1420, Trindade, Florianópolis", Description = "Acesso fácil, vaga coberta e portão eletrônico.", Latitude = -27.588980m, Longitude = -48.521890m, PricingType = PricingType.Hourly, Price = 8m },
            new ParkingSpot { Owner = owner, Title = "Garagem no Centro", Address = "Rua Felipe Schmidt, 500, Centro, Florianópolis", Description = "Próxima ao comércio, entrada pela rua lateral.", Latitude = -27.595650m, Longitude = -48.550710m, PricingType = PricingType.Daily, Price = 35m },
            new ParkingSpot { Owner = owner, Title = "Vaga ao lado do Beiramar", Address = "Av. Mauro Ramos, 1100, Centro, Florianópolis", Description = "Vaga descoberta em condomínio residencial.", Latitude = -27.585780m, Longitude = -48.548620m, PricingType = PricingType.Fixed, Price = 20m }
        };
        foreach (var spot in spots)
            for (var day = DayOfWeek.Sunday; day <= DayOfWeek.Saturday; day++)
                spot.Availabilities.Add(new Availability { DayOfWeek = day, StartTime = new TimeOnly(6, 0), EndTime = new TimeOnly(23, 59) });
        db.Spots.AddRange(spots);
        await db.SaveChangesAsync();
    }
}
