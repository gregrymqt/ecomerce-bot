using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces
{
    public interface IEnterpriseLeadService
    {
        Task<EnterpriseLeadResponse> RegisterLeadAsync(EnterpriseLeadRequest request, string? ipAddress);
    }
}
