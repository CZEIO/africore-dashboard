require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.set('trust proxy', true);
const PORT = 3000;
const DB_DIR = path.join(__dirname, 'database');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'africore-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production' }
}));

// ========== PUSH DATA (Bot schickt Tokens) ==========
const remotePushData = {};

app.post('/api/bot/:botId/push-data', (req, res) => {
    const { botId } = req.params;
    const { allData } = req.body;
    if (allData) {
        remotePushData[botId] = { allData, lastPush: Date.now() };
        const pushDir = path.join(__dirname, 'data', 'push_' + botId);
        fs.mkdirSync(pushDir, { recursive: true });
        try {
            for (const [key, value] of Object.entries(allData)) {
                fs.writeFileSync(path.join(pushDir, key + '.json'), JSON.stringify(value, null, 2));
            }
        } catch {}
    }
    res.json({ ok: true });
});

app.get('/api/bot/:botId/push-data', (req, res) => {
    const { botId } = req.params;
    if (remotePushData[botId]) return res.json(remotePushData[botId]);
    const pushDir = path.join(__dirname, 'data', 'push_' + botId);
    if (fs.existsSync(pushDir)) {
        const data = { allData: {}, lastPush: Date.now() };
        for (const file of fs.readdirSync(pushDir).filter(f => f.endsWith('.json'))) {
            data.allData[file.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(pushDir, file), 'utf8'));
        }
        remotePushData[botId] = data;
        return res.json(data);
    }
    res.json({ exists: false });
});

function getAnimeTokens() {
    const pushed = remotePushData['czeio'];
    if (pushed?.allData?.anime_tokens) return pushed.allData.anime_tokens;
    const f = path.join(DB_DIR, 'anime_tokens.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    return null;
}

// ========== AUTH ==========
function requireAnime(req, res, next) {
    if (req.session?.botId === 'anime') return next();
    const token = req.headers['x-anime-token'] || req.cookies?.anime_token;
    if (token) {
        const tokens = getAnimeTokens();
        if (tokens) {
            const entry = Object.values(tokens).find(t => t.token === token && t.active);
            if (entry) {
                req.session.botId = 'anime';
                req.session.animeUser = entry.username;
                return next();
            }
        }
    }
    return res.status(401).json({ error: 'Nicht eingeloggt' });
}

// ========== LOGIN ==========
app.post('/api/login', (req, res) => {
    const { password, bot } = req.body;
    if (bot !== 'anime') return res.status(400).json({ error: 'Ungültig' });
    const tokens = getAnimeTokens();
    if (!tokens) return res.status(401).json({ error: 'Keine Anime-Zugänge vorhanden' });
    const entry = Object.values(tokens).find(t => t.token === password && t.active);
    if (!entry) return res.status(401).json({ error: 'Ungültiger Key' });
    req.session.botId = 'anime';
    req.session.animeUser = entry.username;
    res.json({ success: true, redirect: '/series-movies.html', username: entry.username });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/session', (req, res) => {
    if (req.session?.botId === 'anime') return res.json({ loggedIn: true, botId: 'anime', username: req.session.animeUser });
    res.json({ loggedIn: false });
});

app.get('/anime-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'anime-login.html')));

// ========== ANIWORLD SCRAPING ==========
app.get('/api/anime/popular', requireAnime, async (req, res) => {
    try {
        const r = await axios.get('https://aniworld.to/beliebte-animes', { timeout: 10000, maxContentLength: 500000 });
        const coverRegex = /<a[^>]+href="(\/anime\/stream\/([a-z0-9-]+))"[^>]*>\s*<img[^>]+data-src="(\/public\/img\/cover\/[^"]+)"/gi;
        const results = []; const seen = new Set(); let m;
        while ((m = coverRegex.exec(r.data)) !== null) {
            const slug = m[2];
            if (!seen.has(slug) && !slug.includes('staffel') && slug.length > 2) {
                seen.add(slug);
                results.push({ title: slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), url: m[1], poster: 'https://aniworld.to' + m[3] });
            }
        }
        res.json({ results: results.slice(0, 50) });
    } catch (e) { res.json({ results: [], error: e.message }); }
});

app.get('/api/anime/new-episoden', requireAnime, async (req, res) => {
    try {
        const r = await axios.get('https://aniworld.to/neue-episoden', { timeout: 10000, maxContentLength: 500000 });
        const epRegex = /\/anime\/stream\/([a-z0-9-]+)\/staffel-(\d+)\/episode-(\d+)/gi;
        const bySlug = {}; let m;
        while ((m = epRegex.exec(r.data)) !== null) {
            const [, slug, season, ep] = m;
            const key = `${slug}-s${season}e${ep}`;
            if (!bySlug[key]) bySlug[key] = { title: slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), slug, season: +season, episode: +ep, url: `/anime/stream/${slug}/staffel-${season}/episode-${ep}` };
        }
        const results = Object.values(bySlug).slice(0, 30);
        await Promise.all(results.map(async (r) => {
            try { const d = await axios.get(`https://aniworld.to/anime/stream/${r.slug}`, { timeout: 8000, maxContentLength: 200000 }); const c = d.data.match(/data-src="(\/public\/img\/cover\/[^"]+)"/); if (c) r.cover = 'https://aniworld.to' + c[1]; } catch {}
        }));
        res.json({ results });
    } catch (e) { res.json({ results: [], error: e.message }); }
});

app.get('/api/anime/letter', requireAnime, async (req, res) => {
    const letter = req.query.letter || 'a';
    try {
        const r = await axios.get(`https://aniworld.to/anime-buchstabe/${letter}`, { timeout: 10000, maxContentLength: 500000 });
        const regex = /<a[^>]+href="(\/anime\/stream\/([a-z0-9-]+))"[^>]*>\s*<img[^>]+data-src="(\/public\/img\/cover\/[^"]+)"/gi;
        const results = []; const seen = new Set(); let m;
        while ((m = regex.exec(r.data)) !== null) {
            if (!seen.has(m[2]) && m[2].length > 2) { seen.add(m[2]); results.push({ title: m[2].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), url: m[1], poster: 'https://aniworld.to' + m[3] }); }
        }
        res.json({ results });
    } catch (e) { res.json({ results: [], error: e.message }); }
});

app.get('/api/anime/search', requireAnime, async (req, res) => {
    const q = req.query.q; if (!q) return res.json({ results: [] });
    try {
        const r = await axios.post('https://aniworld.to/ajax/search', `keyword=${encodeURIComponent(q)}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
        const results = (r.data || []).filter(x => x.link?.startsWith('/anime/stream/') && !x.link.includes('/staffel-')).slice(0, 12).map(x => ({
            title: x.title.replace(/<[^>]*>/g, ''), url: x.link, poster: `https://aniworld.to${x.link}/poster`
        }));
        res.json({ results });
    } catch (e) { res.json({ results: [], error: e.message }); }
});

app.get('/api/anime/seasons', requireAnime, async (req, res) => {
    const url = req.query.url; if (!url) return res.json({ seasons: [] });
    try {
        const full = url.startsWith('http') ? url : `https://aniworld.to${url}`;
        const r = await axios.get(full, { timeout: 15000 });
        const regex = /href="([^"]*staffel-(\d+)[^"]*)"[^>]*>/gi;
        const seasons = []; const seen = new Set(); let m;
        while ((m = regex.exec(r.data)) !== null) {
            const n = +m[2]; if (!seen.has(n)) { seen.add(n); seasons.push({ season: n, title: `Staffel ${n}`, url: m[1] }); }
        }
        res.json({ seasons });
    } catch (e) { res.json({ seasons: [], error: e.message }); }
});

app.get('/api/anime/episodes', requireAnime, async (req, res) => {
    const url = req.query.url; const season = req.query.season;
    if (!url || !season) return res.json({ episodes: [] });
    try {
        const full = url.startsWith('http') ? url : `https://aniworld.to${url}`;
        const r = await axios.get(`${full}/staffel-${season}`, { timeout: 15000 });
        const regex = /href="([^"]*episode-(\d+)[^"]*)"[^>]*>.*?<strong>([^<]+)<\/strong>\s*-\s*<span>([^<]+)<\/span>/gs;
        const episodes = []; const seen = new Set(); let m;
        while ((m = regex.exec(r.data)) !== null) {
            const n = +m[2]; if (!seen.has(n)) { seen.add(n); episodes.push({ number: n, germanTitle: m[3].trim(), englishTitle: m[4].trim(), title: `${m[3].trim()} - ${m[4].trim()}`, url: m[1] }); }
        }
        if (episodes.length === 0) {
            const simple = /href="([^"]*episode-(\d+)[^"]*)"/gi; let m2;
            while ((m2 = simple.exec(r.data)) !== null) { const n = +m2[2]; if (!seen.has(n)) { seen.add(n); episodes.push({ number: n, title: `Episode ${n}`, url: m2[1] }); } }
        }
        res.json({ episodes });
    } catch (e) { res.json({ episodes: [], error: e.message }); }
});

app.get('/api/anime/episode-info', requireAnime, async (req, res) => {
    const url = req.query.url; if (!url) return res.json({ streams: [] });
    try {
        const full = url.startsWith('http') ? url : `https://aniworld.to${url}`;
        const r = await axios.get(full, { timeout: 15000 });
        const html = r.data;
        const streams = [];
        const hosterRegex =/<div[^>]*class="[^"]*hosterSiteVideo[^"]*"[^>]*>.*?<ul[^>]*>(.*?)<\/ul>/gs;
        const hosterMatch = hosterRegex.exec(html);
        if (hosterMatch) {
            const linkRegex =/data-lang-id="(\d+)"[^>]*data-link-target="([^"]+)"/g;
            let hm;
            while ((hm = linkRegex.exec(hosterMatch[1])) !== null) {
                streams.push({ langId: hm[1], url: hm[2] });
            }
        }
        const titleMatch = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
        res.json({ title: titleMatch ? titleMatch[1].trim() : '', streams });
    } catch (e) { res.json({ streams: [], error: e.message }); }
});

app.get('/api/anime/stream', requireAnime, async (req, res) => {
    const url = req.query.url; if (!url) return res.json({ error: 'URL fehlt' });
    try {
        const full = url.startsWith('http') ? url : `https://aniworld.to${url}`;
        const r = await axios.get(full, { timeout: 15000, maxRedirects: 5 });
        res.json({ html: r.data, url: r.request?.res?.responseUrl || full });
    } catch (e) { res.json({ error: e.message }); }
});

// ========== ANILIST API ==========
const ANILIST_URL = 'https://graphql.anilist.co';
const FALLBACK = [
    { id: 1, title: { romaji: 'Attack on Titan', english: 'Attack on Titan' }, coverImage: { large: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg' }, genres: ['Action'], averageScore: 85, episodes: 87, status: 'FINISHED' },
    { id: 2, title: { romaji: 'Jujutsu Kaisen', english: 'Jujutsu Kaisen' }, coverImage: { large: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg' }, genres: ['Action'], averageScore: 86, episodes: 47, status: 'FINISHED' },
    { id: 3, title: { romaji: 'Demon Slayer', english: 'Demon Slayer' }, coverImage: { large: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg' }, genres: ['Action'], averageScore: 83, episodes: 55, status: 'FINISHED' },
];

async function anilistQuery(query, vars = {}) {
    try { const r = await axios.post(ANILIST_URL, { query, variables: vars }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 15000 }); return r.data; } catch { return { data: { Page: { media: FALLBACK } } }; }
}

app.get('/api/anilist/trending', requireAnime, async (req, res) => {
    try {
        const q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(sort:TRENDING_DESC,type:ANIME){id title{romaji english native}coverImage{large medium color}bannerImage genres averageScore popularity episodes status format}}}`;
        const d = await anilistQuery(q, { page: 1, perPage: 20 });
        res.json({ results: d.data?.Page?.media || FALLBACK });
    } catch { res.json({ results: FALLBACK }); }
});

app.get('/api/anilist/popular', requireAnime, async (req, res) => {
    try {
        const q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(sort:POPULARITY_DESC,type:ANIME){id title{romaji english native}coverImage{large medium color}bannerImage genres averageScore episodes status format}}}`;
        const d = await anilistQuery(q, { page: 1, perPage: 20 });
        res.json({ results: d.data?.Page?.media || [] });
    } catch { res.json({ results: [] }); }
});

app.get('/api/anilist/search', requireAnime, async (req, res) => {
    const q = req.query.q; if (!q) return res.json({ results: [] });
    try {
        const query = `query($search:String!,$page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(search:$search,type:ANIME){id title{romaji english native}coverImage{large medium color}bannerImage genres averageScore episodes status format}}}`;
        const d = await anilistQuery(query, { search: q, page: 1, perPage: 20 });
        res.json({ results: d.data?.Page?.media || [] });
    } catch { res.json({ results: [] }); }
});

app.get('/api/anilist/:id', requireAnime, async (req, res) => {
    try {
        const q = `query($id:Int!){Media(id:$id,type:ANIME){id title{romaji english native}coverImage{large medium color}bannerImage description(asHtml:false)genres averageScore episodes status format}}`;
        const d = await anilistQuery(q, { id: parseInt(req.params.id) });
        res.json({ anime: d.data?.Media || null });
    } catch { res.json({ anime: null }); }
});

// ========== SUBSCRIPTIONS ==========
app.get('/api/anime/subscription', requireAnime, (req, res) => {
    const subsFile = path.join(DB_DIR, 'pending_subscriptions.json');
    const tokens = getAnimeTokens();
    if (!tokens) return res.json({ active: false });
    const user = Object.values(tokens).find(t => req.session?.animeUser === t.username);
    if (!user) return res.json({ active: false });
    res.json({ active: true, username: user.username, tier: user.tier, expiresAt: user.expiresAt });
});

app.get('/api/anime/pricing', (req, res) => {
    res.json({
        tiers: [
            { id: 'basic', name: 'Basic', price: 4.99, devices: 1, quality: 'HD' },
            { id: 'standard', name: 'Standard', price: 9.99, devices: 2, quality: 'Full HD' },
            { id: 'premium', name: 'Premium', price: 14.99, devices: 4, quality: '4K' }
        ]
    });
});

// ========== WATCH PROGRESS ==========
const watchProgressFile = path.join(DB_DIR, 'watch_progress.json');
function loadWatchProgress() { try { return JSON.parse(fs.readFileSync(watchProgressFile, 'utf8')); } catch { return {}; } }
function saveWatchProgress(data) { fs.mkdirSync(DB_DIR, { recursive: true }); fs.writeFileSync(watchProgressFile, JSON.stringify(data, null, 2)); }

app.post('/api/watch/progress', requireAnime, (req, res) => {
    const { url, progress, duration } = req.body;
    const user = req.session?.animeUser || 'guest';
    const data = loadWatchProgress();
    if (!data[user]) data[user] = {};
    data[user][url] = { progress: progress || 0, duration: duration || 0, timestamp: Date.now() };
    saveWatchProgress(data);
    res.json({ ok: true });
});

app.get('/api/watch/progress', requireAnime, (req, res) => {
    const user = req.session?.animeUser || 'guest';
    const data = loadWatchProgress();
    res.json(data[user] || {});
});

app.get('/api/watch/continue', requireAnime, (req, res) => {
    const user = req.session?.animeUser || 'guest';
    const data = loadWatchProgress();
    const items = Object.entries(data[user] || {}).map(([url, p]) => ({ url, ...p })).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
    res.json({ items });
});

// ========== STREAM DEVICE MANAGEMENT ==========
const streamSessions = {};
app.get('/api/stream/check', requireAnime, (req, res) => {
    const user = req.session?.animeUser || 'guest';
    const maxDevices = 2;
    const active = Object.values(streamSessions[user] || {}).filter(s => Date.now() - s.lastHeartbeat < 30000);
    res.json({ active: active.length, maxDevices, canStream: active.length < maxDevices });
});
app.post('/api/stream/session', requireAnime, (req, res) => {
    const user = req.session?.animeUser || 'guest';
    const { sessionId } = req.body;
    if (!streamSessions[user]) streamSessions[user] = {};
    streamSessions[user][sessionId] = { lastHeartbeat: Date.now() };
    res.json({ ok: true });
});
app.post('/api/stream/heartbeat', requireAnime, (req, res) => {
    const user = req.session?.animeUser || 'guest';
    const { sessionId } = req.body;
    if (streamSessions[user]?.[sessionId]) streamSessions[user][sessionId].lastHeartbeat = Date.now();
    res.json({ ok: true });
});
app.post('/api/stream/deregister', requireAnime, (req, res) => {
    const user = req.session?.animeUser || 'guest';
    const { sessionId } = req.body;
    if (streamSessions[user]) delete streamSessions[user][sessionId];
    res.json({ ok: true });
});

// ========== STATIC FILES ==========
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

app.get('/', (req, res) => res.redirect('/anime-login'));
app.get('/dashboard', (req, res) => res.redirect('/anime-login'));

app.listen(PORT, () => console.log(`Africore Anime Server läuft auf Port ${PORT}`));
