"""OpenAI-compatible client factory. Used for both OpenAI and DeepSeek."""
from openai import OpenAI
from ..config import settings


def openai_client() -> OpenAI:
    return OpenAI(api_key=settings().OPENAI_API_KEY)


def deepseek_client() -> OpenAI:
    return OpenAI(
        api_key=settings().DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com/v1",
    )
