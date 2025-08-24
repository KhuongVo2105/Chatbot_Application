from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "khoaluan_db"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # Mail
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int = 587
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

    # Google
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str

    # HuggingFace
    HUGGING_FACE_API_KEY: str
    HUGGING_FACE_MODEL_ID: str = "deepseek-ai/DeepSeek-V3-0324"

    RAG_JSON_DATA: str = "app/assets/all_vector_data.json"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    FAISS_INDEX_PATH: str = "app/assets/all_vector_index.faiss"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding='utf-8')


settings = Settings()
