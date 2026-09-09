using System;

namespace EcommerceBot.Application.Security;

/// <summary>
/// Validador de alto desempenho para documentos brasileiros (CPF e CNPJ) utilizando Span e Módulo 11.
/// Zero alocação na heap durante validações matemáticas.
/// </summary>
public static class DocumentValidator
{
    /// <summary>
    /// Remove quaisquer caracteres não numéricos.
    /// </summary>
    public static string Sanitize(string? document)
    {
        if (string.IsNullOrWhiteSpace(document)) return string.Empty;

        var span = document.AsSpan();
        Span<char> buffer = stackalloc char[span.Length];
        var written = 0;

        for (var i = 0; i < span.Length; i++)
        {
            if (char.IsDigit(span[i]))
            {
                buffer[written++] = span[i];
            }
        }

        return new string(buffer[..written]);
    }

    /// <summary>
    /// Valida se a string é um CPF ou CNPJ válido de acordo com o tipo especificado.
    /// </summary>
    public static bool IsValid(string? document, string? type = null)
    {
        var clean = Sanitize(document);
        if (clean.Length == 11 && (string.IsNullOrEmpty(type) || type.Equals("CPF", StringComparison.OrdinalIgnoreCase)))
        {
            return IsValidCpf(clean.AsSpan());
        }

        if (clean.Length == 14 && (string.IsNullOrEmpty(type) || type.Equals("CNPJ", StringComparison.OrdinalIgnoreCase)))
        {
            return IsValidCnpj(clean.AsSpan());
        }

        return false;
    }

    /// <summary>
    /// Validação matemática de CPF (11 dígitos, Módulo 11).
    /// </summary>
    public static bool IsValidCpf(ReadOnlySpan<char> cpf)
    {
        if (cpf.Length != 11) return false;

        // Rejeita sequências repetidas como 00000000000, 11111111111...
        var allSame = true;
        for (var i = 1; i < 11; i++)
        {
            if (cpf[i] != cpf[0])
            {
                allSame = false;
                break;
            }
        }
        if (allSame) return false;

        // 1º Dígito Verificador
        var sum1 = 0;
        for (var i = 0; i < 9; i++)
        {
            sum1 += (cpf[i] - '0') * (10 - i);
        }
        var remainder1 = sum1 % 11;
        var digit1 = remainder1 < 2 ? 0 : 11 - remainder1;
        if (cpf[9] - '0' != digit1) return false;

        // 2º Dígito Verificador
        var sum2 = 0;
        for (var i = 0; i < 10; i++)
        {
            sum2 += (cpf[i] - '0') * (11 - i);
        }
        var remainder2 = sum2 % 11;
        var digit2 = remainder2 < 2 ? 0 : 11 - remainder2;

        return cpf[10] - '0' == digit2;
    }

    /// <summary>
    /// Validação matemática de CNPJ (14 dígitos, Módulo 11).
    /// </summary>
    public static bool IsValidCnpj(ReadOnlySpan<char> cnpj)
    {
        if (cnpj.Length != 14) return false;

        // Rejeita sequências repetidas
        var allSame = true;
        for (var i = 1; i < 14; i++)
        {
            if (cnpj[i] != cnpj[0])
            {
                allSame = false;
                break;
            }
        }
        if (allSame) return false;

        ReadOnlySpan<int> weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        ReadOnlySpan<int> weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        // 1º Dígito Verificador
        var sum1 = 0;
        for (var i = 0; i < 12; i++)
        {
            sum1 += (cnpj[i] - '0') * weights1[i];
        }
        var remainder1 = sum1 % 11;
        var digit1 = remainder1 < 2 ? 0 : 11 - remainder1;
        if (cnpj[12] - '0' != digit1) return false;

        // 2º Dígito Verificador
        var sum2 = 0;
        for (var i = 0; i < 13; i++)
        {
            sum2 += (cnpj[i] - '0') * weights2[i];
        }
        var remainder2 = sum2 % 11;
        var digit2 = remainder2 < 2 ? 0 : 11 - remainder2;

        return cnpj[13] - '0' == digit2;
    }
}
