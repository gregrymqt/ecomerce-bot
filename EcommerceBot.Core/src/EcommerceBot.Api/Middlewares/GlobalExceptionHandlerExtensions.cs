using System;
using System.Diagnostics;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Middlewares;

/// <summary>
/// Métodos de extensão para configuração desacoplada do pipeline global de tratamento de exceções,
/// conformidade com RFC 7807 (ProblemDetails) e alertas críticos via Discord.
/// </summary>
public static class GlobalExceptionHandlerExtensions
{
    public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder app)
    {
        return app.UseExceptionHandler(errorApp =>
        {
            errorApp.Run(async context =>
            {
                var exceptionHandlerPathFeature = context.Features.Get<IExceptionHandlerPathFeature>();
                if (exceptionHandlerPathFeature?.Error == null)
                {
                    return;
                }

                var ex = exceptionHandlerPathFeature.Error;
                var path = exceptionHandlerPathFeature.Path;
                var services = context.RequestServices;
                var correlationId = Activity.Current?.Id ?? context.TraceIdentifier;

                // Tratamento semântico para Saldo Insuficiente (HTTP 402 Payment Required - RFC 7807)
                if (ex is Domain.Exceptions.InsufficientCreditsException creditsEx)
                {
                    context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
                    context.Response.ContentType = "application/problem+json";

                    var creditsProblem = new ProblemDetails
                    {
                        Type = "https://datatracker.ietf.org/doc/html/rfc7807",
                        Title = "Insufficient Credits",
                        Status = StatusCodes.Status402PaymentRequired,
                        Detail = creditsEx.Message,
                        Instance = path
                    };
                    creditsProblem.Extensions["code"] = "insufficient_credits";
                    creditsProblem.Extensions["error"] = "Insufficient Credits";
                    creditsProblem.Extensions["message"] = creditsEx.Message;
                    creditsProblem.Extensions["correlationId"] = correlationId;
                    creditsProblem.Extensions["timestamp"] = DateTimeOffset.UtcNow;

                    await context.Response.WriteAsJsonAsync(creditsProblem, context.RequestAborted);
                    return;
                }

                // 1. Log estruturado local via ILogger
                var loggerFactory = services.GetService<ILoggerFactory>();
                var logger = loggerFactory?.CreateLogger("GlobalExceptionHandler");
                logger?.LogError(ex, "Exceção não tratada na requisição {Method} {Path} [CorrelationId: {CorrelationId}]: {Message}",
                    context.Request.Method, path, correlationId, ex.Message);

                // 2. Disparo de alerta crítico assíncrono para o Discord Webhook
                var discordAlertService = services.GetService<IDiscordAlertService>();
                if (discordAlertService != null)
                {
                    await discordAlertService.SendCriticalAlertAsync(
                        title: $"Exceção Não Tratada na Rota {path}",
                        description: $"Ocorreu uma falha interna na requisição HTTP `{context.Request.Method} {path}` (CorrelationId: `{correlationId}`): {ex.Message}",
                        exception: ex,
                        source: "Core API Exception Handler"
                    );
                }

                // 3. Resposta padronizada RFC 7807 (ProblemDetails 500) para o cliente HTTP
                var hostEnvironment = services.GetService<IHostEnvironment>();
                var isDevelopment = hostEnvironment?.IsDevelopment() ?? false;

                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/problem+json";

                var serverErrorProblem = new ProblemDetails
                {
                    Type = "https://datatracker.ietf.org/doc/html/rfc7807",
                    Title = "Internal Server Error",
                    Status = StatusCodes.Status500InternalServerError,
                    Detail = isDevelopment ? ex.Message : "Ocorreu um erro interno no servidor. Consulte o suporte informando o correlationId.",
                    Instance = path
                };
                serverErrorProblem.Extensions["code"] = "internal_server_error";
                serverErrorProblem.Extensions["error"] = "Internal Server Error";
                serverErrorProblem.Extensions["message"] = serverErrorProblem.Detail;
                serverErrorProblem.Extensions["correlationId"] = correlationId;
                serverErrorProblem.Extensions["timestamp"] = DateTimeOffset.UtcNow;

                await context.Response.WriteAsJsonAsync(serverErrorProblem, context.RequestAborted);
            });
        });
    }
}
