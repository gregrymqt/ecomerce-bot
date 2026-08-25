namespace EcommerceBot.Application.DTOs.Auth
{
    public class UpdateUserRequest
    {
        public string? Name { get; set; }
        public string? Password { get; set; }
        public string? Role { get; set; }
    }
}
