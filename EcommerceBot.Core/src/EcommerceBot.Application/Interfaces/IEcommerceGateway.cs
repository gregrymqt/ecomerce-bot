using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface IEcommerceGateway
{
    string PlatformName { get; }
    Task<bool> PushProductAsync(Guid tenantId, Product product);
    Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId);
}

public interface IEcommerceGatewayFactory
{
    IEcommerceGateway GetGateway(string platformName);
}
