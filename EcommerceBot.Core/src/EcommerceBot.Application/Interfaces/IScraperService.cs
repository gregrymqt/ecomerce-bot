using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Scraper;

namespace EcommerceBot.Application.Interfaces;

public interface IScraperService
{
    Task<string> EnqueueExtractionTaskAsync(Guid tenantId, string url, string plan);
}
