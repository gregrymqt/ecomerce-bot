using System.Collections.Generic;

namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Opções de configuração de CORS para origens permitidas e credenciais no SaaS.
/// </summary>
public sealed class CorsOptions
{
    public const string SectionName = "Cors";

    /// <summary>
    /// Lista de origens permitidas (URLs do Frontend).
    /// Exemplo: ["https://app.ecommercebot.com"]
    /// Origens localhost de desenvolvimento são adicionadas apenas quando IHostEnvironment.IsDevelopment().
    /// </summary>
    public List<string> AllowedOrigins { get; set; } = [];
}
