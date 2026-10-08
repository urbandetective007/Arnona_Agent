"""The installation's city settings (city.config.json at the repo root),
for the Python scripts — the same file the website reads."""
import json
import os

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "city.config.json")
with open(_PATH, encoding="utf-8") as _f:
    CITY_CONFIG = json.load(_f)

CITY_NAME = CITY_CONFIG["city"]["nameHe"]
MUNICIPALITY = CITY_CONFIG["org"]["municipalityHe"]
SUPABASE_URL = CITY_CONFIG["supabase"]["url"]
SUPABASE_ANON_KEY = CITY_CONFIG["supabase"]["anonKey"]
