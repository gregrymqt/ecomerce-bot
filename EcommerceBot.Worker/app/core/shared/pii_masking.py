import re
import logging
from typing import Any

logger = logging.getLogger("worker.security.pii")

# Tentativa de inicialização opcional do Microsoft Presidio
_presidio_available = False
_analyzer: Any = None
_anonymizer: Any = None

try:
    from presidio_analyzer import AnalyzerEngine
    from presidio_anonymizer import AnonymizerEngine

    _analyzer = AnalyzerEngine()
    _anonymizer = AnonymizerEngine()
    _presidio_available = True
    logger.info("Microsoft Presidio carregado com sucesso para sanitização de PII.")
except Exception as presidio_init_err:
    logger.debug(f"Microsoft Presidio não disponível ({presidio_init_err}). Utilizando motor determinístico de alta performance.")

# Expressões Regulares Especializadas
_EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
_CPF_REGEX = re.compile(r'\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})\b')
_PHONE_WITH_DDD_REGEX = re.compile(
    r'(?<![\d-])(?:(?:\+?55\s?)?\(?0?[1-9]{2}\)?\s?)(?:9\s?\d{4}[-.\s]?\d{4}|[2-8]\d{3}[-.\s]?\d{4})(?![\d-])'
)
_PHONE_LOCAL_REGEX = re.compile(
    r'(?<![\d-])(?:9\d{4}[-.\s]\d{4}|[2-8]\d{3}[-.\s]\d{4})(?![\d-])'
)
_CREDIT_CARD_REGEX = re.compile(
    r'\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b'
)
_HTML_COMMENT_REGEX = re.compile(r'<!--[\s\S]*?-->')
_ZERO_WIDTH_CHARS_REGEX = re.compile(r'[\u200b\u200c\u200d\ufeff\u200e\u200f]')


def is_valid_cpf(cpf_str: str) -> bool:
    """Valida se uma string candidata representa um CPF matematicamente válido."""
    digits = [int(d) for d in cpf_str if d.isdigit()]
    if len(digits) != 11 or len(set(digits)) == 1:
        return False

    # Primeiro dígito verificador
    s1 = sum(digits[i] * (10 - i) for i in range(9))
    d1 = (s1 * 10) % 11
    d1 = 0 if d1 == 10 else d1
    if d1 != digits[9]:
        return False

    # Segundo dígito verificador
    s2 = sum(digits[i] * (11 - i) for i in range(10))
    d2 = (s2 * 10) % 11
    d2 = 0 if d2 == 10 else d2
    return d2 == digits[10]


def is_valid_luhn(card_str: str) -> bool:
    """Valida se uma sequência numérica de 13 a 19 dígitos atende ao algoritmo de Luhn (cartões de crédito)."""
    digits = [int(d) for d in card_str if d.isdigit()]
    if not (13 <= len(digits) <= 19):
        return False

    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0


def sanitize_untrusted_text(text: str) -> str:
    """
    Higieniza textos não confiáveis extraídos de páginas web ou entradas de usuários:
    - Remove comentários HTML ocultos (vetor comum de prompt injection indireto).
    - Remove caracteres de controle invisíveis (zero-width characters).
    - Escapa tags delimitadoras do sistema para evitar fuga de contexto (<scraped_content>, <user_data>).
    """
    if not text:
        return ""

    # 1. Remove comentários HTML
    clean_text = _HTML_COMMENT_REGEX.sub("", text)

    # 2. Remove caracteres de largura zero e caracteres de controle de formatação
    clean_text = _ZERO_WIDTH_CHARS_REGEX.sub("", clean_text)

    # 3. Neutraliza tags delimitadoras protegidas para evitar quebra de sandbox
    protected_tags = [
        "scraped_content", "/scraped_content",
        "user_data", "/user_data",
        "system_instruction", "/system_instruction"
    ]
    for tag in protected_tags:
        clean_text = clean_text.replace(f"<{tag}>", f"&lt;{tag}&gt;")

    return clean_text


def sanitize_llm_input(text: str) -> str:
    """
    Higieniza textos antes do envio para APIs de LLM (OpenRouter, Gemini, DeepSeek),
    mascarando dados pessoais sensíveis (PII) em conformidade com a LGPD e OWASP LLM02.
    
    Campos mascarados:
    - CPF -> [CPF_MASCARADO]
    - Cartões de Crédito -> [CARTAO_MASCARADO]
    - Telefones -> [TELEFONE_MASCARADO]
    - E-mails -> [EMAIL_MASCARADO]
    """
    if not text or not isinstance(text, str):
        return ""

    result = text

    # Se Presidio estiver ativo e configurado, executa análise primária
    if _presidio_available and _analyzer and _anonymizer:
        try:
            analyzer_results = _analyzer.analyze(
                text=result,
                entities=["PHONE_NUMBER", "EMAIL_ADDRESS", "CREDIT_CARD"],
                language="en"
            )
            anonymized = _anonymizer.anonymize(text=result, analyzer_results=analyzer_results)
            result = anonymized.text
        except Exception as presidio_err:
            logger.warning(f"Falha na sanitização Presidio ({presidio_err}). Executando motor determinístico fallback.")

    # Sanitização de E-mails
    result = _EMAIL_REGEX.sub("[EMAIL_MASCARADO]", result)

    # Sanitização de CPFs (apenas válidos para evitar falsos positivos com códigos/SKUs numéricos)
    def _cpf_replacer(match: re.Match) -> str:
        matched_val = match.group(0)
        return "[CPF_MASCARADO]" if is_valid_cpf(matched_val) else matched_val

    result = _CPF_REGEX.sub(_cpf_replacer, result)

    # Sanitização de Cartões de Crédito (com validação Luhn)
    def _card_replacer(match: re.Match) -> str:
        matched_val = match.group(0)
        return "[CARTAO_MASCARADO]" if is_valid_luhn(matched_val) else matched_val

    result = _CREDIT_CARD_REGEX.sub(_card_replacer, result)

    # Sanitização de Telefones
    result = _PHONE_WITH_DDD_REGEX.sub("[TELEFONE_MASCARADO]", result)
    result = _PHONE_LOCAL_REGEX.sub("[TELEFONE_MASCARADO]", result)

    return result
