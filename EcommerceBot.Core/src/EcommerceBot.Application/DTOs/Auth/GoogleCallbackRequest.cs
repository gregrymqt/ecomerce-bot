namespace EcommerceBot.Application.DTOs.Auth
{
    public class GoogleCallbackRequest
    {
        public string Code { get; set; } = string.Empty;
        public string? TenantName { get; set; }
    }
}
