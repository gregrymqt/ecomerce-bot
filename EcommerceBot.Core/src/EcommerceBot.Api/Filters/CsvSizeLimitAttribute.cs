using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EcommerceBot.Api.Filters;

/// <summary>
/// Action Filter para validação de tamanho máximo e formato de arquivos CSV (Shopify, Nuvemshop e importações).
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
            context.Result = new ObjectResult(new
            {
                statusCode = StatusCodes.Status413PayloadTooLarge,
                error = "Payload Too Large",
                message = $"O payload da requisição excede o limite máximo permitido de {MaxMegabytes} MB (tamanho: {Math.Round((double)request.ContentLength.Value / (1024 * 1024), 2)} MB)."
            })
            {
                StatusCode = StatusCodes.Status413PayloadTooLarge
            };
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
                    context.Result = new BadRequestObjectResult(new
                    {
                        statusCode = StatusCodes.Status400BadRequest,
                        error = "Invalid File Format",
                        message = $"O arquivo '{file.FileName}' não é um CSV válido. Apenas arquivos com extensão .csv são suportados."
                    });
                    return;
                }

                // Valida tamanho individual do arquivo
                if (file.Length > MaxBytes)
                {
                    context.Result = new ObjectResult(new
                    {
                        statusCode = StatusCodes.Status413PayloadTooLarge,
                        error = "Payload Too Large",
                        message = $"O arquivo CSV '{file.FileName}' excede o tamanho máximo permitido de {MaxMegabytes} MB."
                    })
                    {
                        StatusCode = StatusCodes.Status413PayloadTooLarge
                    };
                    return;
                }
            }
        }

        await next();
    }
}
