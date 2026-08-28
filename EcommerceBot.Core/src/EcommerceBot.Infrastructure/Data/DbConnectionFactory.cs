using System.Data;
using System.Threading.Tasks;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Data;

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IOptions<DatabaseOptions> databaseOptions)
    {
        _connectionString = databaseOptions.Value.DefaultConnection;

        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            throw new System.ArgumentNullException(nameof(databaseOptions), "Connection string 'DefaultConnection' not found in configuration.");
        }
    }

    public async Task<IDbConnection> CreateConnectionAsync()
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }
}
