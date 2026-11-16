namespace EcommerceBot.Infrastructure.Configurations;

using EcommerceBot.Infrastructure.Jobs;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public static class JobQueueExtensions
{
    public static IServiceCollection AddJobQueue(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JobQueueOptions>(configuration.GetSection(JobQueueOptions.SectionName));
        services.AddHostedService<JobQueueWorker>();
        return services;
    }
}
