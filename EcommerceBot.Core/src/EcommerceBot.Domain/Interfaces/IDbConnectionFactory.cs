using System.Data;
using System.Threading.Tasks;

namespace EcommerceBot.Domain.Interfaces;

public interface IDbConnectionFactory
{
    Task<IDbConnection> CreateConnectionAsync();
}
