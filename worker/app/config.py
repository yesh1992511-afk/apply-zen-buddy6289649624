from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    JOBPILOT_USER_ID: str

    # Scraping
    APIFY_TOKEN: str = ""

    # AI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_REASONER_MODEL: str = "deepseek-reasoner"
    DEEPSEEK_CHAT_MODEL: str = "deepseek-chat"

    # Captcha
    CAPTCHA_PROVIDER: str = "2captcha"
    CAPTCHA_API_KEY: str = ""

    # Proxies
    PROXY_HOST: str = ""
    PROXY_PORT: str = ""
    PROXY_USER: str = ""
    PROXY_PASS: str = ""
    PROXY_COUNTRY: str = "US"

    # Gmail
    GMAIL_OAUTH_CLIENT_ID: str = ""
    GMAIL_OAUTH_CLIENT_SECRET: str = ""
    GMAIL_OAUTH_REFRESH_TOKEN: str = ""
    GMAIL_EMAIL: str = ""

    # Apply
    APPLY_EMAIL: str = ""
    APPLY_PASSWORD: str = ""
    APPLY_DEFAULT_PHONE: str = ""
    # Cookie pipe — must match the extension's Options-page passphrase
    COOKIE_PIPE_PASSPHRASE: str = ""


    # Misc
    ALERT_WEBHOOK_URL: str = ""
    LOG_LEVEL: str = "INFO"
    WORKER_VERSION: str = "0.1.0"


@lru_cache
def settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
