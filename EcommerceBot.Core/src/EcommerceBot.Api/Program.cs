using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MassTransit;
using StackExchange.Redis;
using EcommerceBot.Api.Middlewares;
using EcommerceBot.Api.Services;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;
using EcommerceBot.Infrastructure.Gateways;
using EcommerceBot.Infrastructure.Messaging;
using EcommerceBot.Infrastructure.Repositories;
using EcommerceBot.Infrastructure.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Configuração do JSON
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// Registrar Core API Services (Domain & Infra)
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddSingleton<IAesGcmCryptoService, AesGcmCryptoService>();

// TenantContext DEVE ser Scoped (por requisição HTTP)
builder.Services.AddScoped<ITenantContext, TenantContext>();

// Repositórios Dapper
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<ITenantAiCredentialRepository, TenantAiCredentialRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IEnterpriseLeadRepository, EnterpriseLeadRepository>();
builder.Services.AddScoped<IMeteringRepository, MeteringRepository>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IEmailRepository, EmailRepository>();
builder.Services.AddScoped<IPlanRepository, PlanRepository>();
builder.Services.AddScoped<ITenantConfigRepository, TenantConfigRepository>();

// Serviços de Aplicação
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IGoogleAuthService, GoogleAuthService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<IEnterpriseLeadService, EnterpriseLeadService>();
builder.Services.AddScoped<IMeteringService, MeteringService>();
builder.Services.AddScoped<ICheckoutService, CheckoutService>();
builder.Services.AddScoped<IPlanService, PlanService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<IScraperService, ScraperService>();

// Gateways de E-commerce
builder.Services.AddHttpClient<IEcommerceGateway, ShopifyGateway>();
builder.Services.AddHttpClient<IEcommerceGateway, NuvemshopGateway>();
builder.Services.AddSingleton<IEcommerceGatewayFactory, EcommerceGatewayFactory>();
builder.Services.AddHttpClient<IResendGateway, ResendGateway>();

// -------------------------------------------------------------
// Configuração JWT Auth
// -------------------------------------------------------------
var jwtKey = builder.Configuration["Jwt:Key"] ?? "MinhaChaveSuperSecretaGigante123!";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = System.TimeSpan.Zero
    };
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var token = context.Request.Cookies["access_token"];
            if (!string.IsNullOrEmpty(token))
            {
                context.Token = token;
            }
            return System.Threading.Tasks.Task.CompletedTask;
        }
    };
});

// -------------------------------------------------------------
// Configuração StackExchange.Redis
// -------------------------------------------------------------
var redisConnectionString = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
builder.Services.AddSingleton<IConnectionMultiplexer>(sp => 
    ConnectionMultiplexer.Connect(redisConnectionString));

// -------------------------------------------------------------
// Configuração Distributed Cache (Memory / Redis)
// -------------------------------------------------------------
builder.Services.AddDistributedMemoryCache(); // Ou Redis, caso deseje injetar IDistributedCache no Redis

// Registra os Controllers
builder.Services.AddControllers();

// -------------------------------------------------------------
// Configuração MassTransit (RabbitMQ)
// -------------------------------------------------------------
builder.Services.AddMassTransit(x =>
{
    // Registra os Consumers (Escuta das filas do Python e de outros serviços)
    x.AddConsumer<ProcessedProductConsumer>();
    x.AddConsumer<EmailNotificationConsumer>();
    x.AddConsumer<NuvemshopBulkSyncConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.UseRawJsonSerializer();

        var rabbitMqHost = builder.Configuration["RabbitMQ:Host"] ?? "localhost";
        var rabbitMqUser = builder.Configuration["RabbitMQ:Username"] ?? "guest";
        var rabbitMqPass = builder.Configuration["RabbitMQ:Password"] ?? "guest";

        cfg.Host(rabbitMqHost, "/", h =>
        {
            h.Username(rabbitMqUser);
            h.Password(rabbitMqPass);
        });

        // Configura a fila que recebe os produtos processados pelo Python
        cfg.ReceiveEndpoint("ecommerce_processed_queue", e =>
        {
            e.ConfigureConsumer<ProcessedProductConsumer>(context);
        });

        // Configura a fila de emails transacionais
        cfg.ReceiveEndpoint("email_notifications", e =>
        {
            e.ConfigureConsumer<EmailNotificationConsumer>(context);
        });

        // Configura a fila de sincronização em lote da Nuvemshop
        cfg.ReceiveEndpoint("nuvemshop_bulk_sync", e =>
        {
            e.ConfigureConsumer<NuvemshopBulkSyncConsumer>(context);
        });
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Adicionando middlewares de Autenticação e Autorização ANTES do Middleware Multi-Tenant Global
app.UseAuthentication();
app.UseAuthorization();

// Adicionando o Middleware Multi-Tenant Global
app.UseMiddleware<TenantHeaderMiddleware>();

app.MapControllers(); // Habilita o roteamento dos Controllers

// Healthcheck público
app.MapGet("/health", () => new { Status = "OK", Service = "EcommerceBot.Core.API" });


// Exemplo de rota privada utilizando o TenantContext
app.MapGet("/api/v1/tenant-info", (ITenantContext tenantContext) => 
{
    return new { tenantContext.TenantId, Message = "Acesso autorizado!" };
});

app.Run();
