import asyncio
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ValidationError
import json
import html2text
from bs4 import BeautifulSoup

from openai import AsyncOpenAI
import openai


class ProductExtractionSchema(BaseModel):
    title: Optional[str] = Field(description="The name or title of the product.")
    description: Optional[str] = Field(description="The description of the product.")
    price: Optional[str] = Field(description="The price of the product as a string (e.g., '19.99').")
    currency: Optional[str] = Field(description="The currency of the price (e.g., 'USD', 'BRL').")
    image_url: Optional[str] = Field(description="The URL of the product's main image.")
    sku: Optional[str] = Field(description="The SKU or unique identifier of the product.")


class LLMParserException(Exception):
    """Exceção customizada para erros relacionados à chamada da API da LLM."""
    pass


class MarkdownParserService:
    """
    Serviço assíncrono que atua como Estratégia 2 (Fallback Universal).
    Recebe um HTML bruto, limpa o ruído, converte-o para Markdown e utiliza a API
    da OpenAI para extrair os dados do produto em formato JSON estruturado.
    """

    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        """
        Inicializa o serviço de parsing via LLM.

        Args:
            api_key: Chave de API da OpenAI.
            model: Modelo leve a ser utilizado (padrão: deepseek-chat).
        """
        self.client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        self.model = model
        
        # Configuração do html2text (Passo 2)
        self.html2text_converter = html2text.HTML2Text()
        self.html2text_converter.ignore_links = False
        self.html2text_converter.ignore_images = True  # ignorar imagens decorativas para focar no texto
        self.html2text_converter.ignore_tables = False
        self.html2text_converter.body_width = 0

    def _sanitize_html(self, raw_html: str) -> str:
        """
        Passo 1: Sanitização Crítica.
        Remove tags desnecessárias e isola o conteúdo principal para economizar tokens.
        """
        soup = BeautifulSoup(raw_html, "html.parser")

        # Remove tags geradoras de ruído
        tags_to_remove = ["script", "style", "nav", "footer", "header", "iframe", "noscript"]
        for tag in tags_to_remove:
            for element in soup.find_all(tag):
                element.decompose()

        # Isolar o conteúdo principal
        main_content = soup.find("main") or soup.find("article") or soup.find("body")

        if main_content:
            return str(main_content)
        return str(soup)

    def _convert_to_markdown(self, clean_html: str) -> str:
        """
        Passo 2: Conversão.
        Transforma o HTML higienizado em Markdown focado no texto e tabelas de atributos.
        """
        return self.html2text_converter.handle(clean_html)

    async def parse(self, raw_html: str) -> Dict[str, Any]:
        """
        Método principal (Pipeline Completo).
        Sanitiza o HTML, converte para Markdown e envia para a LLM extrair o JSON.

        Args:
            raw_html: Código fonte HTML bruto da página do produto.

        Returns:
            Dict: Os dados estruturados extraídos, de acordo com o Schema definido.
                  Retorna os campos como None se o produto não for identificado.
        """
        clean_html = self._sanitize_html(raw_html)
        markdown_text = self._convert_to_markdown(clean_html)

        # Passo 3: Prompt Engineering para Extração Pura
        system_prompt = (
            "Você é um extrator de dados de e-commerce altamente especializado, operando como um pipeline automatizado. "
            "Sua única tarefa é analisar o texto Markdown fornecido (que foi extraído de uma página web) "
            "e extrair os dados do produto principal da página. Retorne as informações estritamente de acordo com o schema solicitado. "
            "Se algum campo não estiver presente ou não puder ser determinado com segurança absoluta, retorne null para esse campo. "
            "Se o texto não descrever nenhum produto (por exemplo, página de erro, captcha, ou listagem sem foco), retorne null para todos os campos."
        )

        try:
            # Passo 4: Garantia de Output com JSON Mode do DeepSeek
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extraia os dados de produto do seguinte texto Markdown:\n\n{markdown_text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.0  # Temperatura zero para máxima determinismo e precisão
            )

            content = completion.choices[0].message.content
            product_data = ProductExtractionSchema.model_validate_json(content)
            
            if product_data:
                return product_data.model_dump()
            
            return self._empty_response()

        except openai.APIError as e:
            raise LLMParserException(f"Erro na API do DeepSeek: {str(e)}") from e
        except openai.RateLimitError as e:
            raise LLMParserException(f"Limite de cota/rate limit excedido no DeepSeek: {str(e)}") from e
        except (ValidationError, json.JSONDecodeError) as e:
            raise LLMParserException(f"Erro ao converter JSON do DeepSeek para ProductExtractionSchema: {str(e)}") from e
        except Exception as e:
            raise LLMParserException(f"Falha inesperada ao processar extração via LLM: {str(e)}") from e

    def _empty_response(self) -> Dict[str, Any]:
        """Retorna o dicionário padrão com todos os campos nulos."""
        return {
            "title": None,
            "description": None,
            "price": None,
            "currency": None,
            "image_url": None,
            "sku": None
        }
