namespace EcommerceBot.Application.Interfaces;

public class EncryptedPayload
{
    public byte[] CipherText { get; set; } = [];
    public byte[] Nonce { get; set; } = [];
    public byte[] Tag { get; set; } = [];
}

public interface IAesGcmCryptoService
{
    EncryptedPayload Encrypt(string plainText);
    string Decrypt(EncryptedPayload encryptedPayload);
}
