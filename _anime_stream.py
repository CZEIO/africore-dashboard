
import sys, json, re
sys.path.insert(0, r'C:\\Users\\dupre\\Documents\\AniWorld-Downloader')
import aniworld
import json, re

# Strip /staffel-X/episode-Y from URL to get series URL
full_url = 'https://aniworld.to/anime/stream/one-piece/staffel-1/episode-34'
series_url = re.sub(r'/staffel-\d+.*$', '', full_url)
s = aniworld.AniworldSeries(series_url)
# Find matching season and episode from URL
url_parts = 'https://aniworld.to/anime/stream/one-piece/staffel-1/episode-34'.split('/')
season_num = None
episode_num = None
for i, p in enumerate(url_parts):
    if p.startswith('staffel-'):
        season_num = int(p.replace('staffel-', ''))
    if p.startswith('episode-'):
        episode_num = int(p.replace('episode-', ''))

if season_num is None or episode_num is None:
    print(json.dumps({'error': 'Invalid URL', 'languages': []}))
    sys.exit(0)

target_season = None
for season in s.seasons:
    if season.season_number == season_num:
        target_season = season
        break

if not target_season:
    print(json.dumps({'error': 'Season not found', 'languages': []}))
    sys.exit(0)

target_ep = None
for ep in target_season.episodes:
    if ep.episode_number == episode_num:
        target_ep = ep
        break

if not target_ep:
    print(json.dumps({'error': 'Episode not found', 'languages': []}))
    sys.exit(0)

# Parse provider_data to extract languages and hosts
provider_data = str(target_ep.provider_data)
result = {'languages': [], 'title_de': target_ep.title_de, 'title_en': target_ep.title_en}

# Split by language sections
current_lang = None
current_hosts = []

for line in provider_data.split('\n'):
    line = line.strip()
    if not line:
        continue
    # Language header lines (e.g. "German audio", "Japanese audio + English subtitles")
    if not line.startswith('-') and not line.startswith('->') and not line.startswith('  '):
        if current_lang and current_hosts:
            result['languages'].append({'name': current_lang, 'hosts': current_hosts})
        current_lang = line
        current_hosts = []
    # Host lines (e.g. "- VOE      -> https://...")
    elif '->' in line:
        m = re.match(r'-\s+(\w[\w\s]*?)\s+->\s+(https?://.+)', line)
        if m:
            host_name = m.group(1).strip()
            redirect_url = m.group(2).strip()
            current_hosts.append({'name': host_name, 'redirectUrl': redirect_url})

if current_lang and current_hosts:
    result['languages'].append({'name': current_lang, 'hosts': current_hosts})

print(json.dumps(result))
