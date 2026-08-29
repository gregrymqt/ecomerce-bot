using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BCrypt.Net;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Services
{
    public class EnterpriseLeadService : IEnterpriseLeadService
    {
        private readonly IEnterpriseLeadRepository _leadRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly IUserRepository _userRepository;
        private readonly IDiscordAlertService _discordAlertService;

        public EnterpriseLeadService(
            IEnterpriseLeadRepository leadRepository,
            ITenantRepository tenantRepository,
            IUserRepository userRepository,
            IDiscordAlertService discordAlertService)
        {
            _leadRepository = leadRepository;
            _tenantRepository = tenantRepository;
            _userRepository = userRepository;
            _discordAlertService = discordAlertService;
        }

        public async Task<EnterpriseLeadResponse> RegisterLeadAsync(EnterpriseLeadRequest request, string? ipAddress)
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

            var created = await _leadRepository.CreateAsync(lead);

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
            catch
            {
                // Falha de notificação externa não impede o registro do lead
            }

            return new EnterpriseLeadResponse
            {
                Id = created.Id,
                Email = created.Email,
                CompanyName = created.CompanyName ?? string.Empty,
                Message = "Solicitação corporativa registrada com sucesso. Nossa equipe entrará em contato."
            };
        }

        public async Task<EnterpriseLeadsListResponse> GetLeadsAsync(string? status, string? search, int page, int pageSize)
        {
            var (leads, totalCount) = await _leadRepository.GetAllAsync(status, search, page, pageSize);
            var metricsDict = await _leadRepository.GetMetricsAsync();

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

        public async Task<bool> UpdateLeadStatusAsync(Guid id, UpdateEnterpriseLeadStatusRequest request)
        {
            return await _leadRepository.UpdateStatusAsync(id, request.Status, request.InternalNotes);
        }

        public async Task<ProvisionEnterpriseAccountResponse> ProvisionEnterpriseAccountAsync(Guid leadId, ProvisionEnterpriseAccountRequest request)
        {
            var lead = await _leadRepository.GetByIdAsync(leadId);
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

            // 1. Criação do Tenant com Plano ENTERPRISE e créditos customizados
            var newTenant = new Tenant
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

            await _tenantRepository.CreateAsync(newTenant);

            // 2. Criação ou Vinculação do Usuário com papel TENANT_ADMIN (Controle total da sua própria loja)
            var existingUser = await _userRepository.GetByEmailAsync(lead.Email);
            User user;

            if (existingUser != null)
            {
                existingUser.Role = "TENANT_ADMIN";
                existingUser.TenantId = tenantId;
                await _userRepository.UpdateAsync(existingUser);
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

                user = await _userRepository.CreateAsync(newUser);
            }

            // 3. Marcação do Lead como Convertido
            await _leadRepository.MarkConvertedAsync(leadId, tenantId, user.Id, request.InternalNotes);

            // 4. Notificação de Sucesso no Discord
            try
            {
                await _discordAlertService.SendInfoAlertAsync(
                    "🎉 Conta Enterprise Provisionada com Sucesso!",
                    $"🏢 **Tenant:** {tenantName}\n👤 **Admin:** {user.Email} (Role: TENANT_ADMIN)\n💳 **Créditos:** {newTenant.CreditsBalance:N0} produtos | Saldo IA: R$ {newTenant.ManagedCreditBalance:N2}\n🆔 **TenantId:** `{tenantId}`",
                    "EnterpriseLeadService");
            }
            catch
            {
                // Ignora falhas externas de notificação
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
}
