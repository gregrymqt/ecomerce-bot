from app.scraper.json_ld_parser import JsonLdParserService

def test_json_ld_parser_extracts_product():
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
    assert result["title"] == "Camiseta Algodao Egipcio"
    assert result["sku"] == "TSHIRT-001"
    assert result["price"] == 149.90
    assert result["brand"] == "Marca Exemplo"
    assert result["currency"] == "BRL"
