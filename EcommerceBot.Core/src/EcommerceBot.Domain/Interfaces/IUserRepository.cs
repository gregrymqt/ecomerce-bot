using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces
{
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(Guid id);
        Task<User?> GetByEmailAsync(string email);
        Task<User> CreateAsync(User user);
        Task<bool> UpdateAsync(User user);
    }
}
