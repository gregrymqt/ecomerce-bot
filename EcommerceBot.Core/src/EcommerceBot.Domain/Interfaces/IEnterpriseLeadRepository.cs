using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces
{
    public interface IEnterpriseLeadRepository
    {
        Task<EnterpriseLead?> GetByEmailAsync(string email);
        Task<EnterpriseLead> CreateAsync(EnterpriseLead lead);
    }
}
