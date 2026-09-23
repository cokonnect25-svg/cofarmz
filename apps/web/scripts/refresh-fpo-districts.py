"""Download a dated district catalogue from NIC's official directory. No DB writes."""
import datetime
import html
import json
import re
import time
import urllib.request
from pathlib import Path

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'X-Requested-With':'XMLHttpRequest','User-Agent':'Mozilla/5.0'}), timeout=45) as r:
        return r.read().decode('utf-8')

def clean(value):
    return html.unescape(re.sub('<[^>]+>', '', value)).strip()

states_html = get('https://igod.gov.in/sg/states')
states = re.findall(r'<a[^>]+href="https://igod.gov.in/sg/([A-Z]+)/categories"[^>]*>(.*?)</a>', states_html, re.S)
states = sorted(set((code, clean(name)) for code, name in states))
if len(states) < 28:
    raise RuntimeError('Incomplete state directory; refusing to replace catalogue')
rows = []
for code, name in states:
    source = f'https://igod.gov.in/sg/{code}/E042/organizations'
    page = get(source)
    count = int(re.search(r'(\d+) Results', page).group(1))
    pattern = r'<(?:a|div)[^>]+class="search-title"[^>]*>(.*?)</(?:a|div)>'
    names = re.findall(pattern, page, re.S)[:min(25,count)]
    for offset in range(25,count,5):
        more = get(source + f'_more/{offset}/{min(5,count-offset)}')
        names += re.findall(pattern, more, re.S)
    districts = sorted(set(clean(x) for x in names))
    if len(districts) != count:
        raise RuntimeError(f'{name}: expected {count}, got {len(districts)}')
    rows.extend(dict(state=name,district=d,source=source) for d in districts)
    print(name, len(districts), flush=True)
    time.sleep(0.3)
target = Path('data/fpo-districts.json')
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps({'retrieved_at':str(datetime.date.today()),'districts':rows},indent=2,ensure_ascii=False),encoding='utf-8')
print('Saved',len(rows),'districts')
