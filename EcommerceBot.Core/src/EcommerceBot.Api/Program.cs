using System.Text.Json.Serialization;
using EcommerceBot.Api.Middlewares;
using EcommerceBot.Api.Services;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Configurations;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;

// Configuração do Serilog estruturado com arquivo rotativo JSON compartilhado para o MCP Server
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.Logger(lc => lc
        .Filter.ByIncludingOnly(e => e.Level >= LogEventLevel.Warning)
        .WriteTo.File(new CompactJsonFormatter(), "logs/errors-.json", rollingInterval: RollingInterval.Day, shared: true))
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// Carregamento de variáveis de ambiente nativas a partir do arquivo .env (com mapeamento de aliases e duplo underscore)
builder.Configuration.AddDotEnvConfiguration();

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

// Forwarded Headers para suporte transparente a Proxies Reversos, Ngrok e SSL Termination
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

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
