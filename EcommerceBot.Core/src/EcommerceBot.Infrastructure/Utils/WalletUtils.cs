
using System.Globalization;
using EcommerceBot.Application.DTOs.MercadoPago;
using EcommerceBot.Application.DTOs.Wallet;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Utils;

public sealed class WalletUtils
{
    public MercadoPagoPayerRequest BuildMercadoPagoPayer(
        User? user,
        RechargePayerDto? existingPayer,
        TenantBillingProfile? billingProfile)
    {
        var (firstName, lastName) = ExtractNames(existingPayer?.FirstName ?? billingProfile?.LegalName ?? user?.FullName);
        if (!string.IsNullOrWhiteSpace(existingPayer?.LastName))
        {
            lastName = existingPayer.LastName;
        }

        var docType = existingPayer?.IdentificationType ?? billingProfile?.DocumentType ?? "CPF";
        var rawDoc = existingPayer?.IdentificationNumber ?? billingProfile?.DocumentNumber ?? string.Empty;
        var cleanDoc = CleanDocumentSpan(rawDoc.AsSpan());

        var zipCode = existingPayer?.Address?.ZipCode ?? billingProfile?.ZipCode ?? "01001-000";
        var streetName = existingPayer?.Address?.StreetName ?? billingProfile?.StreetName ?? "Avenida Paulista";
        var streetNumber = existingPayer?.Address?.StreetNumber ?? billingProfile?.StreetNumber ?? "1000";
        var neighborhood = existingPayer?.Address?.Neighborhood ?? billingProfile?.Neighborhood ?? "Bela Vista";
        var city = existingPayer?.Address?.City ?? billingProfile?.City ?? "São Paulo";
        var federalUnit = existingPayer?.Address?.FederalUnit ?? billingProfile?.FederalUnit ?? "SP";
        var complement = existingPayer?.Address?.Complement ?? billingProfile?.Complement;

        return new MercadoPagoPayerRequest
        {
            Email = existingPayer?.Email ?? billingProfile?.Email ?? user?.Email ?? "financeiro@ecommercebot.local",
            FirstName = firstName,
            LastName = lastName,
            Identification = !string.IsNullOrWhiteSpace(cleanDoc)
                ? new MercadoPagoIdentificationRequest { Type = docType, Number = cleanDoc }
                : null,
            Address = new MercadoPagoAddressRequest
            {
                ZipCode = zipCode,
                StreetName = streetName,
                StreetNumber = streetNumber,
                Neighborhood = neighborhood,
                City = city,
                FederalUnit = federalUnit,
                Complement = complement
            }
        };
    }

    public RechargeResponseDto ToRechargeResponseDto(
    MercadoPagoOrderResponse mpResponse,
    Order order,
    int? creditsAdded = null)
    {
        var firstPayment = mpResponse.Transactions?.Payments?.FirstOrDefault();
        var isApproved = string.Equals(order.Status, "approved", StringComparison.OrdinalIgnoreCase);

        return new RechargeResponseDto
        {
            OrderId = order.Id,
            PaymentId = order.MpPaymentId ?? firstPayment?.Id ?? mpResponse.Id ?? order.Id.ToString(),
            Status = order.Status,
            PaymentMethod = order.PaymentMethod,
            TotalAmount = order.TotalAmount,
            CreditsAdded = isApproved ? creditsAdded : null,

            // Dados exclusivos para PIX
            PixQrCode = order.PixQrCode ?? firstPayment?.PaymentMethod?.QrCode,
            PixQrCodeBase64 = order.PixQrCodeBase64 ?? firstPayment?.PaymentMethod?.QrCodeBase64,
            TicketUrl = order.TicketUrl ?? firstPayment?.PaymentMethod?.TicketUrl,
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