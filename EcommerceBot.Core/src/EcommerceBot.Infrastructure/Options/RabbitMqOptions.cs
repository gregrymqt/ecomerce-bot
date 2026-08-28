namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do broker de mensageria RabbitMQ / MassTransit.
/// </summary>
public class RabbitMqOptions
{
    public const string SectionName = "RabbitMQ";

    public string Host { get; set; } = "localhost";
    public string Username { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public ushort Port { get; set; } = 5672;
    public string VirtualHost { get; set; } = "/";
}
