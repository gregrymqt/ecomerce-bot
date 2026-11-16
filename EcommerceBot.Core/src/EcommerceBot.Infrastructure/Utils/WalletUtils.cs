using System;
using System.Globalization;
using EcommerceBot.Application.DTOs.Stripe;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Utils;

public interface IWalletUtils
{
    public RechargeResponseDto ToRechargeResponseDto(
        PaymentIntentResponse paymentIntent,
        Order order,
        int? creditsAdded = null);

    public (string FirstName, string LastName) ExtractNames(string? rawName);

    public string CleanDocumentSpan(ReadOnlySpan<char> document);
}

public sealed class WalletUtils : IWalletUtils
{
    public RechargeResponseDto ToRechargeResponseDto(
        PaymentIntentResponse paymentIntent,
        Order order,
        int? creditsAdded = null)
    {
        var isApproved = string.Equals(order.Status, "approved", StringComparison.OrdinalIgnoreCase)
                         || string.Equals(paymentIntent.Status, "succeeded", StringComparison.OrdinalIgnoreCase);

        return new RechargeResponseDto
        {
            OrderId = order.Id,
            PaymentId = order.MpPaymentId ?? paymentIntent.Id ?? order.Id.ToString(),
            Status = isApproved ? "approved" : order.Status,
            PaymentMethod = order.PaymentMethod,
            TotalAmount = order.TotalAmount,
            CreditsAdded = isApproved ? creditsAdded : null,
            ClientSecret = paymentIntent.ClientSecret,
            PixQrCode = order.PixQrCode,
            PixQrCodeBase64 = order.PixQrCodeBase64,
            TicketUrl = order.TicketUrl,
            ExpirationDate = order.PixExpirationDate
        };
    }

    /// <summary>
    /// Extrai Primeiro Nome e Sobrenome sem alocar arrays na Heap.
    /// </summary>
    public (string FirstName, string LastName) ExtractNames(string? rawName)
    {
        if (string.IsNullOrWhiteSpace(rawName))
            return ("Cliente", "Cliente");

        var span = rawName.AsSpan().Trim();
        var spaceIndex = span.IndexOf(' ');

        if (spaceIndex < 0)
        {
            var single = span.ToString();
            return (single, single);
        }

        var first = span[..spaceIndex].Trim().ToString();
        var lastSpan = span[(spaceIndex + 1)..].Trim();
        var last = lastSpan.IsEmpty ? first : lastSpan.ToString();

        return (first, last);
    }

    /// <summary>
    /// Remove pontuações de documentos usando stackalloc buffer sem alocar strings intermediárias.
    /// </summary>
    public string CleanDocumentSpan(ReadOnlySpan<char> document)
    {
        if (document.IsEmpty) return string.Empty;

        Span<char> buffer = stackalloc char[document.Length];
        var written = 0;

        for (var i = 0; i < document.Length; i++)
        {
            var c = document[i];
            if (char.IsLetterOrDigit(c))
            {
                buffer[written++] = c;
            }
        }

        return buffer[..written].ToString();
    }
}
