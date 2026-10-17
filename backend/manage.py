#!/usr/bin/env python
import os, sys
from pathlib import Path

if __name__ == "__main__":
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parent / ".env")
    except ImportError:
        pass
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "store.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

