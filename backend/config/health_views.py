
import logging

from uuid import uuid4

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


logger = logging.getLogger(__name__)


def _check_database():
    """Sprawdza rzeczywiste zapytanie do PostgreSQL."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        result = cursor.fetchone()

    if result != (1,):
        raise RuntimeError("Database check failed")


def _check_redis():
    """Sprawdza zapis i odczyt przez Django cache."""
    key = f"flotivo:readiness:{uuid4().hex}"

    cache.set(
        key,
        "ok",
        timeout=15,
    )

    if cache.get(key) != "ok":
        raise RuntimeError("Cache check failed")

    cache.delete(key)


@require_GET
@never_cache
def health_live(request):
    """Sprawdza, czy aplikacja HTTP odpowiada."""
    return JsonResponse({
        "status": "ok",
    })


@require_GET
@never_cache
def health_ready(request):
    """Sprawdza gotowosc PostgreSQL i Redis."""
    try:
        _check_database()
        _check_redis()

    except Exception as exc:
        logger.warning(
            "Readiness check failed (%s)",
            type(exc).__name__,
        )

        return JsonResponse(
            {"status": "unavailable"},
            status=503,
        )

    return JsonResponse({
        "status": "ok",
    })
