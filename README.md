# Fleet Management System

System do zarządzania flotą pojazdów — praca dyplomowa.

## Stack technologiczny

- Backend: Django + Django REST Framework
- Frontend: React (Vite)
- Baza danych: PostgreSQL
- Autoryzacja: JWT

## Wymagania wstępne

Przed uruchomieniem projektu upewnij się, że masz zainstalowane:

- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/)
- [PostgreSQL 16+](https://www.postgresql.org/download/)
- [Git](https://git-scm.com/downloads)

## Instalacja — Backend

1. Sklonuj repozytorium i przejdź do folderu backend:
```bash
   git clone https://github.com/jgrzymislawski/fleet-management-system.git
   cd fleet-management-system/backend
```

2. Stwórz i aktywuj środowisko wirtualne:
```bash
   python -m venv venv
   venv\Scripts\activate      # Windows
   source venv/bin/activate   # Mac/Linux
```

3. Zainstaluj zależności:
```bash
   pip install -r requirements.txt
```

4. Stwórz plik `.env` w folderze `backend/` na podstawie `.env.example`:
```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # Mac/Linux
```
   Uzupełnij plik `.env` własnymi wartościami (hasło do bazy, sekretny klucz).

5. Stwórz bazę danych w PostgreSQL:
```sql
   CREATE USER fleet_user WITH PASSWORD 'twoje_haslo';
   CREATE DATABASE fleet_db OWNER fleet_user;
   GRANT ALL PRIVILEGES ON DATABASE fleet_db TO fleet_user;
```

6. Zastosuj migracje:
```bash
   python manage.py migrate
```

7. Stwórz konto administratora:
```bash
   python manage.py createsuperuser
```

8. Uruchom serwer:
```bash
   python manage.py runserver
```
   Backend będzie dostępny pod `http://127.0.0.1:8000/`, panel admina pod `http://127.0.0.1:8000/admin/`.

## Instalacja — Frontend

1. Przejdź do folderu frontend:
```bash
   cd ../frontend
```

2. Zainstaluj zależności:
```bash
   npm install
```

3. Uruchom serwer deweloperski:
```bash
   npm run dev
```
   Frontend będzie dostępny pod `http://localhost:5173/`.

## Status projektu

🚧 W trakcie rozwoju — praca dyplomowa