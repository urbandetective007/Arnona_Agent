import os
import json
import urllib.parse
import time
import requests
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://mcsygsqfyuaexxxwsgem.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jc3lnc3FmeXVhZXh4eHdzZ2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Njk1MTIsImV4cCI6MjA5NDE0NTUxMn0.Hu6t2PLjE_D113NMQEGvEv8QGhqN6udKNO9McqK3ST8"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

PUBLIC_DIR = r"C:\Users\LENOVO\Desktop\שגרה ניסיונית\my-app\public"
CACHE_FILE = os.path.join(PUBLIC_DIR, "geocoded_addresses.json")

PREFIXES = ['רחוב ', 'רח\' ', 'שדרות ', 'שד\' ', 'שד ', 'סמטת ', 'כיכר ', 'גן ', 'מעלה ', 'מורד ']

def normalize_address(address: str) -> str:
    if not address:
        return ""
    normalized = address.strip()
    
    # Split by comma and take first part (address street and number)
    if ',' in normalized:
        normalized = normalized.split(',')[0].strip()
        
    for prefix in PREFIXES:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
            break
            
    # Remove apartment details (e.g., "יפו 97 דירה 3" -> "יפו 97")
    normalized = re.sub(r'\s+(דירה|דיר|דר|יח\'|יחידה|קומה)\s+\d+.*', '', normalized, flags=re.IGNORECASE)
    # Remove double spaces
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized.strip()

def main():
    print("Fetching businesses from Supabase...")
    r = requests.get(f"{SUPABASE_URL}/rest/v1/businesses?select=address", headers=HEADERS)
    r.raise_for_status()
    businesses = r.json()
    
    # Extract unique normalized addresses
    addresses_to_geocode = set()
    for b in businesses:
        addr = b.get("address")
        if addr:
            norm = normalize_address(addr)
            if norm:
                addresses_to_geocode.add(norm)
                
    print(f"Total unique normalized addresses found: {len(addresses_to_geocode)}")
    
    # Load existing cache if exists
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cache = json.load(f)
            print(f"Loaded {len(cache)} cached coordinates from {CACHE_FILE}")
        except Exception as e:
            print("Error loading cache file:", e)
            cache = {}
            
    # Geocode missing addresses
    new_geocoded = 0
    errors_count = 0
    
    # Nominatim URL and Headers
    nominatim_url = "https://nominatim.openstreetmap.org/search"
    geo_headers = {
        "User-Agent": "ArnonaAgentProject/1.0 (contact: info@arnona-agent.gov.il)",
        "Accept-Language": "he,en;q=0.9"
    }
    
    for i, addr in enumerate(addresses_to_geocode, 1):
        if addr in cache:
            continue
            
        print(f"[{i}/{len(addresses_to_geocode)}] Geocoding: {addr}...")
        
        # Add "ירושלים" to specify the city if not present
        query = addr
        if "ירושלים" not in query:
            query = f"{addr}, ירושלים"
            
        params = {
            "q": query,
            "format": "json",
            "limit": 1
        }
        
        try:
            res = requests.get(nominatim_url, headers=geo_headers, params=params, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data:
                    lat = float(data[0]["lat"])
                    lon = float(data[0]["lon"])
                    cache[addr] = {"lat": lat, "lon": lon}
                    new_geocoded += 1
                    print(f"  Success: {lat}, {lon}")
                else:
                    print(f"  No coordinates found for query: {query}")
                    # Try a simpler query (remove number if it has letter suffixes, or try just the street if possible)
                    # For now, let's keep it simple or try without suffixes
                    cache[addr] = None  # Mark as None so we don't query it again
            else:
                print(f"  API returned status code: {res.status_code}")
                errors_count += 1
        except Exception as e:
            print(f"  Error geocoding {addr}: {e}")
            errors_count += 1
            
        # Respect rate limits (1.1 second delay)
        time.sleep(1.1)
        
        # Periodically save cache to file
        if new_geocoded > 0 and new_geocoded % 5 == 0:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
                
    # Final save
    if new_geocoded > 0:
        os.makedirs(PUBLIC_DIR, exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
            
    print(f"\nFinished preprocessing!")
    print(f"New addresses geocoded: {new_geocoded}")
    print(f"Failed or skipped errors: {errors_count}")
    print(f"Total addresses in cache: {len(cache)}")

if __name__ == "__main__":
    main()
