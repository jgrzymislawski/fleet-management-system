#!/bin/sh
set -e

echo "Sprawdzanie bazy danych..."
python manage.py check

echo "Wykonywanie migracji..."
python manage.py migrate --noinput

echo "Zbieranie plików statycznych..."
python manage.py collectstatic --noinput

echo "Uruchamianie Gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --threads "${GUNICORN_THREADS:-2}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --error-logfile -