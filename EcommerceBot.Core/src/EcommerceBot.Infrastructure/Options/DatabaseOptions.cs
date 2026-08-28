namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações de Connection Strings do banco de dados relacional e serviços de cache.
/// </summary>
public class DatabaseOptions
{
    public const string SectionName = "ConnectionStrings";

    public string DefaultConnection { get; set; } = string.Empty;
    public string Redis { get; set; } = "localhost:6379,abortConnect=false";
}
