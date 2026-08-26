using System;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

public interface IScraperService
{
    Task<string> EnqueueExtractionTaskAsync(Guid tenantId, string url, string? plan = null);
}
