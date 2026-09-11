-- ==============================================================================
-- Script: Configuração e Otimização do tempdb no SQL Server 2022 (Linux / Docker)
-- E-commerce Bot SaaS — Eliminação de Contenção de Alocação PFS/GAM/SGAM
-- ==============================================================================

USE master;
GO

-- 1. Redimensionar e redirecionar os arquivos primários do tempdb para volume isolado
ALTER DATABASE tempdb MODIFY FILE (
    NAME = 'tempdev', 
    FILENAME = '/var/opt/mssql/tempdb/tempdb.mdf', 
    SIZE = 256MB, 
    FILEGROWTH = 64MB,
    MAXSIZE = 2048MB
);
GO

ALTER DATABASE tempdb MODIFY FILE (
    NAME = 'templog', 
    FILENAME = '/var/opt/mssql/tempdb/templog.ldf', 
    SIZE = 128MB, 
    FILEGROWTH = 64MB,
    MAXSIZE = 1024MB
);
GO

-- 2. Adicionar arquivos de dados secundários para paralelismo uniforme (3 vCPUs)
-- Idempotente: Verifica se os arquivos adicionais já existem antes de criar
IF NOT EXISTS (SELECT 1 FROM sys.master_files WHERE database_id = 2 AND name = 'tempdev2')
BEGIN
    ALTER DATABASE tempdb ADD FILE (
        NAME = 'tempdev2', 
        FILENAME = '/var/opt/mssql/tempdb/tempdb_2.ndf', 
        SIZE = 256MB, 
        FILEGROWTH = 64MB,
        MAXSIZE = 2048MB
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.master_files WHERE database_id = 2 AND name = 'tempdev3')
BEGIN
    ALTER DATABASE tempdb ADD FILE (
        NAME = 'tempdev3', 
        FILENAME = '/var/opt/mssql/tempdb/tempdb_3.ndf', 
        SIZE = 256MB, 
        FILEGROWTH = 64MB,
        MAXSIZE = 2048MB
    );
END
GO

-- Limpeza caso tempdev4 tenha sido criado anteriormente em testes
IF EXISTS (SELECT 1 FROM sys.master_files WHERE database_id = 2 AND name = 'tempdev4')
BEGIN
    ALTER DATABASE tempdb REMOVE FILE tempdev4;
END
GO

-- 3. Configurar diretórios padrão de instâncias para novos bancos e logs
EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultData', REG_SZ, N'/var/opt/mssql/data';
EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultLog', REG_SZ, N'/var/opt/mssql/log';
EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'DefaultBackup', REG_SZ, N'/var/opt/mssql/backup';
GO

PRINT '>> Configuração do tempdb e diretórios padrão aplicada com sucesso!';
PRINT '>> Observação: Os novos caminhos de arquivo do tempdb entram em vigor na próxima reinicialização do SQL Server.';
GO
