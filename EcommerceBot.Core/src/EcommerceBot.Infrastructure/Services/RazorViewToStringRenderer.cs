using System;
using System.IO;
using System.Threading.Tasks;
using System.Linq;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewEngines;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Motor de renderização dinâmico que localiza, compila e renderiza views Razor (.cshtml) para strings HTML.
/// </summary>
public sealed class RazorViewToStringRenderer : IRazorTemplateRenderer
{
    private readonly IRazorViewEngine _viewEngine;
    private readonly ITempDataProvider _tempDataProvider;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RazorViewToStringRenderer> _logger;

    public RazorViewToStringRenderer(
        IRazorViewEngine viewEngine,
        ITempDataProvider tempDataProvider,
        IServiceProvider serviceProvider,
        ILogger<RazorViewToStringRenderer> logger)
    {
        _viewEngine = viewEngine;
        _tempDataProvider = tempDataProvider;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task<string> RenderViewToStringAsync<TModel>(string viewName, TModel model)
    {
        try
        {
            var httpContext = new DefaultHttpContext { RequestServices = _serviceProvider };
            var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());

            using var output = new StringWriter();
            var viewResult = FindView(actionContext, viewName);

            if (viewResult.View == null)
            {
                throw new InvalidOperationException($"A view '{viewName}' não pôde ser encontrada entre as views Razor configuradas.");
            }

            var viewDictionary = new ViewDataDictionary<TModel>(
                new EmptyModelMetadataProvider(),
                new ModelStateDictionary())
            {
                Model = model
            };

            var tempData = new TempDataDictionary(actionContext.HttpContext, _tempDataProvider);

            var viewContext = new ViewContext(
                actionContext,
                viewResult.View,
                viewDictionary,
                tempData,
                output,
                new HtmlHelperOptions()
            );

            await viewResult.View.RenderAsync(viewContext);
            return output.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao localizar ou renderizar a view Razor '{ViewName}' com ViewModel '{ViewModelType}'", viewName, typeof(TModel).FullName);
            throw;
        }
    }

    private ViewEngineResult FindView(ActionContext actionContext, string viewName)
    {
        // 1. Tenta obter diretamente pelo caminho relativo (ex: /Views/Emails/Welcome.cshtml)
        var getViewResult = _viewEngine.GetView(executingFilePath: null, viewPath: viewName, isMainPage: true);
        if (getViewResult.Success)
        {
            return getViewResult;
        }

        // 2. Tenta buscar pelo nome da view
        var findViewResult = _viewEngine.FindView(actionContext, viewName, isMainPage: true);
        if (findViewResult.Success)
        {
            return findViewResult;
        }

        var searchedLocations = getViewResult.SearchedLocations ?? findViewResult.SearchedLocations;
        var errorMessage = string.Join(
            Environment.NewLine,
            new[] { $"Não foi possível encontrar a view '{viewName}'. Locais pesquisados:" }.Concat(searchedLocations ?? Array.Empty<string>()));

        throw new InvalidOperationException(errorMessage);
    }
}
