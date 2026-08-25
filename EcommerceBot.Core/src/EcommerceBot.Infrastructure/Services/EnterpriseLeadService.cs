using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Services
{
    public class EnterpriseLeadService : IEnterpriseLeadService
    {
        private readonly IEnterpriseLeadRepository _leadRepository;

        public EnterpriseLeadService(IEnterpriseLeadRepository leadRepository)
        {
            _leadRepository = leadRepository;
        }

        public async Task<EnterpriseLeadResponse> RegisterLeadAsync(EnterpriseLeadRequest request, string? ipAddress)
        {
            var lead = new EnterpriseLead
            {
                Email = request.Email.ToLower(),
                CompanyName = request.CompanyName,
                JobTitle = request.JobTitle,
                ExpectedVolume = request.ExpectedVolume,
                IpAddress = ipAddress
            };

            var created = await _leadRepository.CreateAsync(lead);

            return new EnterpriseLeadResponse
            {
                Id = created.Id,
                Email = created.Email,
                Message = "Lead corporativo registrado com sucesso. Nossa equipe entrará em contato."
            };
        }
    }
}
