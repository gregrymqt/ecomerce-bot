namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do serviço de Cache e Pub/Sub Redis.
/// </summary>
public class RedisOptions
{
    public const string SectionName = "Redis";

    public string ConnectionString { get; set; } = "localhost:6379,abortConnect=false";
    public string? Password { get; set; }
    public int Database { get; set; } = 0;
}
