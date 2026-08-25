namespace EcommerceBot.Application.DTOs.Metering
{
    public class ReserveCreditsRequest
    {
        public string ModelUsed { get; set; } = string.Empty;
        public int EstimatedPromptTokens { get; set; }
        public int EstimatedCompletionTokens { get; set; }
    }
}
