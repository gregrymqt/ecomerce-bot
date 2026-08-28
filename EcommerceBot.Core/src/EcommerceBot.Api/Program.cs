using System.Text.Json.Serialization;
using EcommerceBot.Api.Middlewares;
using EcommerceBot.Api.Services;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Configurations;
using Microsoft.AspNetCore.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Configuração do JSON Serialization
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// Configuração modular de Infraestrutura (Scrutor DIP, Redis, JWT, RabbitMQ, Gateways, Discord, Razor)
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

// TenantContext (Scoped por requisição HTTP da WebAPI)
builder.Services.AddScoped<ITenantContext, TenantContext>();

// Controllers, Views (Razor Engine) & OpenAPI
builder.Services.AddControllersWithViews();
builder.Services.AddOpenApi();

var app = builder.Build();

// Tratamento global de exceções não tratadas com disparo de alerta no Discord
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exceptionHandlerPathFeature = context.Features.Get<IExceptionHandlerPathFeature>();
        if (exceptionHandlerPathFeature?.Error != null)
        {
            var ex = exceptionHandlerPathFeature.Error;
            var path = exceptionHandlerPathFeature.Path;
            var discordAlertService = context.RequestServices.GetService<IDiscordAlertService>();

            if (discordAlertService != null)
            {
                await discordAlertService.SendCriticalAlertAsync(
                    title: $"Exceção Não Tratada na Rota {path}",
                    description: $"Ocorreu uma falha interna na requisição HTTP `{context.Request.Method} {path}`: {ex.Message}",
                    exception: ex,
                    source: "Core API Exception Handler"
                );
            }

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                status = 500,
                error = "Internal Server Error",
                message = app.Environment.IsDevelopment() ? ex.Message : "Ocorreu um erro interno no servidor."
            });
        }
    });
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Middlewares de Segurança e Multi-Tenancy
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantHeaderMiddleware>();

// Roteamento
app.MapControllers();

// Healthcheck público
app.MapGet("/health", () => new { Status = "OK", Service = "EcommerceBot.Core.API" });

// Informações do Tenant autenticado
app.MapGet("/api/v1/tenant-info", (ITenantContext tenantContext) => 
    new { tenantContext.TenantId, Message = "Acesso autorizado!" });

app.Run();
