import os

from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(
    BASE_DIR / ".env",
    override=False,
)

DJANGO_ENV = os.getenv(
    "DJANGO_ENV",
    "development",
).strip().lower()

IS_PRODUCTION = DJANGO_ENV == "production"

if IS_PRODUCTION:
    load_dotenv(
        BASE_DIR / ".env.production",
        override=False,
    )


def env_bool(
    name,
    default=False,
):
    return (
        os.getenv(
            name,
            str(default),
        )
        .strip()
        .lower()
        in {
            "1",
            "true",
            "yes",
            "on",
        }
    )


def env_list(
    name,
    default="",
):
    return [
        value.strip()
        for value
        in os.getenv(
            name,
            default,
        ).split(",")
        if value.strip()
    ]


def env_int(
    name,
    default,
):
    try:
        return int(
            os.getenv(
                name,
                str(default),
            )
        )
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise RuntimeError(
            (
                f"Zmienna {name} musi być "
                "liczbą całkowitą."
            )
        ) from exc


SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "",
).strip()

if not SECRET_KEY:
    raise RuntimeError(
        (
            "Brak SECRET_KEY w zmiennych "
            "środowiskowych."
        )
    )


DEBUG = env_bool(
    "DEBUG",
    not IS_PRODUCTION,
)

if (
    IS_PRODUCTION
    and DEBUG
):
    raise RuntimeError(
        (
            "DEBUG nie może być włączony "
            "w środowisku produkcyjnym."
        )
    )


ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    (
        ""
        if IS_PRODUCTION
        else "localhost,127.0.0.1"
    ),
)

if (
    IS_PRODUCTION
    and not ALLOWED_HOSTS
):
    raise RuntimeError(
        (
            "ALLOWED_HOSTS musi być "
            "skonfigurowane w produkcji."
        )
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
    (
        "rest_framework_simplejwt."
        "token_blacklist"
    ),
    "corsheaders",
    "auditlog",
    "vehicles",
    "drivers",
    "organizations",
    "notifications",
    "contact",
]


MIDDLEWARE = [
    (
        "django.middleware.security."
        "SecurityMiddleware"
    ),
    (
        "corsheaders.middleware."
        "CorsMiddleware"
    ),
    (
        "django.contrib.sessions.middleware."
        "SessionMiddleware"
    ),
    (
        "django.middleware.common."
        "CommonMiddleware"
    ),
    (
        "django.middleware.csrf."
        "CsrfViewMiddleware"
    ),
    (
        "django.contrib.auth.middleware."
        "AuthenticationMiddleware"
    ),
    "auditlog.middleware.AuditlogMiddleware",
    (
        "django.contrib.messages.middleware."
        "MessageMiddleware"
    ),
    (
        "django.middleware.clickjacking."
        "XFrameOptionsMiddleware"
    ),
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


WSGI_APPLICATION = (
    "config.wsgi.application"
)


POSTGRES_PASSWORD = os.getenv(
    "POSTGRES_PASSWORD",
    "",
)

if (
    IS_PRODUCTION
    and not POSTGRES_PASSWORD
):
    raise RuntimeError(
        (
            "POSTGRES_PASSWORD musi być "
            "ustawione w produkcji."
        )
    )


DATABASES = {
    "default": {
        "ENGINE": (
            "django.db.backends.postgresql"
        ),
        "NAME": os.getenv(
            "POSTGRES_DB",
            "fleet_db",
        ),
        "USER": os.getenv(
            "POSTGRES_USER",
            "fleet_user",
        ),
        "PASSWORD": (
            POSTGRES_PASSWORD
        ),
        "HOST": os.getenv(
            "DB_HOST",
            "localhost",
        ),
        "PORT": os.getenv(
            "DB_PORT",
            "5432",
        ),
        "CONN_MAX_AGE": env_int(
            "DB_CONN_MAX_AGE",
            (
                60
                if IS_PRODUCTION
                else 0
            ),
        ),
        "CONN_HEALTH_CHECKS": (
            IS_PRODUCTION
        ),
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

STATIC_ROOT = (
    BASE_DIR / "staticfiles"
)

MEDIA_URL = "/media/"

MEDIA_ROOT = Path(
    os.getenv(
        "MEDIA_ROOT",
        str(
            BASE_DIR / "media"
        ),
    )
)


DEFAULT_AUTO_FIELD = (
    "django.db.models.BigAutoField"
)


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
    "REVOKE_TOKEN_CLAIM": (
        "hash_password"
    ),
}


CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    (
        ""
        if IS_PRODUCTION
        else "http://localhost:5173"
    ),
)

CORS_ALLOW_CREDENTIALS = False


CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    (
        ""
        if IS_PRODUCTION
        else "http://localhost:5173"
    ),
)


SECURE_CONTENT_TYPE_NOSNIFF = True

SECURE_REFERRER_POLICY = (
    "strict-origin-when-cross-origin"
)

X_FRAME_OPTIONS = "DENY"


SESSION_COOKIE_HTTPONLY = True

SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_SAMESITE = "Lax"


SECURE_SSL_REDIRECT = env_bool(
    "SECURE_SSL_REDIRECT",
    False,
)

SESSION_COOKIE_SECURE = env_bool(
    "SESSION_COOKIE_SECURE",
    False,
)

CSRF_COOKIE_SECURE = env_bool(
    "CSRF_COOKIE_SECURE",
    False,
)


SECURE_HSTS_SECONDS = env_int(
    "SECURE_HSTS_SECONDS",
    0,
)

SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    env_bool(
        "SECURE_HSTS_INCLUDE_SUBDOMAINS",
        False,
    )
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


DATA_UPLOAD_MAX_MEMORY_SIZE = (
    15 * 1024 * 1024
)

FILE_UPLOAD_MAX_MEMORY_SIZE = (
    5 * 1024 * 1024
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

EMAIL_PORT = env_int(
    "EMAIL_PORT",
    587,
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

EMAIL_TIMEOUT = env_int(
    "EMAIL_TIMEOUT",
    10,
)

DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    (
        "Flotivo "
        "<no-reply@flotivo.local>"
    ),
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
                "{levelname} "
                "{asctime} "
                "{name} "
                "{message}"
            ),
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": (
                "logging.StreamHandler"
            ),
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