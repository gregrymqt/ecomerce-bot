using System.Text.Json.Serialization;
using EcommerceBot.Api.Middlewares;
using EcommerceBot.Api.Services;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Configurations;

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

// Tratamento global de exceções não tratadas com disparo de alerta no Discord & Log Estruturado
app.UseGlobalExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Middlewares de Segurança, CORS e Multi-Tenancy
app.UseCors("DefaultCorsPolicy");
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
