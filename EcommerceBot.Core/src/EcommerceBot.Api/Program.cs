using EcommerceBot.Api.Configurations;
using EcommerceBot.Api.Middlewares;
using EcommerceBot.Application.Configurations;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Configurations;

var builder = WebApplication.CreateBuilder(args);

// Hardening de Kestrel (remoção de cabeçalho Server contra fingerprinting)
builder.ConfigureKestrelSecurity();

// Configuração modular de observabilidade (Serilog: Console rico, app-.log e errors-.json)
builder.ConfigureSerilog();

// Carregamento de variáveis de ambiente nativas a partir do arquivo .env
builder.Configuration.AddDotEnvConfiguration();

// Configuração modular de serviços da API (JSON, Contexto de Tenant, Controllers, Razor e OpenAPI)
builder.Services.AddApiServices();

// Configuração modular da camada de Aplicação
builder.Services.AddApplicationServices();

// Configuração modular de Infraestrutura (Scrutor DIP, Redis, JWT, RabbitMQ, Gateways, Discord, Razor)
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();

// Tratamento global de exceções não tratadas com alerta Discord & Log Estruturado
app.UseGlobalExceptionHandler();

// Middleware de request logging do Serilog com status, latência e Tenant ID
app.UseCustomRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Forwarded Headers para suporte a Proxies Reversos, Ngrok e SSL Termination
app.UseForwardedHeadersConfiguration();

// Cabeçalhos de Segurança HTTP (HSTS, CSP, Anti-Clickjacking, Anti-MIME sniffing)
app.UseSecurityHeaders();

app.UseHttpsRedirection();

// Middlewares de Segurança, CORS e Multi-Tenancy
app.UseCors("DefaultCorsPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantHeaderMiddleware>();

// Roteamento de Controllers
app.MapControllers();

// Mapeamento modular de Health Checks segregados (/health/live, /health/ready, /health)
app.MapApiHealthChecks();

app.Run();