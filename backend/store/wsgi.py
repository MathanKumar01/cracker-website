import os
from pathlib import Path
from django.core.wsgi import get_wsgi_application

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "store.settings")
application = get_wsgi_application()

