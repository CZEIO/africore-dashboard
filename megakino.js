const axios = require('axios');

const IMG_CDN = 'https://megakino.me';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5'
};

let BASE_URL = 'https://megakino.fyi';

async function resolveDomain() {
    try {
        const r = await axios.get('https://raw.githubusercontent.com/Yezun-hikari/new-domain-check/refs/heads/main/monitors/megakino/domain.txt', { timeout: 8000 });
        if (r.data && r.data.trim()) BASE_URL = `https://${r.data.trim()}`;
    } catch {}
}

function decodeHtmlEntities(text) {
    return text
        .replace(/&uuml;/g, 'ü').replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä')
        .replace(/&Uuml;/g, 'Ü').replace(/&Ouml;/g, 'Ö').replace(/&Auml;/g, 'Ä')
        .replace(/&szlig;/g, 'ß').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
        .replace(/&bdquo;/g, '„').replace(/&ldquo;/g, '"').replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ');
}

function extractText(html, regex) {
    const m = html.match(regex);
    return m ? m[1].trim() : '';
}

// === Voe Direct Link Extraction ===
function shiftLetters(input) {
    return input.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCharCode((code - 65 + 13) % 26 + 65);
        if (code >= 97 && code <= 122) return String.fromCharCode((code - 97 + 13) % 26 + 97);
        return c;
    }).join('');
}

function replaceJunk(input) {
    const junkParts = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
    let result = input;
    for (const part of junkParts) {
        result = result.split(part).join('_');
    }
    return result.replace(/_/g, '');
}

function shiftBack(s, n) {
    return s.split('').map(c => String.fromCharCode(c.charCodeAt(0) - n)).join('');
}

function decodeVoeString(encoded) {
    try {
        const step1 = shiftLetters(encoded);
        const step2 = replaceJunk(step1);
        const step3 = Buffer.from(step2, 'base64').toString('utf8');
        const step4 = shiftBack(step3, 3);
        const step5 = Buffer.from(step4.split('').reverse().join(''), 'base64').toString('utf8');
        return JSON.parse(step5);
    } catch { return null; }
}

async function resolveVoeLink(voeUrl) {
    try {
        const resp = await axios.get(voeUrl, {
            headers: { ...HEADERS, Referer: 'https://megakino.fyi/' },
            timeout: 15000,
            maxRedirects: 5,
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
        let html = resp.data;

        // Follow redirect to actual Voe player domain
        const redirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (redirectMatch) {
            const resp2 = await axios.get(redirectMatch[1], {
                headers: { ...HEADERS, Referer: 'https://voe.sx/' },
                timeout: 15000,
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
            });
            html = resp2.data;
        }

        // Method 1: JSON script decode (Python port)
        const jsonScriptMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
        if (jsonScriptMatch) {
            try {
                // Python: script.text[2:-2] — remove first 2 and last 2 chars (array brackets + quotes)
                const raw = jsonScriptMatch[1].trim();
                const cleaned = raw.slice(2, -2);
                const decoded = decodeVoeString(cleaned);
                if (decoded && decoded.source) return decoded.source;
            } catch {}
        }

        // Method 2: var a168c='...' (Python: base64 decode, reverse, JSON parse)
        const b64match = html.match(/var a168c='([^']+)'/);
        if (b64match) {
            const decoded = Buffer.from(b64match[1], 'base64').toString('utf8').split('').reverse().join('');
            const obj = JSON.parse(decoded);
            if (obj.source) return obj.source;
        }

        // Method 3: HLS direct
        const hlsMatch = html.match(/'hls':\s*'([^']+)'/);
        if (hlsMatch) return Buffer.from(hlsMatch[1], 'base64').toString('utf8');

    } catch (e) {
        console.log('[Voe] Error resolving:', voeUrl, e.message);
    }
    return null;
}

// === MegaKino Parsing ===
function parseListItem(block) {
    const href = extractText(block, /href="([^"]+)"/);
    // data-src for lazy loading, fallback to src
    const dataSrcMatch = block.match(/data-src="([^"]+)"/);
    const imgMatch = dataSrcMatch ? dataSrcMatch : block.match(/<img[^>]+src="([^"]+)"/);
    const cover = imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : IMG_CDN + imgMatch[1]) : '';
    const title = extractText(block, /poster__title[^>]*>([^<]+)/);
    const label = extractText(block, /poster__label">([^<]+)/);
    const subtitleLis = block.match(/<li>([^<]+)<\/li>/g) || [];
    const subtitles = subtitleLis.map(li => li.replace(/<\/?li>/g, '').trim());
    
    const isSeries = href.includes('/serials/');
    const isMovie = href.includes('/films/');
    
    const info = subtitles.join(' | ');
    const genreMatch = info.match(/\/\s*([^/]+(?:\/[^/]+)*)/);
    const genres = genreMatch ? genreMatch[1].split('/').map(g => g.trim()).filter(Boolean) : [];

    return {
        title: decodeHtmlEntities(title),
        url: href,
        cover,
        year: subtitles.find(s => /\d{4}/.test(s))?.match(/\d{4}/)?.[0] || '',
        info,
        genres,
        quality: label,
        type: isSeries ? 'series' : isMovie ? 'movie' : 'unknown'
    };
}

function parseDetailPage(html) {
    const data = {};
    
    data.title = decodeHtmlEntities(extractText(html, /<h1[^>]*itemprop="name"[^>]*>([^<]+)/) || extractText(html, /<h1[^>]*>([^<]+)/));
    data.originalTitle = decodeHtmlEntities(extractText(html, /itemprop="alternativeHeadline"[^>]*>([^<]+)/));
    data.description = decodeHtmlEntities(extractText(html, /itemprop="description"[^>]*>([\s\S]*?)<\/div>/));
    if (!data.description) data.description = decodeHtmlEntities(extractText(html, /class="pmovie__text[^"]*"[^>]*>([\s\S]*?)<\/div>/));
    
    const imgMeta = html.match(/itemprop="image"[^>]*content="([^"]+)"/);
    data.cover = imgMeta ? (imgMeta[1].startsWith('http') ? imgMeta[1] : IMG_CDN + imgMeta[1]) : '';
    
    const yearMatch = html.match(/release_date\/(\d{4})\//);
    data.year = yearMatch ? yearMatch[1] : '';
    
    const countryMatch = html.match(/itemprop="countryOfOrigin"[^>]*>([^<]+)/);
    data.country = countryMatch ? countryMatch[1].trim() : '';
    
    const genresMatch = html.match(/itemprop="genre"[^>]*>([^<]+)/);
    data.genre = genresMatch ? genresMatch[1].trim() : '';
    
    const kpMatch = html.match(/pmovie__subrating--kp">([^<]+)/);
    data.ratingKP = kpMatch ? parseFloat(kpMatch[1]) : null;
    
    const durationMatch = html.match(/(\d+)\s*min/);
    data.duration = durationMatch ? durationMatch[1] + ' min' : '';
    
    const directorMatch = html.match(/itemprop="directors"[\s\S]*?<a[^>]*>([^<]+)/);
    data.director = directorMatch ? directorMatch[1].trim() : '';
    
    const actorsMatch = html.match(/itemprop="actors"[\s\S]*?<\/span>/);
    if (actorsMatch) {
        const actorLinks = actorsMatch[0].match(/<a[^>]*>([^<]+)<\/a>/g) || [];
        data.actors = actorLinks.map(a => decodeHtmlEntities(a.replace(/<[^>]*>/g, '').trim())).filter(Boolean).join(', ');
    } else data.actors = '';
    
    const ageMatch = html.match(/pmovie__age"><div>([^<]+)/);
    data.ageRating = ageMatch ? ageMatch[1].trim() : '';
    
    const langMatch = html.match(/itemprop="inLanguage"[^>]*content="([^"]+)"/);
    data.language = langMatch ? langMatch[1] : '';
    
    data.streams = extractStreams(html);
    data.type = data.streams.episodes.length > 0 ? 'series' : 'movie';
    
    return data;
}

function extractStreams(html) {
    const result = { episodes: [], movieStream: null };
    
    const episodeSelectMatch = html.match(/<select[^>]*class="[^"]*se-select[^"]*"[^>]*>([\s\S]*?)<\/select>/);
    if (episodeSelectMatch) {
        const episodeOptions = episodeSelectMatch[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g) || [];
        for (const opt of episodeOptions) {
            const val = opt.match(/value="([^"]+)"/)?.[1];
            const label = opt.match(/>([^<]*)<\/option>/)?.[1];
            if (val && val.startsWith('ep')) {
                const epNum = parseInt(val.replace('ep', ''));
                const sourceSelectMatch = html.match(new RegExp(`<select[^>]*class="[^"]*mr-select[^"]*"[^>]*id="${val}"[^>]*>([\\s\\S]*?)<\\/select>`));
                const sources = [];
                if (sourceSelectMatch) {
                    const sourceOptions = sourceSelectMatch[1].match(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g) || [];
                    for (const srcOpt of sourceOptions) {
                        const srcUrl = srcOpt.match(/value="([^"]+)"/)?.[1];
                        const srcName = srcOpt.match(/>([^<]*)<\/option>/)?.[1];
                        if (srcUrl) sources.push({ name: srcName?.trim() || 'Unknown', url: srcUrl });
                    }
                }
                result.episodes.push({ number: epNum, title: decodeHtmlEntities(label || `Episode ${epNum}`), sources });
            }
        }
    }
    
    const voeLinks = html.match(/https?:\/\/voe\.sx\/e\/[^"'\s<]+/g) || [];
    if (voeLinks.length > 0) {
        result.movieStream = { sources: voeLinks.map(url => ({ name: 'Voe', url })) };
    }
    
    if (!result.movieStream) {
        const dlMatch = html.match(/href="\/dl\/(\d+)"/);
        if (dlMatch) result.movieStream = { dlId: dlMatch[1], url: `${BASE_URL}/dl/${dlMatch[1]}`, sources: [] };
    }
    
    return result;
}

function extractItems(html) {
    const itemRegex = /<a\s+class="poster grid-item[^"]*"[\s\S]*?<\/a>/gi;
    const items = [];
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
        const item = parseListItem(match[0]);
        if (item.title) items.push(item);
    }
    return items;
}

// === Session-based search ===
let sessionData = null;
let sessionLastTry = 0;

async function initSession() {
    const now = Date.now();
    if (sessionData && sessionData.cookies && (now - sessionLastTry) < 300000) return sessionData;
    sessionLastTry = now;
    sessionData = { cookies: '' };
    
    try {
        const r = await axios.get(`${BASE_URL}/index.php?yg=token`, {
            headers: HEADERS,
            timeout: 10000,
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
        const setCookies = r.headers['set-cookie'] || [];
        sessionData.cookies = setCookies.map(c => c.split(';')[0]).join('; ');
    } catch (e) {
        // Retry next time
    }
    
    return sessionData;
}

async function fetchPage(url) {
    const session = await initSession();
    const response = await axios.get(url, {
        headers: { ...HEADERS, Referer: BASE_URL + '/', Cookie: session.cookies },
        timeout: 12000,
        maxContentLength: 1000000,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    // Merge cookies from response (don't lose yg_token)
    const setCookies = response.headers['set-cookie'] || [];
    if (setCookies.length) {
        const existing = {};
        session.cookies.split(';').forEach(c => {
            const [k, ...v] = c.trim().split('=');
            if (k) existing[k] = v.join('=');
        });
        setCookies.forEach(c => {
            const [kv] = c.split(';');
            const [k, ...v] = kv.trim().split('=');
            if (k) existing[k] = v.join('=');
        });
        session.cookies = Object.entries(existing).map(([k,v]) => `${k}=${v}`).join('; ');
    }
    return response.data;
}

async function getPopular(page = 1) {
    await resolveDomain();
    const url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    const html = await fetchPage(url);
    return extractItems(html);
}

async function getSeries(page = 1) {
    await resolveDomain();
    const url = page === 1 ? `${BASE_URL}/serials/` : `${BASE_URL}/serials/page/${page}/`;
    const html = await fetchPage(url);
    return extractItems(html);
}

// Serien gruppieren — eine Karte pro Serie (alle Staffeln zusammen)
async function getGroupedSeries(maxPages = 10) {
    await resolveDomain();
    let allItems = [];
    for (let p = 1; p <= maxPages; p++) {
        const url = p === 1 ? `${BASE_URL}/serials/` : `${BASE_URL}/serials/page/${p}/`;
        const html = await fetchPage(url);
        const items = extractItems(html);
        if (items.length === 0) break;
        allItems = allItems.concat(items);
    }

    // Gruppiere nach Basis-Name (entferne "Staffel X" / "X Staffel" etc.)
    const groups = {};
    for (const item of allItems) {
        const baseName = item.title
            .replace(/\s*[-–]\s*\d+\s*Staffel.*$/i, '')
            .replace(/\s*[-–]\s*Staffel\s*\d+.*$/i, '')
            .replace(/\s+Staffel\s+\d+.*/i, '')
            .replace(/\s*[-–]\s*Staffel.*$/i, '')
            .replace(/\s+Staffel$/i, '')
            .trim();
        if (!groups[baseName]) {
            groups[baseName] = {
                title: baseName,
                cover: item.cover,
                year: item.year,
                info: item.info,
                quality: item.quality,
                type: item.type,
                seasons: []
            };
        }
        groups[baseName].seasons.push(item);
    }

    // Sortiere Staffeln innerhalb jeder Gruppe
    for (const key of Object.keys(groups)) {
        groups[key].seasons.sort((a, b) => {
            const numA = parseInt(a.title.match(/(\d+)/)?.[1] || '0');
            const numB = parseInt(b.title.match(/(\d+)/)?.[1] || '0');
            return numA - numB;
        });
        // Beste Cover nehmen (die mit http)
        const bestCover = groups[key].seasons.find(s => s.cover && s.cover.startsWith('http'));
        if (bestCover) groups[key].cover = bestCover.cover;
    }

    return Object.values(groups);
}

async function getMovies(page = 1) {
    await resolveDomain();
    const url = page === 1 ? `${BASE_URL}/films/` : `${BASE_URL}/films/page/${page}/`;
    const html = await fetchPage(url);
    return extractItems(html);
}

async function getDetail(pageUrl) {
    await resolveDomain();
    const fullUrl = pageUrl.startsWith('http') ? pageUrl : `${BASE_URL}${pageUrl}`;
    const html = await fetchPage(fullUrl);
    return parseDetailPage(html);
}

async function search(query) {
    await resolveDomain();
    let session = await initSession();
    let response = await axios.get(
        `${BASE_URL}/index.php?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`,
        {
            headers: { ...HEADERS, Referer: BASE_URL + '/', Cookie: session.cookies },
            timeout: 15000,
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        }
    );
    let items = extractItems(response.data);
    if (items.length === 0 && response.data.length < 1000) {
        sessionLastTry = 0;
        session = await initSession();
        response = await axios.get(
            `${BASE_URL}/index.php?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`,
            {
                headers: { ...HEADERS, Referer: BASE_URL + '/', Cookie: session.cookies },
                timeout: 15000,
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
            }
        );
        items = extractItems(response.data);
    }
    return items;
}

function normalizeTitle(title) {
    return title.toLowerCase()
        .replace(/\s*[-–:]\s*\d+\s*Staffel.*$/i, '')
        .replace(/\s*[-–:]\s*Staffel\s*\d+.*$/i, '')
        .replace(/\s*[-–:]\s*\d+\s*Season.*$/i, '')
        .replace(/\s*[-–:]\s*Season\s*\d+.*$/i, '')
        .replace(/\s*\d+\s*Staffel.*$/i, '')
        .replace(/\s*Staffel\s*\d+.*$/i, '')
        .replace(/\s*\d+\s*Season.*$/i, '')
        .replace(/\s*Season\s*\d+.*$/i, '')
        .replace(/\s*[-–]\s*HD$/i, '')
        .replace(/\s*[-–]\s*Komplett$/i, '')
        .replace(/[:]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

async function getSeasons(seriesName) {
    await resolveDomain();
    const searchVariations = [seriesName];
    if (seriesName.includes(':')) searchVariations.push(seriesName.replace(/:/g, ''));
    if (!seriesName.includes(':')) {
        const words = seriesName.split(' ');
        for (let i = 1; i < words.length; i++) {
            searchVariations.push(words.slice(0, i).join(' ') + ': ' + words.slice(i).join(' '));
        }
    }
    const allResults = [];
    const seenUrls = new Set();
    for (const variation of searchVariations) {
        try {
            const results = await search(variation);
            for (const r of results) {
                if (!seenUrls.has(r.url)) {
                    seenUrls.add(r.url);
                    allResults.push(r);
                }
            }
        } catch {}
    }
    const query = normalizeTitle(seriesName);
    return allResults.filter(r => {
        const tBase = normalizeTitle(r.title);
        return tBase === query
            && (r.title.toLowerCase().includes('staffel') || r.title.toLowerCase().includes('season'));
    }).map(r => ({
        title: r.title,
        url: r.url,
        cover: r.cover,
        info: r.info,
        quality: r.quality,
        year: r.year
    }));
}

const GENRE_PAGES_CACHE = {};
async function getMoviesByGenre(genre, page = 1) {
    const cacheKey = genre;
    if (!GENRE_PAGES_CACHE[cacheKey] || Date.now() - GENRE_PAGES_CACHE[cacheKey].time > 600000) {
        const allItems = [];
        for (let p = 1; p <= 5; p++) {
            try {
                const items = await getMovies(p);
                allItems.push(...items);
            } catch { break; }
        }
        for (let p = 1; p <= 5; p++) {
            try {
                const items = await getSeries(p);
                allItems.push(...items);
            } catch { break; }
        }
        const seen = new Set();
        const unique = allItems.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
        GENRE_PAGES_CACHE[cacheKey] = { items: unique, time: Date.now() };
    }
    const genreLower = genre.toLowerCase();
    const items = GENRE_PAGES_CACHE[cacheKey].items;
    if (genre === 'Neu') return items.slice(0, 50);
    return items.filter(i => i.genres.some(g => g.toLowerCase() === genreLower));
}

module.exports = { getPopular, getSeries, getGroupedSeries, getMovies, getDetail, search, resolveVoeLink, resolveDomain, getSeasons, normalizeTitle, getMoviesByGenre };
