import pandas as pd, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

src = os.path.join(os.path.dirname(__file__), '..', 'נכסי ארנונה.xlsx')
src = os.path.abspath(src)
out = os.path.join(os.path.dirname(__file__), 'public', 'arnona_lookup.json')

print(f'Reading: {src}')
df = pd.read_excel(src)
print(f'Rows: {len(df)}')

df['כתובת'] = df['כתובת'].astype(str).str.strip()
df['מגורים או לא מגורים'] = df['מגורים או לא מגורים'].astype(str).str.strip()

lookup = {}
for addr, group in df.groupby('כתובת'):
    vals = group['מגורים או לא מגורים'].tolist()
    lookup[addr] = all(v == 'מגורים' for v in vals)

print(f'Unique addresses: {len(lookup)}')
print(f'All-residential: {sum(1 for v in lookup.values() if v)}')

with open(out, 'w', encoding='utf-8') as f:
    json.dump(lookup, f, ensure_ascii=False)

print(f'Saved to: {out}')
print(f'Size: {os.path.getsize(out)/1024/1024:.1f} MB')
