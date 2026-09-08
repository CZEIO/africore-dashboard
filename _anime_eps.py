
import sys, json
import aniworld
s = aniworld.AniworldSeries('https://aniworld.to/anime/stream/attack-on-titan/staffel-1/episode-1')
for season in s.seasons:
    if season.number == 1:
        eps = []
        for ep in season.episodes:
            eps.append({'title': ep.title, 'url': ep.url, 'number': ep.number})
        print(json.dumps(eps))
        break
