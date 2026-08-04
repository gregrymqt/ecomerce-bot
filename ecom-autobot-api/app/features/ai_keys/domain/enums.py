from enum import Enum


class AIProvider(str, Enum):
    DEEPSEEK = "DEEPSEEK"
    GROQ = "GROQ"
    OPENAI = "OPENAI"
    GEMINI = "GEMINI"
    OPENROUTER = "OPENROUTER"
