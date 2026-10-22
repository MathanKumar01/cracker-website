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

# Allowed hosts parsing with whitespace stripping (supports both ALLOWED_HOSTS and DJANGO_ALLOWED_HOSTS)
raw_hosts = (
    os.environ.get("ALLOWED_HOSTS")
    or os.environ.get("DJANGO_ALLOWED_HOSTS")
    or "127.0.0.1,localhost,testserver"
)

ALLOWED_HOSTS = [
    h.strip() for h in raw_hosts.split(",") if h.strip()
]

# Ensure common deployment hosts and testserver are allowed if not wildcarded
if "*" not in ALLOWED_HOSTS:
    for default_domain in [".onrender.com", ".railway.app", ".vercel.app", "testserver"]:
        if default_domain not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(default_domain)

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
# Toggle to allow all origins if explicitly set via env (useful for open public store APIs)
CORS_ALLOW_ALL_ORIGINS = os.environ.get("CORS_ALLOW_ALL_ORIGINS", "false").strip().lower() in ("true", "1", "yes")

raw_cors = os.environ.get("CORS_ALLOWED_ORIGINS", "")
# Filter out origins containing wildcards ('*') from CORS_ALLOWED_ORIGINS since django-cors-headers requires exact origins
parsed_cors = [
    x.strip() for x in raw_cors.split(",")
    if x.strip() and "*" not in x
]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(
    parsed_cors + ["http://localhost:3000", "http://127.0.0.1:3000"]
))

# Automatically allow preview and production deployments across modern hosting platforms
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https:\/\/.*\.vercel\.app$",
    r"^https:\/\/.*\.netlify\.app$",
    r"^https:\/\/.*\.onrender\.com$",
    r"^https:\/\/.*\.pages\.dev$",
]

CORS_ALLOW_CREDENTIALS = True

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

# ==========================================
# GMAIL SMTP & ORDER EMAIL NOTIFICATIONS
# ==========================================
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() in ("true", "1", "yes")
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "").strip()
# Automatically sanitize 16-char Google App Passwords (stripping any copied spaces)
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "").replace(" ", "").strip()
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "sales@thaswika.store")
ADMIN_NOTIFICATION_EMAIL = os.environ.get("ADMIN_NOTIFICATION_EMAIL", EMAIL_HOST_USER).strip()

