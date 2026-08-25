namespace EcommerceBot.Application.DTOs.Auth
{
    public class EnterpriseLeadRequest
    {
        public string Email { get; set; } = string.Empty;
        public string? CompanyName { get; set; }
        public string? JobTitle { get; set; }
        public string? ExpectedVolume { get; set; }
    }
}
