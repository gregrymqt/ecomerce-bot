using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Contrato do motor de renderização de templates Razor (.cshtml) para string HTML.
/// </summary>
public interface IRazorTemplateRenderer
{
    Task<string> RenderViewToStringAsync<TModel>(string viewName, TModel model);
}
