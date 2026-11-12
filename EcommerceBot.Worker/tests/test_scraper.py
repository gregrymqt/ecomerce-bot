import unittest
from unittest.mock import AsyncMock, patch
from app.scraper.json_ld_parser import JsonLdParserService
from app.scraper.scrapling_client import ScraplingEngineService


class TestScraperModule(unittest.TestCase):
    def test_json_ld_parser_extracts_product(self):
        parser = JsonLdParserService()
        sample_json_ld = [
            """{
                "@context": "https://schema.org/",
                "@type": "Product",
                "name": "Camiseta Algodao Egipcio",
                "image": "https://example.com/images/shirt.jpg",
                "description": "Camiseta premium 100% algodao egipcio.",
                "sku": "TSHIRT-001",
                "brand": {
                    "@type": "Brand",
                    "name": "Marca Exemplo"
                },
                "offers": {
                    "@type": "Offer",
                    "priceCurrency": "BRL",
                    "price": "149.90",
                    "availability": "https://schema.org/InStock"
                }
            }"""
        ]

        result = parser.extract_from_json_ld(sample_json_ld)
        self.assertEqual(result["title"], "Camiseta Algodao Egipcio")
        self.assertEqual(result["sku"], "TSHIRT-001")
        self.assertEqual(result["price"], 149.90)
        self.assertEqual(result["brand"], "Marca Exemplo")
        self.assertEqual(result["currency"], "BRL")


class TestScraplingClientSecurity(unittest.IsolatedAsyncioTestCase):
    async def test_fetch_page_uses_async_validate_url_safety_and_blocks_ssrf(self):
        client = ScraplingEngineService()
        with patch(
            "app.scraper.scrapling_client.async_validate_url_safety",
            new=AsyncMock(side_effect=ValueError("Acesso a host local proibido")),
        ) as mock_validate:
            with self.assertRaises(ValueError):
                await client.fetch_page("http://127.0.0.1/admin")
            mock_validate.assert_awaited_once_with("http://127.0.0.1/admin")


if __name__ == "__main__":
    unittest.main()
