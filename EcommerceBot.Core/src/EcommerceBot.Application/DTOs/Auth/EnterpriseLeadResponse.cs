namespace EcommerceBot.Application.DTOs.Auth
{
    public class EnterpriseLeadResponse
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? CompanyName { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
