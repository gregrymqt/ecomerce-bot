using System;
using System.IO;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;

namespace EcommerceBot.Api.Configurations;

/// <summary>
/// Métodos de extensão para configuração desacoplada de observabilidade e logging estruturado com Serilog.
/// </summary>
public static class SerilogConfigurationExtensions
{
    /// <summary>
    /// Configura o Serilog com console rico, arquivo rotativo de execução (app-.log) e arquivo rotativo de erros (errors-.json).
    /// </summary>
    public static WebApplicationBuilder ConfigureSerilog(this WebApplicationBuilder builder)
    {
        var logDirectory = Path.Combine(builder.Environment.ContentRootPath, "logs");
        if (!Directory.Exists(logDirectory))
        {
            Directory.CreateDirectory(logDirectory);
        }

        var appLogPath = Path.Combine(logDirectory, "app-.log");
        var errorsJsonPath = Path.Combine(logDirectory, "errors-.json");

        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Application", "EcommerceBot.Api")
            .Enrich.WithProperty("MachineName", Environment.MachineName)
            .WriteTo.Console(
                outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}")
            .WriteTo.File(
                path: appLogPath,
                rollingInterval: RollingInterval.Day,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{SourceContext}] {Message:lj}{NewLine}{Exception}",
                encoding: Encoding.UTF8,
                shared: true)
            .WriteTo.Logger(lc => lc
                .Filter.ByIncludingOnly(e => e.Level >= LogEventLevel.Warning)
                .WriteTo.File(
                    formatter: new CompactJsonFormatter(),
                    path: errorsJsonPath,
                    rollingInterval: RollingInterval.Day,
                    shared: true))
            .CreateLogger();

        builder.Host.UseSerilog();

        Log.Information("🚀 EcommerceBot.Api inicializando... Logs estruturados registrados em: {LogDirectory}", logDirectory);

        return builder;
    }

    /// <summary>
    /// Adiciona o middleware de request logging do Serilog com enriquecimento de status code, latência e Tenant ID.
    /// </summary>
    public static WebApplication UseCustomRequestLogging(this WebApplication app)
    {
        app.UseSerilogRequestLogging(options =>
        {
            options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} respondeu {StatusCode} em {Elapsed:0.0000} ms";
            options.GetLevel = (httpContext, elapsed, ex) =>
            {
                if (ex != null || httpContext.Response.StatusCode >= 500)
                {
                    return LogEventLevel.Error;
                }

                if (httpContext.Response.StatusCode >= 400)
                {
                    return LogEventLevel.Warning;
                }

                return LogEventLevel.Information;
            };
            options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
            {
                if (httpContext.Request.Headers.TryGetValue("X-Tenant-ID", out var tenantId))
                {
                    diagnosticContext.Set("TenantId", tenantId.ToString());
                }

                diagnosticContext.Set("ClientIp", httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");
            };
        });

        return app;
    }
}
