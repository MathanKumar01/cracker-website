import os
from pathlib import Path
from corsheaders.defaults import default_headers
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# Automatically load environment variables from .env file in the backend directory
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-this-secret-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").strip().lower() in ("true", "1", "yes")

# Allowed hosts parsing with whitespace stripping
raw_hosts = os.environ.get(
    "ALLOWED_HOSTS",
    "127.0.0.1,localhost"
)

ALLOWED_HOSTS = [
    h.strip() for h in raw_hosts.split(",") if h.strip()
]

if "testserver" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("testserver")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "orders",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "store.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "store.wsgi.application"

# Database Configuration:
# Uses DATABASE_URL if set (e.g. for PostgreSQL in production), otherwise defaults to local SQLite file
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS Configuration
raw_cors = os.environ.get("CORS_ALLOWED_ORIGINS", "")
parsed_cors = [x.strip() for x in raw_cors.split(",") if x.strip()]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(
    parsed_cors + ["http://localhost:3000", "http://127.0.0.1:3000"]
))

# Ensure custom headers like X-Admin-Key are allowed through CORS
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-admin-key",
]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "200/hour"},
}

# Admin API Key from environment
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "sakthi-admin-change-this-12345")

# Security Hardening Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    if os.environ.get("SECURE_SSL_REDIRECT", "false").lower() in ("true", "1", "yes"):
        SECURE_SSL_REDIRECT = True
    if os.environ.get("SESSION_COOKIE_SECURE", "false").lower() in ("true", "1", "yes"):
        SESSION_COOKIE_SECURE = True
    if os.environ.get("CSRF_COOKIE_SECURE", "false").lower() in ("true", "1", "yes"):
        CSRF_COOKIE_SECURE = True

