-- ==============================================================================
-- Script: Setup e Segregação de Credenciais de Produção (Princípio do Menor Privilégio)
-- E-commerce Bot SaaS — Separação: sa (Infra) vs usr_ecommerce_deployer (DDL) vs usr_ecommerce_api (DML)
-- ==============================================================================

USE master;
GO

-- 1. Criação Idempotente do Banco de Dados com Collation UTF-8 (caso não exista)
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'EcommerceBotDb')
BEGIN
    PRINT '>> Criando banco de dados EcommerceBotDb com Collation UTF-8...';
    CREATE DATABASE [EcommerceBotDb] 
    COLLATE Latin1_General_100_CI_AS_SC_UTF8;
END
GO

-- 2. Ativação Preventiva de RCSI e Snapshot Isolation no Banco
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = N'EcommerceBotDb' AND is_read_committed_snapshot_on = 0)
BEGIN
    PRINT '>> Ativando READ_COMMITTED_SNAPSHOT em EcommerceBotDb...';
    ALTER DATABASE [EcommerceBotDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    ALTER DATABASE [EcommerceBotDb] SET READ_COMMITTED_SNAPSHOT ON;
    ALTER DATABASE [EcommerceBotDb] SET ALLOW_SNAPSHOT_ISOLATION ON;
    ALTER DATABASE [EcommerceBotDb] SET MULTI_USER;
END
GO

-- 3. Criação de Logins no Master com Validação de Política de Senhas
-- Senhas parametrizadas ou segredos fortes padrão de homologação
DECLARE @DeployerPassword NVARCHAR(100) = '$(MSSQL_DEPLOYER_PASSWORD)';
IF @DeployerPassword = '$(MSSQL_DEPLOYER_PASSWORD)' OR @DeployerPassword = ''
    SET @DeployerPassword = 'Deployer@Secure_Passw0rd_Prod2026!';

DECLARE @ApiPassword NVARCHAR(100) = '$(MSSQL_API_PASSWORD)';
IF @ApiPassword = '$(MSSQL_API_PASSWORD)' OR @ApiPassword = ''
    SET @ApiPassword = 'Api@Secure_Passw0rd_Prod2026!';

-- Login para runner de migrações (DbUp / CI-CD)
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'usr_ecommerce_deployer')
BEGIN
    PRINT '>> Criando login usr_ecommerce_deployer...';
    DECLARE @CreateDeployerSql NVARCHAR(MAX) = N'CREATE LOGIN [usr_ecommerce_deployer] WITH PASSWORD = ''' + REPLACE(@DeployerPassword, '''', '''''') + N''', CHECK_POLICY = ON, DEFAULT_DATABASE = [EcommerceBotDb];';
    EXEC sp_executesql @CreateDeployerSql;
END
ELSE
BEGIN
    PRINT '>> Atualizando senha de usr_ecommerce_deployer...';
    DECLARE @AlterDeployerSql NVARCHAR(MAX) = N'ALTER LOGIN [usr_ecommerce_deployer] WITH PASSWORD = ''' + REPLACE(@DeployerPassword, '''', '''''') + N''';';
    EXEC sp_executesql @AlterDeployerSql;
END
GO

-- Login para API Central em Runtime (.NET Core Web API)
DECLARE @ApiPassword NVARCHAR(100) = '$(MSSQL_API_PASSWORD)';
IF @ApiPassword = '$(MSSQL_API_PASSWORD)' OR @ApiPassword = ''
    SET @ApiPassword = 'Api@Secure_Passw0rd_Prod2026!';

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'usr_ecommerce_api')
BEGIN
    PRINT '>> Criando login usr_ecommerce_api...';
    DECLARE @CreateApiSql NVARCHAR(MAX) = N'CREATE LOGIN [usr_ecommerce_api] WITH PASSWORD = ''' + REPLACE(@ApiPassword, '''', '''''') + N''', CHECK_POLICY = ON, DEFAULT_DATABASE = [EcommerceBotDb];';
    EXEC sp_executesql @CreateApiSql;
END
ELSE
BEGIN
    PRINT '>> Atualizando senha de usr_ecommerce_api...';
    DECLARE @AlterApiSql NVARCHAR(MAX) = N'ALTER LOGIN [usr_ecommerce_api] WITH PASSWORD = ''' + REPLACE(@ApiPassword, '''', '''''') + N''';';
    EXEC sp_executesql @AlterApiSql;
END
GO

-- 4. Mapeamento de Usuários e Permissões Segregadas no Banco EcommerceBotDb
USE [EcommerceBotDb];
GO

-- Configuração do Deployer (db_owner escopado estritamente ao banco da aplicação)
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'usr_ecommerce_deployer')
BEGIN
    PRINT '>> Mapeando usuario usr_ecommerce_deployer em EcommerceBotDb...';
    CREATE USER [usr_ecommerce_deployer] FOR LOGIN [usr_ecommerce_deployer];
END
GO
ALTER ROLE db_owner ADD MEMBER [usr_ecommerce_deployer];
GO

-- Configuração do Usuário da API (Apenas Leitura, Escrita e Execução - Zero DDL)
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'usr_ecommerce_api')
BEGIN
    PRINT '>> Mapeando usuario usr_ecommerce_api em EcommerceBotDb...';
    CREATE USER [usr_ecommerce_api] FOR LOGIN [usr_ecommerce_api];
END
GO

-- Garante que usr_ecommerce_api não seja db_owner
ALTER ROLE db_owner DROP MEMBER [usr_ecommerce_api];
GO
ALTER ROLE db_datareader ADD MEMBER [usr_ecommerce_api];
ALTER ROLE db_datawriter ADD MEMBER [usr_ecommerce_api];
GRANT EXECUTE TO [usr_ecommerce_api];
GRANT VIEW DATABASE STATE TO [usr_ecommerce_api];
GO

PRINT '>> Segregação de credenciais configurada com 100% de sucesso!';
PRINT '>> usr_ecommerce_deployer: db_owner (escopo estrito a EcommerceBotDb)';
PRINT '>> usr_ecommerce_api: db_datareader, db_datawriter, EXECUTE (zero privilégios de DDL/sysadmin)';
GO
