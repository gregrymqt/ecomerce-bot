using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

/// <summary>
/// Contrato de persistência para usuários, credenciais de acesso e papéis no ecossistema SaaS.
/// </summary>
public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByEmailAsync(string email);
    Task<User> CreateAsync(User user);
    Task<bool> UpdateAsync(User user);
}
