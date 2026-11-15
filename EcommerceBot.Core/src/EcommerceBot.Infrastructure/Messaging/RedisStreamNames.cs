using System;

namespace EcommerceBot.Infrastructure.Messaging;

/// <summary>
/// Mapeamento canônico de nomes de Streams e Consumer Groups no Redis Streams (substituindo o RabbitMQ).
/// </summary>
public static class RedisStreamNames
{
    // Streams Canônicos
    public const string ScrapingProd = "stream:scraping:prod";
    public const string ScrapingDemo = "stream:scraping:demo";
    public const string ScrapedResults = "stream:scraped:results";
    public const string EmailNotifications = "stream:notifications:email";
    public const string PaymentsProcess = "stream:payments:process";
    public const string ShopifyBulkSync = "stream:sync:shopify";
    public const string NuvemshopBulkSync = "stream:sync:nuvemshop";
    public const string DlqEcommerce = "stream:dlq:ecommerce";

    // Consumer Groups Canônicos
    public const string GroupGoWorkerScraper = "go-worker-scraper";
    public const string GroupApiScraped = "api-scraped-consumer";
    public const string GroupApiEmail = "api-email-consumer";
    public const string GroupApiPayments = "api-payments-consumer";
    public const string GroupApiShopify = "api-shopify-consumer";
    public const string GroupApiNuvemshop = "api-nuvemshop-consumer";

    /// <summary>
    /// Resolve o nome do stream a partir de routing keys legadas do RabbitMQ ou nomes de tipos de mensagem.
    /// </summary>
    public static string ResolveStream(string? routingKeyOrQueue, Type? messageType = null)
    {
        if (string.IsNullOrWhiteSpace(routingKeyOrQueue))
        {
            if (messageType != null)
            {
                var name = messageType.Name;
                if (name.Contains("ScrapingRequest", StringComparison.OrdinalIgnoreCase)) return ScrapingProd;
                if (name.Contains("Payment", StringComparison.OrdinalIgnoreCase)) return PaymentsProcess;
                if (name.Contains("Email", StringComparison.OrdinalIgnoreCase)) return EmailNotifications;
                if (name.Contains("Shopify", StringComparison.OrdinalIgnoreCase)) return ShopifyBulkSync;
                if (name.Contains("Nuvemshop", StringComparison.OrdinalIgnoreCase)) return NuvemshopBulkSync;
            }
            return ScrapingProd;
        }

        var clean = routingKeyOrQueue.Trim().ToLowerInvariant();
        if (clean.StartsWith("exchange:")) clean = clean.Substring(9);
        if (clean.StartsWith("queue:")) clean = clean.Substring(6);

        return clean switch
        {
            "ecommerce" or "stream:scraping:prod" => ScrapingProd,
            "demo_ecommerce" or "stream:scraping:demo" => ScrapingDemo,
            "ecommerce_scraped_queue" or "stream:scraped:results" => ScrapedResults,
            "email_notifications" or "stream:notifications:email" => EmailNotifications,
            "payments_process_queue" or "stream:payments:process" => PaymentsProcess,
            "shopify_bulk_sync" or "stream:sync:shopify" => ShopifyBulkSync,
            "nuvemshop_bulk_sync" or "stream:sync:nuvemshop" => NuvemshopBulkSync,
            "dlq_ecommerce" or "stream:dlq:ecommerce" => DlqEcommerce,
            _ => clean.StartsWith("stream:") ? clean : $"stream:{clean}"
        };
    }
}
