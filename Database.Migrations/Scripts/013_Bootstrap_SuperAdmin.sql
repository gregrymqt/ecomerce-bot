-- ==============================================================================
-- Script 013: Bootstrap de Super Administrador (ADMIN) no E-commerce Bot (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

DO $$
DECLARE
    v_admin_email VARCHAR(256) := 'admin@ecommercebot.com';
    v_admin_role_id UUID := '11111111-1111-1111-1111-111111111111';
    -- Senha inicial: 'AdminMaster@2026!' (Hash BCrypt Work Factor 12)
    v_password_hash VARCHAR(500) := '$2a$12$5T7toVMF0/rnJ7xlmbYVV.oorIYhR7BZ02e/VpoqZdodnFQLDs0YC';
    v_master_tenant_id UUID;
    v_user_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = v_admin_email) THEN
        UPDATE dbo.Users
        SET PasswordHash = v_password_hash,
            Role = 'ADMIN',
            RoleId = v_admin_role_id,
            IsActive = TRUE,
            UpdatedAt = NOW()
        WHERE Email = v_admin_email;

        RAISE NOTICE '>> Usuário [%] promovido com sucesso para ADMIN.', v_admin_email;
    ELSE
        v_master_tenant_id := gen_random_uuid();
        v_user_id := gen_random_uuid();

        -- Cria o Tenant Master da Plataforma
        INSERT INTO dbo.Tenants (Id, Name, Slug, PlanTier, CreditsBalance, IsActive, CreatedAt, UpdatedAt)
        VALUES (v_master_tenant_id, 'Administração SaaS Master', 'saas-master', 'enterprise', 10000, TRUE, NOW(), NOW());

        -- Cria o Usuário Super Admin
        INSERT INTO dbo.Users (Id, TenantId, RoleId, FullName, Email, PasswordHash, Role, IsActive, CreatedAt, UpdatedAt)
        VALUES (v_user_id, v_master_tenant_id, v_admin_role_id, 'Super Administrador', v_admin_email, v_password_hash, 'ADMIN', TRUE, NOW(), NOW());

        RAISE NOTICE '>> Tenant Master e Usuário ADMIN criados com sucesso!';
    END IF;
END $$;
