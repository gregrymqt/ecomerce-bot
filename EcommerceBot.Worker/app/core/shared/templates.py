import logging
from pathlib import Path
from typing import Any, Dict
from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

# Diretório base de templates do Worker
TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"

try:
    if not TEMPLATES_DIR.exists():
        TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

    # autoescape configurado estritamente para prevenção de XSS
    jinja_env = Environment(  # nosemgrep: python.flask.security.xss.audit.direct-use-of-jinja2.direct-use-of-jinja2
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml", "htm"]),
        trim_blocks=True,
        lstrip_blocks=True
    )
except Exception as e:
    logger.warning(f"Erro ao inicializar Jinja2 Environment: {e}")
    jinja_env = None


def render_jinja_template(template_name: str, context: Dict[str, Any]) -> str:
    """
    Renderiza um template Jinja2 localizado em app/templates/ com o dicionário de contexto fornecido.
    """
    if jinja_env is None:
        raise RuntimeError("Ambiente Jinja2 não inicializado.")

    template = jinja_env.get_template(template_name)
    return template.render(**context)  # nosemgrep: python.flask.security.xss.audit.direct-use-of-jinja2.direct-use-of-jinja2
