# Flotivo

Flotivo is a web-based fleet management system developed as an engineering thesis project.

The application is designed to help manage vehicles, drivers, service history, important deadlines and fleet-related costs in a simple and organized way.

## Tech Stack

### Backend

- Python
- Django
- Django REST Framework
- PostgreSQL
- JWT Authentication

### Frontend

- React
- Vite
- JavaScript
- CSS

## Getting Started

The recommended way to run the project is with Docker.

### Requirements

Make sure you have installed:

- Docker
- Git

### 1. Clone the repository

```bash
git clone https://github.com/jgrzymislawski/fleet-management-system.git
cd fleet-management-system
```

### 2. Configure environment variables

Create the backend environment file from the provided example.

#### Windows

```bash
copy backend\.env.example backend\.env
```

#### Linux / macOS

```bash
cp backend/.env.example backend/.env
```

The environment file should contain:

```env
SECRET_KEY=change_this
DEBUG=True

POSTGRES_DB=fleet_db
POSTGRES_USER=fleet_user
POSTGRES_PASSWORD=change_this

DB_HOST=localhost
DB_PORT=5432
```

Change at least:

```env
SECRET_KEY=change_this
POSTGRES_PASSWORD=change_this
```

When using Docker Compose, the backend automatically connects to the PostgreSQL container using:

```text
DB_HOST=db
```

Do not commit your real `.env` file to the repository.

### 3. Build and start the application

```bash
docker compose up --build
```

### 4. Run database migrations

Open another terminal and run:

```bash
docker compose exec backend python manage.py migrate
```

### 5. Create an administrator account

```bash
docker compose exec backend python manage.py createsuperuser
```

### 6. Open the application

Frontend:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:8000/api/
```

Django Admin:

```text
http://localhost:8000/admin/
```

## Stopping the Application

```bash
docker compose down
```

To also remove the local database volume:

```bash
docker compose down -v
```