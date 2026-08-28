using System;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Api.Middlewares;

/// <summary>
/// Métodos de extensão para configuração desacoplada do pipeline global de tratamento de exceções e alertas Discord.
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

                // 1. Log estruturado local via ILogger
                var loggerFactory = services.GetService<ILoggerFactory>();
                var logger = loggerFactory?.CreateLogger("GlobalExceptionHandler");
                logger?.LogError(ex, "Exceção não tratada na requisição {Method} {Path}: {Message}",
                    context.Request.Method, path, ex.Message);

                // 2. Disparo de alerta crítico assíncrono para o Discord Webhook
                var discordAlertService = services.GetService<IDiscordAlertService>();
                if (discordAlertService != null)
                {
                    await discordAlertService.SendCriticalAlertAsync(
                        title: $"Exceção Não Tratada na Rota {path}",
                        description: $"Ocorreu uma falha interna na requisição HTTP `{context.Request.Method} {path}`: {ex.Message}",
                        exception: ex,
                        source: "Core API Exception Handler"
                    );
                }

                // 3. Resposta padronizada JSON 500 para o cliente HTTP
                var hostEnvironment = services.GetService<IHostEnvironment>();
                var isDevelopment = hostEnvironment?.IsDevelopment() ?? false;

                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";

                await context.Response.WriteAsJsonAsync(new
                {
                    status = StatusCodes.Status500InternalServerError,
                    error = "Internal Server Error",
                    message = isDevelopment ? ex.Message : "Ocorreu um erro interno no servidor.",
                    timestamp = DateTimeOffset.UtcNow
                });
            });
        });
    }
}
