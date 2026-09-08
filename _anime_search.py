
import sys, json
sys.path.insert(0, 'C:\\Users\\dupre\\Documents\\AniWorld-Downloader')
from aniworld.models.core import anworld
results = anworld.search('naruto')
output = []
for r in results[:12]:
    output.append({'title': r.get('title', ''), 'url': r.get('url', ''), 'poster': r.get('poster', '')})
print(json.dumps(output))
