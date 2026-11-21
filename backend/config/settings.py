import os

from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def env_list(name, default=""):
    return [
        value.strip()
        for value in os.getenv(name, default).split(",")
        if value.strip()
    ]


DJANGO_ENV = os.getenv(
    "DJANGO_ENV",
    "development",
).strip().lower()

IS_PRODUCTION = DJANGO_ENV == "production"

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "Brak SECRET_KEY w zmiennych środowiskowych."
    )

DEBUG = env_bool(
    "DEBUG",
    not IS_PRODUCTION,
)

ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1",
)


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "auditlog",
    "vehicles",
    "drivers",
    "assignments",
    "organizations",
    "notifications",
    "contact",
]


MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "auditlog.middleware.AuditlogMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "config.urls"


TEMPLATES = [
    {
        "BACKEND": (
            "django.template.backends.django."
            "DjangoTemplates"
        ),
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                (
                    "django.template."
                    "context_processors.request"
                ),
                (
                    "django.contrib.auth."
                    "context_processors.auth"
                ),
                (
                    "django.contrib.messages."
                    "context_processors.messages"
                ),
            ],
        },
    },
]


WSGI_APPLICATION = "config.wsgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv(
            "POSTGRES_DB",
            "fleet_db",
        ),
        "USER": os.getenv(
            "POSTGRES_USER",
            "fleet_user",
        ),
        "PASSWORD": os.getenv(
            "POSTGRES_PASSWORD",
            "",
        ),
        "HOST": os.getenv(
            "DB_HOST",
            "localhost",
        ),
        "PORT": os.getenv(
            "DB_PORT",
            "5432",
        ),
        "CONN_MAX_AGE": int(
            os.getenv(
                "DB_CONN_MAX_AGE",
                "60" if IS_PRODUCTION else "0",
            )
        ),
        "CONN_HEALTH_CHECKS": IS_PRODUCTION,
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth."
            "password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth."
            "password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth."
            "password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth."
            "password_validation."
            "NumericPasswordValidator"
        ),
    },
]


LANGUAGE_CODE = "pl-pl"

TIME_ZONE = "Europe/Warsaw"

USE_I18N = True

USE_TZ = True


STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"

MEDIA_ROOT = Path(
    os.getenv(
        "MEDIA_ROOT",
        BASE_DIR / "media",
    )
)


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        (
            "rest_framework_simplejwt."
            "authentication."
            "JWTAuthentication"
        ),
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        (
            "rest_framework.permissions."
            "IsAuthenticated"
        ),
    ),
}


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=15,
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=7,
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "CHECK_REVOKE_TOKEN": True,
    "REVOKE_TOKEN_CLAIM": "hash_password",
}


CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173",
)

CORS_ALLOW_CREDENTIALS = False

CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173",
)


SECURE_CONTENT_TYPE_NOSNIFF = True

SECURE_REFERRER_POLICY = "same-origin"

X_FRAME_OPTIONS = "DENY"

SECURE_SSL_REDIRECT = env_bool(
    "SECURE_SSL_REDIRECT",
    IS_PRODUCTION,
)

SESSION_COOKIE_SECURE = env_bool(
    "SESSION_COOKIE_SECURE",
    IS_PRODUCTION,
)

CSRF_COOKIE_SECURE = env_bool(
    "CSRF_COOKIE_SECURE",
    IS_PRODUCTION,
)

SECURE_HSTS_SECONDS = int(
    os.getenv(
        "SECURE_HSTS_SECONDS",
        "0",
    )
)

SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool(
    "SECURE_HSTS_INCLUDE_SUBDOMAINS",
    False,
)

SECURE_HSTS_PRELOAD = env_bool(
    "SECURE_HSTS_PRELOAD",
    False,
)

if IS_PRODUCTION:
    SECURE_PROXY_SSL_HEADER = (
        "HTTP_X_FORWARDED_PROTO",
        "https",
    )


EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    (
        "django.core.mail.backends."
        "console.EmailBackend"
    ),
)

EMAIL_HOST = os.getenv(
    "EMAIL_HOST",
    "",
)

EMAIL_PORT = int(
    os.getenv(
        "EMAIL_PORT",
        "587",
    )
)

EMAIL_HOST_USER = os.getenv(
    "EMAIL_HOST_USER",
    "",
)

EMAIL_HOST_PASSWORD = os.getenv(
    "EMAIL_HOST_PASSWORD",
    "",
)

EMAIL_USE_TLS = env_bool(
    "EMAIL_USE_TLS",
    True,
)

DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    "Flotivo <no-reply@flotivo.local>",
)

CONTACT_EMAIL = os.getenv(
    "CONTACT_EMAIL",
    EMAIL_HOST_USER,
)


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": (
                "{levelname} {asctime} "
                "{name} {message}"
            ),
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "root": {
        "handlers": [
            "console",
        ],
        "level": os.getenv(
            "DJANGO_LOG_LEVEL",
            "INFO",
        ),
    },
}