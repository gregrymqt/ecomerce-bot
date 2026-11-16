namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Opções de configuração para o worker de fila durável em background (PostgreSQL FOR UPDATE SKIP LOCKED + Channel).
/// </summary>
public sealed class JobQueueOptions
{
    public const string SectionName = "JobQueue";

    /// <summary>
    /// Capacidade máxima do buffer Channel&lt;Job&gt; em memória. Default: 100.
    /// </summary>
    public int ChannelCapacity { get; set; } = 100;

    /// <summary>
    /// Quantidade de consumidores concorrentes processando jobs em paralelo. Default: 4.
    /// </summary>
    public int Concurrency { get; set; } = 4;

    /// <summary>
    /// Tamanho do lote a reivindicar do banco de dados a cada ciclo de claim. Default: 10.
    /// </summary>
    public int BatchSize { get; set; } = 10;

    /// <summary>
    /// Limite de itens pendentes no canal abaixo do qual uma nova busca (prefetch) é realizada. Default: 10.
    /// </summary>
    public int PrefetchThreshold { get; set; } = 10;

    /// <summary>
    /// Intervalo de polling em milissegundos quando a fila no banco de dados estiver vazia. Default: 1000ms.
    /// </summary>
    public int PollIntervalMs { get; set; } = 1000;

    /// <summary>
    /// Tempo de lock em segundos ao reivindicar jobs com FOR UPDATE SKIP LOCKED. Default: 300s (5 minutos).
    /// </summary>
    public int LockDurationSeconds { get; set; } = 300;

    /// <summary>
    /// Número máximo de tentativas antes de marcar o job definitivamente como 'failed'. Default: 5.
    /// </summary>
    public int MaxRetries { get; set; } = 5;
}
