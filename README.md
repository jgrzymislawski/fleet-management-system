# Fleet Management System

System do zarządzania flotą pojazdów — praca dyplomowa.

## Stack technologiczny

- Backend: Django + Django REST Framework
- Frontend: React (Vite)
- Baza danych: PostgreSQL
- Autoryzacja: JWT
- Konteneryzacja: Docker

## Szybkie uruchomienie (zalecane — Docker)

Najprostszy sposób na uruchomienie całego projektu.

### Kroki

1. Sklonuj repozytorium:
```bash
   git clone https://github.com/jgrzymislawski/fleet-management-system.git
   cd fleet-management-system
```

2. Skopiuj plik `.env.example` do `.env` w folderze `backend/`:
```bash
   copy backend\.env.example backend\.env      # Windows
   cp backend/.env.example backend/.env        # Mac/Linux
```

3. Zbuduj i uruchom kontenery:
```bash
   docker compose up --build
```

4. W nowym terminalu wykonaj migracje bazy danych i stwórz konto administratora:
```bash
   docker compose exec backend python manage.py migrate
   docker compose exec backend python manage.py createsuperuser
```
   Podaj dowolną nazwę użytkownika, e-mail (opcjonalnie) i hasło.

5. Aplikacja jest gotowa:
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend / API: [http://localhost:8000/api/](http://localhost:8000/api/)
   - Panel administracyjny: [http://localhost:8000/admin/](http://localhost:8000/admin/)

### Zatrzymanie projektu

```bash
docker compose down
```

Dane w bazie zostają zachowane między uruchomieniami. Aby usunąć również dane bazy danych:
```bash
docker compose down -v
```

---

## Uruchomienie bez Dockera (alternatywa)

Jeśli nie chcesz korzystać z Dockera, projekt można uruchomić ręcznie.

### Wymagania

- [Python 3.13+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/)
- [PostgreSQL 17+](https://www.postgresql.org/download/)
- [Git](https://git-scm.com/downloads)

### Backend

1. Przejdź do folderu backend:
```bash
   cd backend
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

4. Stwórz plik `.env` na podstawie `.env.example`:
```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # Mac/Linux
```

5. Stwórz bazę danych w PostgreSQL (dane logowania muszą się zgadzać z tymi w `.env`):
```sql
   CREATE USER fleet_user WITH PASSWORD 'twoje_haslo';
   CREATE DATABASE fleet_db OWNER fleet_user;
   GRANT ALL PRIVILEGES ON DATABASE fleet_db TO fleet_user;
```

6. Zastosuj migracje i stwórz konto administratora:
```bash
   python manage.py migrate
   python manage.py createsuperuser
```

7. Uruchom serwer:
```bash
   python manage.py runserver
```
   Backend dostępny pod `http://127.0.0.1:8000/`.

### Frontend

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
   Frontend dostępny pod `http://localhost:5173/`.

## Status projektu

🚧 W trakcie rozwoju — praca dyplomowa