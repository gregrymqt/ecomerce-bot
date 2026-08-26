using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging
{
    public class NuvemshopBulkSyncConsumer : IConsumer<NuvemshopBulkSyncMessage>
    {
        private readonly IEcommerceGatewayFactory _gatewayFactory;
        private readonly IProductRepository _productRepository;
        private readonly ILogger<NuvemshopBulkSyncConsumer> _logger;

        public NuvemshopBulkSyncConsumer(
            IEcommerceGatewayFactory gatewayFactory,
            IProductRepository productRepository,
            ILogger<NuvemshopBulkSyncConsumer> logger)
        {
            _gatewayFactory = gatewayFactory;
            _productRepository = productRepository;
            _logger = logger;
        }

        public async Task Consume(ConsumeContext<NuvemshopBulkSyncMessage> context)
        {
            var msg = context.Message;
            _logger.LogInformation("Processing Nuvemshop sync for Job {JobId} Sku {Sku} Tenant {TenantId}", msg.JobId, msg.Sku, msg.TenantId);

            var product = await _productRepository.GetBySkuAsync(msg.TenantId, msg.Sku);
            if (product == null)
            {
                _logger.LogWarning("Product {Sku} not found for Tenant {TenantId}", msg.Sku, msg.TenantId);
                return;
            }

            var nuvemshopGateway = _gatewayFactory.GetGateway("Nuvemshop");
            if (nuvemshopGateway == null)
            {
                _logger.LogError("NuvemshopGateway not found");
                return;
            }

            var success = await nuvemshopGateway.PushProductAsync(msg.TenantId, product);
            
            if (success)
            {
                _logger.LogInformation("Successfully synced Sku {Sku} for Job {JobId}", msg.Sku, msg.JobId);
            }
            else
            {
                _logger.LogWarning("Failed to sync Sku {Sku} for Job {JobId}", msg.Sku, msg.JobId);
                // Pode-se dar throw para o MassTransit tentar retry
                throw new System.Exception($"Failed to sync SKU {msg.Sku}");
            }
        }
    }
}
