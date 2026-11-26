FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV HOME=/home/flotivo

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create a non-root identity. Docker Compose smoke opts in via user: 10001:10001.
# Development docker-compose.yml can still use the existing bind-mounted workflow.
RUN set -eux; \
    groupadd --gid 10001 flotivo; \
    useradd --uid 10001 --gid flotivo \
        --create-home --home-dir /home/flotivo \
        --shell /usr/sbin/nologin flotivo; \
    mkdir -p /app/media /app/staticfiles; \
    chown -R flotivo:flotivo /app/media /app/staticfiles

RUN chmod +x /app/entrypoint.prod.sh

EXPOSE 8000

CMD ["/app/entrypoint.prod.sh"]
