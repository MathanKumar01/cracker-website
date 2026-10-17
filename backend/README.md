# Django backend

## Windows PowerShell
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```
For the simplest local setup, set the environment variables in PowerShell:
```powershell
$env:CORS_ALLOWED_ORIGINS="http://localhost:3000"
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```
API runs at `http://127.0.0.1:8000/api`. Health check: `http://127.0.0.1:8000/health/`.

Run `createsuperuser` once and enter the owner username (`Kathiravan`) and password interactively. Django stores only a password hash. The `/admin` dashboard requires a staff account.

Customers create accounts at `/account` and must sign in before submitting an order. The storefront submits orders to `POST /api/orders/` with a token. The dashboard reads `GET /api/admin/orders/`, updates status with `PATCH /api/admin/orders/<id>/`, and deletes an order with `DELETE /api/admin/orders/<id>/`.

Authentication endpoints are `POST /api/auth/register/`, `POST /api/auth/login/`, and `GET /api/auth/me/`.
