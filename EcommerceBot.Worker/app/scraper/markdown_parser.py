import logging
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ValidationError
import json
import html2text
from bs4 import BeautifulSoup
from openai import AsyncOpenAI
import openai
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

class ProductExtractionSchema(BaseModel):
    title: Optional[str] = Field(None, description="Nome ou título do produto.")
    description: Optional[str] = Field(None, description="Descrição detalhada do produto.")
    price: Optional[str] = Field(None, description="Preço do produto em formato numérico (ex: '19.99' ou '1299.00').")
    currency: Optional[str] = Field("BRL", description="Moeda do preço (ex: 'BRL', 'USD').")
    image_url: Optional[str] = Field(None, description="URL da imagem principal do produto.")
    sku: Optional[str] = Field(None, description="SKU ou identificador único do produto.")
    brand: Optional[str] = Field(None, description="Marca do produto.")
    category: Optional[str] = Field(None, description="Categoria do produto.")

class LLMParserException(Exception):
    pass

class MarkdownParserService:
    """
    Serviço de extração via LLM (DeepSeek / OpenRouter) que converte o HTML ruidoso
    em Markdown limpo e solicita a extração de dados estruturados com JSON Mode.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "deepseek-chat"):
        key = api_key or getattr(settings, "DEEPSEEK_API_KEY", "") or getattr(settings, "OPENROUTER_API_KEY", "")
        base_url = "https://api.deepseek.com" if (getattr(settings, "DEEPSEEK_API_KEY", None) and key == settings.DEEPSEEK_API_KEY) else "https://openrouter.ai/api/v1"
        self.client = AsyncOpenAI(api_key=key, base_url=base_url) if key else None
        self.model = model
        
        self.html2text_converter = html2text.HTML2Text()
        self.html2text_converter.ignore_links = False
        self.html2text_converter.ignore_images = True
        self.html2text_converter.ignore_tables = False
        self.html2text_converter.body_width = 0

    def _sanitize_html(self, raw_html: str) -> str:
        soup = BeautifulSoup(raw_html, "html.parser")
        tags_to_remove = ["script", "style", "nav", "footer", "header", "iframe", "noscript", "svg"]
        for tag in tags_to_remove:
            for element in soup.find_all(tag):
                element.decompose()

        main_content = soup.find("main") or soup.find("article") or soup.find("body")
        if main_content:
            return str(main_content)
        return str(soup)

    def _convert_to_markdown(self, clean_html: str) -> str:
        return self.html2text_converter.handle(clean_html)

    async def parse(self, raw_html: str) -> Dict[str, Any]:
        if not self.client:
            logger.warning("Nenhuma API Key (DeepSeek/OpenRouter) disponível para MarkdownParserService.")
            return {}

        clean_html = self._sanitize_html(raw_html)
        markdown_text = self._convert_to_markdown(clean_html)

        # Limita o Markdown a 12.000 caracteres para economia de tokens
        if len(markdown_text) > 12000:
            markdown_text = markdown_text[:12000]

        system_prompt = (
            "Você é um extrator de dados de e-commerce de alta precisão. "
            "Sua tarefa é analisar o texto Markdown extraído de uma página web "
            "e extrair estritamente os dados do produto principal no formato JSON solicitado. "
            "Se algum campo não existir com clareza, retorne null."
        )

        try:
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extraia os dados do produto do seguinte texto Markdown:\n\n{markdown_text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.0
            )

            content = completion.choices[0].message.content
            if content:
                data = json.loads(content)
                return data
            return {}

        except Exception as e:
            logger.warning(f"Falha na extração de Markdown via LLM: {e}")
            return {}
