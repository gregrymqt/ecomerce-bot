using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EcommerceBot.Api.Filters;

/// <summary>
/// Action Filter para validação de tamanho máximo e formato de arquivos CSV (Shopify, Nuvemshop e importações)
/// com respostas de erro padronizadas pela RFC 7807 (ProblemDetails).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public class CsvSizeLimitAttribute : Attribute, IAsyncActionFilter
{
    private static readonly string[] AllowedExtensions = { ".csv" };
    private static readonly string[] AllowedMimeTypes = {
        "text/csv",
        "text/plain",
        "application/csv",
        "application/vnd.ms-excel"
    };

    /// <summary>
    /// Tamanho máximo permitido em bytes (padrão: 10 MB).
    /// </summary>
    public long MaxBytes { get; set; } = 10 * 1024 * 1024;

    /// <summary>
    /// Helper para definir o limite em Megabytes (ex: [CsvSizeLimit(MaxMegabytes = 10)]).
    /// </summary>
    public double MaxMegabytes
    {
        get => Math.Round((double)MaxBytes / (1024 * 1024), 2);
        set => MaxBytes = (long)(value * 1024 * 1024);
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;

        // 1. Fail-fast: Verificação prévia pelo cabeçalho Content-Length antes de ler os bytes
        if (request.ContentLength.HasValue && request.ContentLength.Value > MaxBytes)
        {
            context.Result = CreateProblemResult(
                context.HttpContext,
                StatusCodes.Status413PayloadTooLarge,
                "Payload Too Large",
                $"O payload da requisição excede o limite máximo permitido de {MaxMegabytes} MB (tamanho: {Math.Round((double)request.ContentLength.Value / (1024 * 1024), 2)} MB).");
            return;
        }

        // 2. Verificação de upload multipart/form-data
        if (request.HasFormContentType && request.Form.Files.Count > 0)
        {
            foreach (var file in request.Form.Files)
            {
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                var contentType = file.ContentType.ToLowerInvariant();

                // Valida extensão e MIME
                if (!AllowedExtensions.Contains(ext) && !AllowedMimeTypes.Contains(contentType))
                {
                    context.Result = CreateProblemResult(
                        context.HttpContext,
                        StatusCodes.Status400BadRequest,
                        "Invalid File Format",
                        $"O arquivo '{file.FileName}' não é um CSV válido. Apenas arquivos com extensão .csv são suportados.");
                    return;
                }

                // Valida tamanho individual do arquivo
                if (file.Length > MaxBytes)
                {
                    context.Result = CreateProblemResult(
                        context.HttpContext,
                        StatusCodes.Status413PayloadTooLarge,
                        "Payload Too Large",
                        $"O arquivo CSV '{file.FileName}' excede o tamanho máximo permitido de {MaxMegabytes} MB.");
                    return;
                }
            }
        }

        await next();
    }

    private static ObjectResult CreateProblemResult(HttpContext context, int statusCode, string title, string detail)
    {
        var problem = new ProblemDetails
        {
            Type = "https://datatracker.ietf.org/doc/html/rfc7807",
            Title = title,
            Status = statusCode,
            Detail = detail,
            Instance = context.Request.Path
        };
        problem.Extensions["correlationId"] = Activity.Current?.Id ?? context.TraceIdentifier;
        problem.Extensions["error"] = title;
        problem.Extensions["message"] = detail;

        return new ObjectResult(problem)
        {
            StatusCode = statusCode,
            ContentTypes = { "application/problem+json" }
        };
    }
}
