using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace EcommerceBot.Api.Configurations;

/// <summary>
/// Métodos de extensão para hardening do servidor Kestrel.
/// Elimina headers de identificação de tecnologia (fingerprinting) em conformidade com as diretrizes de produção.
/// </summary>
public static class KestrelSecurityExtensions
{
    /// <summary>
    /// Configura o Kestrel para suprimir o cabeçalho 'Server: Kestrel' nas respostas HTTP.
    /// </summary>
    public static WebApplicationBuilder ConfigureKestrelSecurity(this WebApplicationBuilder builder)
    {
        builder.WebHost.ConfigureKestrel(serverOptions =>
        {
            serverOptions.AddServerHeader = false;
        });

        return builder;
    }
}
