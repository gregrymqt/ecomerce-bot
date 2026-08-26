import unittest
from app.scraper.json_ld_parser import JsonLdParserService

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

if __name__ == "__main__":
    unittest.main()
