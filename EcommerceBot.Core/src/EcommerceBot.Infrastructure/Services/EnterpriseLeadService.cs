using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BCrypt.Net;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class EnterpriseLeadService : IEnterpriseLeadService
{
    private readonly IEnterpriseLeadRepository _leadRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IUserRepository _userRepository;
    private readonly IDiscordAlertService _discordAlertService;
    private readonly ILogger<EnterpriseLeadService> _logger;

    public EnterpriseLeadService(
        IEnterpriseLeadRepository leadRepository,
        ITenantRepository tenantRepository,
        IUserRepository userRepository,
        IDiscordAlertService discordAlertService,
        ILogger<EnterpriseLeadService> logger)
    {
        _leadRepository = leadRepository;
        _tenantRepository = tenantRepository;
        _userRepository = userRepository;
        _discordAlertService = discordAlertService;
        _logger = logger;
    }

    public async Task<EnterpriseLeadResponse> RegisterLeadAsync(EnterpriseLeadRequest request, string? ipAddress, CancellationToken cancellationToken = default)
    {
        var lead = new EnterpriseLead
        {
            Email = request.Email.ToLowerInvariant().Trim(),
            CompanyName = request.CompanyName?.Trim(),
            JobTitle = request.JobTitle?.Trim(),
            ExpectedVolume = request.ExpectedVolume?.Trim(),
            Phone = request.Phone?.Trim(),
            TeamSize = request.TeamSize?.Trim(),
            Notes = request.Notes?.Trim(),
            Status = "PENDING",
            IpAddress = ipAddress
        };

        EnterpriseLead created;
        try
        {
            created = await _leadRepository.CreateAsync(lead, cancellationToken);
            _logger.LogInformation("Novo lead Enterprise registrado com sucesso: {Email}, Empresa: {Company}", lead.Email, lead.CompanyName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao registrar lead Enterprise para o e-mail {Email}", lead.Email);
            throw;
        }

        // Disparo de notificação em tempo real para o Discord do Administrador
        try
        {
            var discordMsg = $@"🏢 **Empresa:** {created.CompanyName ?? "Não informado"}
📧 **E-mail:** {created.Email}
📱 **WhatsApp/Telefone:** {created.Phone ?? "Não informado"}
👥 **Equipe:** {created.TeamSize ?? "Não informado"}
📝 **IdP / Observações:** {created.Notes ?? "Nenhuma"}
🌐 **IP:** {ipAddress ?? "N/A"}";

            await _discordAlertService.SendInfoAlertAsync("🚨 Novo Lead SSO Enterprise Recebido!", discordMsg, "EnterpriseLeadService");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha não bloqueante ao enviar notificação de lead para o Discord. Lead: {Email}", created.Email);
        }

        return new EnterpriseLeadResponse
        {
            Id = created.Id,
            Email = created.Email,
            CompanyName = created.CompanyName ?? string.Empty,
            Message = "Solicitação corporativa registrada com sucesso. Nossa equipe entrará em contato."
        };
    }

        public async Task<EnterpriseLeadsListResponse> GetLeadsAsync(string? status, string? search, int page, int pageSize, CancellationToken cancellationToken = default)
        {
            var (leads, totalCount) = await _leadRepository.GetAllAsync(status, search, page, pageSize, cancellationToken);
            var metricsDict = await _leadRepository.GetMetricsAsync(cancellationToken);

            var metrics = new EnterpriseLeadsSummaryMetrics
            {
                TotalLeads = metricsDict.GetValueOrDefault("TOTAL", 0),
                PendingCount = metricsDict.GetValueOrDefault("PENDING", 0),
                ContactedCount = metricsDict.GetValueOrDefault("CONTACTED", 0),
                QualifiedCount = metricsDict.GetValueOrDefault("QUALIFIED", 0),
                ConvertedCount = metricsDict.GetValueOrDefault("CONVERTED", 0),
                RejectedCount = metricsDict.GetValueOrDefault("REJECTED", 0)
            };

            var dtos = leads.Select(l => new EnterpriseLeadAdminDto
            {
                Id = l.Id,
                Email = l.Email,
                CompanyName = l.CompanyName,
                JobTitle = l.JobTitle,
                ExpectedVolume = l.ExpectedVolume,
                Phone = l.Phone,
                TeamSize = l.TeamSize,
                Notes = l.Notes,
                Status = l.Status,
                InternalNotes = l.InternalNotes,
                ConvertedTenantId = l.ConvertedTenantId,
                ConvertedUserId = l.ConvertedUserId,
                IpAddress = l.IpAddress,
                CreatedAt = l.CreatedAt,
                UpdatedAt = l.UpdatedAt
            }).ToList();

            return new EnterpriseLeadsListResponse
            {
                Leads = dtos,
                Metrics = metrics,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<bool> UpdateLeadStatusAsync(Guid id, UpdateEnterpriseLeadStatusRequest request, CancellationToken cancellationToken = default)
        {
            try
            {
                return await _leadRepository.UpdateStatusAsync(id, request.Status, request.InternalNotes, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao atualizar status do lead {LeadId} para {Status}", id, request.Status);
                throw;
            }
        }

        public async Task<ProvisionEnterpriseAccountResponse> ProvisionEnterpriseAccountAsync(Guid leadId, ProvisionEnterpriseAccountRequest request, CancellationToken cancellationToken = default)
        {
            var lead = await _leadRepository.GetByIdAsync(leadId, cancellationToken);
            if (lead == null)
            {
                throw new KeyNotFoundException("Lead corporativo não encontrado.");
            }

            if (lead.Status == "CONVERTED" && lead.ConvertedTenantId.HasValue)
            {
                throw new InvalidOperationException("Este lead já foi provisionado anteriormente como Conta Enterprise.");
            }

            var tenantId = Guid.NewGuid();
            var tenantName = !string.IsNullOrWhiteSpace(request.TenantName) 
                ? request.TenantName.Trim() 
                : (!string.IsNullOrWhiteSpace(lead.CompanyName) ? lead.CompanyName : $"Empresa de {lead.Email}");

            Tenant newTenant;
            User user;

            try
            {
                // 1. Criação do Tenant com Plano ENTERPRISE e créditos customizados
                newTenant = new Tenant
                {
                    Id = tenantId,
                    Name = tenantName,
                    PlanTier = "ENTERPRISE",
                    CreditsBalance = request.CreditsBalance > 0 ? request.CreditsBalance : 50000,
                    ManagedCreditBalance = request.ManagedCreditBalance >= 0 ? request.ManagedCreditBalance : 100.00m,
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };

                await _tenantRepository.CreateAsync(newTenant, cancellationToken);

                // 2. Criação ou Vinculação do Usuário com papel TENANT_ADMIN (Controle total da sua própria loja)
                var existingUser = await _userRepository.GetByEmailAsync(lead.Email, cancellationToken);

                if (existingUser != null)
                {
                    existingUser.Role = "TENANT_ADMIN";
                    existingUser.TenantId = tenantId;
                    await _userRepository.UpdateAsync(existingUser, cancellationToken);
                    user = existingUser;
                }
                else
                {
                    var tempPassword = !string.IsNullOrWhiteSpace(request.TemporaryPassword) 
                        ? request.TemporaryPassword 
                        : $"Ent@{Guid.NewGuid().ToString("N").Substring(0, 8)}!";

                    var newUser = new User
                    {
                        Email = lead.Email,
                        FullName = request.AdminFullName ?? lead.CompanyName ?? "Administrador Enterprise",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword),
                        Role = "TENANT_ADMIN",
                        TenantId = tenantId
                    };

                    user = await _userRepository.CreateAsync(newUser, cancellationToken);
                }

                // 3. Marcação do Lead como Convertido
                await _leadRepository.MarkConvertedAsync(leadId, tenantId, user.Id, request.InternalNotes, cancellationToken);
                _logger.LogInformation("Conta Enterprise provisionada com sucesso para Lead {LeadId}, Tenant {TenantId}, Usuário {UserId}", leadId, tenantId, user.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao provisionar conta Enterprise para o Lead {LeadId} ({Email})", leadId, lead.Email);
                throw;
            }

            // 4. Notificação de Sucesso no Discord
            try
            {
                await _discordAlertService.SendInfoAlertAsync(
                    "🎉 Conta Enterprise Provisionada com Sucesso!",
                    $"🏢 **Tenant:** {tenantName}\n👤 **Admin:** {user.Email} (Role: TENANT_ADMIN)\n💳 **Créditos:** {newTenant.CreditsBalance:N0} produtos | Saldo IA: R$ {newTenant.ManagedCreditBalance:N2}\n🆔 **TenantId:** `{tenantId}`",
                    "EnterpriseLeadService");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha não bloqueante ao enviar notificação de conta provisionada para o Discord. TenantId: {TenantId}", tenantId);
            }

            return new ProvisionEnterpriseAccountResponse
            {
                LeadId = leadId,
                TenantId = tenantId,
                UserId = user.Id,
                TenantName = tenantName,
                AdminEmail = user.Email,
                PlanTier = "ENTERPRISE",
                CreditsBalance = newTenant.CreditsBalance,
                Status = "CONVERTED",
                Message = "Conta Enterprise provisionada com sucesso e vinculada ao Administrador da Empresa."
            };
        }
    }
