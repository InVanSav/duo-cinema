using DuoCinema;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactDevServer", policy =>
    {
        policy
            .WithOrigins("http://frontend:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddSignalR();

var app = builder.Build();

app.UseCors("AllowReactDevServer");

app.MapHub<WatchHub>("/watch");

app.Run();