using System;
using System.Collections.Generic;
using System.Linq;
using EcommerceBot.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Gateways;

public class EcommerceGatewayFactory : IEcommerceGatewayFactory
{
    private readonly IServiceProvider _serviceProvider;

    public EcommerceGatewayFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IEcommerceGateway GetGateway(string platformName)
    {
        var gateways = _serviceProvider.GetServices<IEcommerceGateway>();
        
        var gateway = gateways.FirstOrDefault(g => 
            g.PlatformName.Equals(platformName, StringComparison.OrdinalIgnoreCase));

        if (gateway == null)
            throw new NotSupportedException($"Gateway de E-commerce '{platformName}' não está configurado.");

        return gateway;
    }
}
