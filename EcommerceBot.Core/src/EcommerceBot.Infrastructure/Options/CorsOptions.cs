using System.Collections.Generic;

namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Op��es de configura��o de CORS para origens permitidas e credenciais no SaaS.
/// </summary>
public class CorsOptions
{
    public const string SectionName = "Cors";

    /// <summary>
    /// Lista de origens permitidas (URLs do Frontend).
    /// Exemplo: ["http://localhost:5173", "http://localhost:3000", "https://app.ecommercebot.com"]
    /// </summary>
    public List<string> AllowedOrigins { get; set; } = ["http://localhost:5173", "http://localhost:3000"];
}
