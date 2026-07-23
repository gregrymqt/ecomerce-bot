import asyncio
from typing import Optional, Dict
from pydantic import BaseModel, Field, ValidationError
import json
import html2text
from bs4 import BeautifulSoup
from openai import AsyncOpenAI
import openai
from app.features.scraper.schemas import ScrapedProductResult

class ProductExtractionSchema(BaseModel):
    title: Optional[str] = Field(description="The name or title of the product.")
    description: Optional[str] = Field(description="The description of the product.")
    price: Optional[str] = Field(description="The price of the product as a string (e.g., '19.99').")
    currency: Optional[str] = Field(description="The currency of the price (e.g., 'USD', 'BRL').")
    image_url: Optional[str] = Field(description="The URL of the product's main image.")
    sku: Optional[str] = Field(description="The SKU or unique identifier of the product.")

class LLMParserException(Exception):
    pass

class MarkdownParserService:
    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        self.client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        self.model = model
        
        self.html2text_converter = html2text.HTML2Text()
        self.html2text_converter.ignore_links = False
        self.html2text_converter.ignore_images = True
        self.html2text_converter.ignore_tables = False
        self.html2text_converter.body_width = 0

    def _sanitize_html(self, raw_html: str) -> str:
        soup = BeautifulSoup(raw_html, "html.parser")
        tags_to_remove = ["script", "style", "nav", "footer", "header", "iframe", "noscript"]
        for tag in tags_to_remove:
            for element in soup.find_all(tag):
                element.decompose()

        main_content = soup.find("main") or soup.find("article") or soup.find("body")
        if main_content:
            return str(main_content)
        return str(soup)

    def _convert_to_markdown(self, clean_html: str) -> str:
        return self.html2text_converter.handle(clean_html)

    async def parse(self, raw_html: str) -> ScrapedProductResult:
        clean_html = self._sanitize_html(raw_html)
        markdown_text = self._convert_to_markdown(clean_html)

        system_prompt = (
            "Você é um extrator de dados de e-commerce altamente especializado, operando como um pipeline automatizado. "
            "Sua única tarefa é analisar o texto Markdown fornecido (que foi extraído de uma página web) "
            "e extrair os dados do produto principal da página. Retorne as informações estritamente de acordo com o schema solicitado. "
            "Se algum campo não estiver presente ou não puder ser determinado com segurança absoluta, retorne null para esse campo. "
            "Se o texto não descrever nenhum produto (por exemplo, página de erro, captcha, ou listagem sem foco), retorne null para todos os campos."
        )

        try:
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extraia os dados de produto do seguinte texto Markdown:\n\n{markdown_text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.0
            )

            content = completion.choices[0].message.content
            product_data = ProductExtractionSchema.model_validate_json(content)
            
            if product_data:
                return ScrapedProductResult(
                    title=product_data.title,
                    description=product_data.description,
                    price=product_data.price,
                    currency=product_data.currency,
                    image_url=product_data.image_url,
                    sku=product_data.sku,
                )
            
            return self._empty_response()

        except openai.APIError as e:
            raise LLMParserException(f"Erro na API do DeepSeek: {str(e)}") from e
        except openai.RateLimitError as e:
            raise LLMParserException(f"Limite de cota/rate limit excedido no DeepSeek: {str(e)}") from e
        except (ValidationError, json.JSONDecodeError) as e:
            raise LLMParserException(f"Erro ao converter JSON do DeepSeek para ProductExtractionSchema: {str(e)}") from e
        except Exception as e:
            raise LLMParserException(f"Falha inesperada ao processar extração via LLM: {str(e)}") from e

    def _empty_response(self) -> ScrapedProductResult:
        return ScrapedProductResult()
