using System;
using System.Security.Cryptography;
using System.Text;
using EcommerceBot.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace EcommerceBot.Infrastructure.Services;

public class AesGcmCryptoService : IAesGcmCryptoService
{
    private readonly byte[] _masterKey;

    public AesGcmCryptoService(IConfiguration configuration)
    {
        var keyHex = configuration["Security:AesMasterKey"] 
                     ?? throw new ArgumentNullException("Security:AesMasterKey", "Master key is required for BYOK encryption.");
        
        _masterKey = Convert.FromHexString(keyHex);
        
        if (_masterKey.Length != 32)
        {
            throw new ArgumentException("AES-256 GCM requires a 32-byte (256-bit) master key.");
        }
    }

    public EncryptedPayload Encrypt(string plainText)
    {
        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var nonce = new byte[AesGcm.NonceByteSizes.MaxSize];
        RandomNumberGenerator.Fill(nonce);

        var cipherText = new byte[plainBytes.Length];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];

        using var aesGcm = new AesGcm(_masterKey, tag.Length);
        aesGcm.Encrypt(nonce, plainBytes, cipherText, tag);

        return new EncryptedPayload
        {
            CipherText = cipherText,
            Nonce = nonce,
            Tag = tag
        };
    }

    public string Decrypt(EncryptedPayload encryptedPayload)
    {
        var plainBytes = new byte[encryptedPayload.CipherText.Length];

        using var aesGcm = new AesGcm(_masterKey, encryptedPayload.Tag.Length);
        aesGcm.Decrypt(encryptedPayload.Nonce, encryptedPayload.CipherText, encryptedPayload.Tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}
