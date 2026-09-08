let botId = null;
let currentBotStatus = 'unknown';
let refreshInterval = null;
let soundEnabled = localStorage.getItem('dashSound') !== 'false';
let videoSoundEnabled = localStorage.getItem('dashVideoSound') === 'true';

const BOT_CONFIG = {
    nerox: {
        name: 'NeroX Bot',
        icon: 'fa-skull',
        color: '#ff4757',
        particleColor: 'rgba(255, 71, 87, '
    },
    czeio: {
        name: 'CZEIO Bot',
        icon: 'fa-robot',
        color: '#00d4aa',
        particleColor: 'rgba(0, 212, 170, '
    },
    kushi: {
        name: 'Missy Bot',
        icon: 'fa-heart',
        color: '#ff6b9d',
        particleColor: 'rgba(255, 107, 157, '
    }
};

const SOUNDS = {
    hover: createSound(800, 0.03, 'sine'),
    click: createSound(600, 0.06, 'square'),
    nav: createSound(1000, 0.04, 'sine')
};

function createSound(freq, vol, type) {
    return () => {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.value = vol;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } catch {}
    };
}

function setupSoundToggle() {
    const btn = document.getElementById('sound-toggle');
    const icon = document.getElementById('sound-icon');

    function updateIcon() {
        icon.className = soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
        btn.classList.toggle('muted', !soundEnabled);
    }

    updateIcon();

    btn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        saveServerSettings(botId, { soundEnabled });
        updateIcon();
        if (soundEnabled) SOUNDS.click();
    });
}

function setupVideoSoundToggle() {
    const btn = document.getElementById('video-sound-toggle');
    const icon = document.getElementById('video-sound-icon');

    btn.addEventListener('click', () => {
        videoSoundEnabled = !videoSoundEnabled;
        saveServerSettings(botId, { videoSoundEnabled });
        const video = document.getElementById('bg-video');
        if (video) video.muted = !videoSoundEnabled;
        updateVideoSoundIcon();
        if (soundEnabled) SOUNDS.click();
    });
}

function updateVideoSoundIcon() {
    const btn = document.getElementById('video-sound-toggle');
    const icon = document.getElementById('video-sound-icon');
    icon.className = videoSoundEnabled ? 'fa-solid fa-film' : 'fa-solid fa-film';
    btn.classList.toggle('muted', !videoSoundEnabled);
    btn.title = videoSoundEnabled ? 'Video-Sound aus' : 'Video-Sound an';
}

function setupTransparencySliders() {
    const overlaySlider = document.getElementById('overlay-slider');
    const cardSlider = document.getElementById('card-slider');
    const blurSlider = document.getElementById('blur-slider');
    const glassSlider = document.getElementById('glass-slider');
    const overlayValue = document.getElementById('overlay-value');
    const cardValue = document.getElementById('card-value');
    const blurValue = document.getElementById('blur-value');
    const glassValue = document.getElementById('glass-value');

    applyTransparency(overlaySlider.value, cardSlider.value, blurSlider.value, glassSlider.value);

    overlaySlider.addEventListener('input', () => {
        overlayValue.textContent = overlaySlider.value + '%';
        applyTransparency(overlaySlider.value, cardSlider.value, blurSlider.value, glassSlider.value);
        saveServerSettings(botId, { overlayOpacity: overlaySlider.value });
    });

    cardSlider.addEventListener('input', () => {
        cardValue.textContent = cardSlider.value + '%';
        applyTransparency(overlaySlider.value, cardSlider.value, blurSlider.value, glassSlider.value);
        saveServerSettings(botId, { cardOpacity: cardSlider.value });
    });

    blurSlider.addEventListener('input', () => {
        blurValue.textContent = blurSlider.value + 'px';
        applyTransparency(overlaySlider.value, cardSlider.value, blurSlider.value, glassSlider.value);
        saveServerSettings(botId, { bgBlur: blurSlider.value });
    });

    glassSlider.addEventListener('input', () => {
        glassValue.textContent = glassSlider.value + 'px';
        applyTransparency(overlaySlider.value, cardSlider.value, blurSlider.value, glassSlider.value);
        saveServerSettings(botId, { glassBlur: glassSlider.value });
    });
}

function applyTransparency(overlayVal, cardVal, blurVal, glassVal) {
    const overlayOpacity = overlayVal / 100;
    const cardOpacity = cardVal / 100;
    const bgBlur = blurVal + 'px';
    const glassBlur = glassVal + 'px';
    document.documentElement.style.setProperty('--overlay-opacity', overlayOpacity);
    document.documentElement.style.setProperty('--card-opacity', cardOpacity);
    document.documentElement.style.setProperty('--bg-blur', bgBlur);
    document.documentElement.style.setProperty('--glass-blur', glassBlur);
}

const cursorParticles = [];
let cursorCanvas, cursorCtx;
let mouseX = 0, mouseY = 0;

function initCursorCanvas() {
    cursorCanvas = document.getElementById('cursor-canvas');
    cursorCtx = cursorCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        for (let i = 0; i < 2; i++) {
            cursorParticles.push({
                x: mouseX + (Math.random() - 0.5) * 8,
                y: mouseY + (Math.random() - 0.5) * 8,
                size: Math.random() * 3 + 1,
                life: 1,
                decay: Math.random() * 0.03 + 0.02,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5
            });
        }
    });
    animateCursor();
}

function resizeCanvas() {
    cursorCanvas.width = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
}

function animateCursor() {
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    const config = BOT_CONFIG[botId];
    const colorBase = config ? config.particleColor : 'rgba(0, 212, 170, ';

    for (let i = cursorParticles.length - 1; i >= 0; i--) {
        const p = cursorParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
            cursorParticles.splice(i, 1);
            continue;
        }

        cursorCtx.beginPath();
        cursorCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        cursorCtx.fillStyle = colorBase + (p.life * 0.6) + ')';
        cursorCtx.fill();
    }

    if (cursorParticles.length > 150) cursorParticles.splice(0, 50);
    requestAnimationFrame(animateCursor);
}

function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (12 + Math.random() * 18) + 's';
        p.style.animationDelay = Math.random() * 10 + 's';
        p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
        container.appendChild(p);
    }
}

async function loadBackground() {
    if (!botId) return;
    const container = document.getElementById('bg-container');
    const preview = document.getElementById('bg-preview');
    const deleteBtn = document.getElementById('bg-delete-btn');
    const videoSoundBtn = document.getElementById('video-sound-toggle');

    try {
        const res = await fetch(`/api/bot/${botId}/background`);
        const data = await res.json();

        if (!data.exists) {
            container.innerHTML = '';
            preview.innerHTML = '<p class="muted">Kein Hintergrund gesetzt</p>';
            deleteBtn.style.display = 'none';
            videoSoundBtn.style.display = 'none';
            return;
        }

        deleteBtn.style.display = 'flex';

        if (data.type === 'video') {
            container.innerHTML = `<video autoplay loop playsinline id="bg-video"><source src="${data.url}" type="${data.mime}"></video>`;
            preview.innerHTML = `<video autoplay loop muted playsinline><source src="${data.url}" type="${data.mime}"></video>`;
            const video = document.getElementById('bg-video');
            video.muted = !videoSoundEnabled;
            video.addEventListener('loadeddata', () => extractAccentFromVideo(video));
            // Video-Sound Button anzeigen
            videoSoundBtn.style.display = '';
            updateVideoSoundIcon();
        } else {
            container.innerHTML = `<img src="${data.url}" alt="Background" id="bg-image">`;
            preview.innerHTML = `<img src="${data.url}" alt="Background">`;
            const img = document.getElementById('bg-image');
            img.addEventListener('load', () => extractAccentFromImage(img));
            videoSoundBtn.style.display = 'none';
        }
    } catch {
        container.innerHTML = '';
    }
}

// ========== DYNAMISCHE AKZENTFARBE ==========
function extractAccentFromImage(img) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const pixels = ctx.getImageData(0, 0, size, size).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < pixels.length; i += 16) {
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
            count++;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Helligkeit anpassen für gute Lesbarkeit
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness < 80) {
            r = Math.min(255, r + 60);
            g = Math.min(255, g + 60);
            b = Math.min(255, b + 60);
        } else if (brightness > 180) {
            r = Math.max(0, r - 40);
            g = Math.max(0, g - 40);
            b = Math.max(0, b - 40);
        }

        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        setAccentColor(hex);
    } catch {}
}

function extractAccentFromVideo(video) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(video, 0, 0, size, size);
        const pixels = ctx.getImageData(0, 0, size, size).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < pixels.length; i += 16) {
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
            count++;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness < 80) {
            r = Math.min(255, r + 60);
            g = Math.min(255, g + 60);
            b = Math.min(255, b + 60);
        } else if (brightness > 180) {
            r = Math.max(0, r - 40);
            g = Math.max(0, g - 40);
            b = Math.max(0, b - 40);
        }

        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        setAccentColor(hex);
    } catch {}
}

function setAccentColor(hex) {
    document.documentElement.style.setProperty('--accent', hex);
    saveServerSettings(botId, { accentColor: hex });
}

function setupBackgroundUpload() {
    const area = document.getElementById('bg-upload-area');
    const input = document.getElementById('bg-file-input');
    const msg = document.getElementById('bg-upload-message');
    const deleteBtn = document.getElementById('bg-delete-btn');

    area.addEventListener('click', () => input.click());

    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.style.borderColor = 'var(--accent)';
    });

    area.addEventListener('dragleave', () => {
        area.style.borderColor = '';
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.style.borderColor = '';
        if (e.dataTransfer.files.length) uploadBackground(e.dataTransfer.files[0]);
    });

    input.addEventListener('change', () => {
        if (input.files.length) uploadBackground(input.files[0]);
    });

    deleteBtn.addEventListener('click', async () => {
        try {
            await fetch(`/api/bot/${botId}/background`, { method: 'DELETE' });
            document.getElementById('bg-container').innerHTML = '';
            document.getElementById('bg-preview').innerHTML = '<p class="muted">Kein Hintergrund gesetzt</p>';
            deleteBtn.style.display = 'none';
            document.getElementById('video-sound-toggle').style.display = 'none';
            msg.textContent = 'Hintergrund entfernt';
            msg.className = 'form-message success';
            const config = BOT_CONFIG[botId];
            if (config) {
                document.documentElement.style.setProperty('--accent', config.color);
                saveServerSettings(botId, { accentColor: config.color });
            }
        } catch {
            msg.textContent = 'Fehler beim Entfernen';
            msg.className = 'form-message error';
        }
    });

    async function uploadBackground(file) {
        msg.textContent = 'Hochladen...';
        msg.className = 'form-message';

        const formData = new FormData();
        formData.append('background', file);

        try {
            const res = await fetch(`/api/bot/${botId}/background`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                msg.textContent = 'Hintergrund gesetzt!';
                msg.className = 'form-message success';
                loadBackground();
            } else {
                msg.textContent = data.error || 'Fehler beim Upload';
                msg.className = 'form-message error';
            }
        } catch {
            msg.textContent = 'Verbindungsfehler';
            msg.className = 'form-message error';
        }
    }
}

async function checkSession() {
    try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (!data.loggedIn) {
            window.location.href = '/';
            return false;
        }
        botId = data.botId;
        initDashboard(data.botId, data.botName);
        return true;
    } catch {
        window.location.href = '/';
        return false;
    }
}

function initDashboard(id, name) {
    const config = BOT_CONFIG[id];
    if (!config) return;

    document.title = `${config.name} Dashboard`;

    const logo = document.getElementById('bot-logo');
    logo.className = `bot-logo ${id}`;

    document.getElementById('bot-name').textContent = config.name;

    loadServerSettings(id);

    loadData();
    loadBackground();
    loadSidebarProfile(id);
    refreshInterval = setInterval(loadData, 10000);
}

async function loadServerSettings(botId) {
    try {
        const res = await fetch(`/api/bot/${botId}/settings`);
        const data = await res.json();

        const overlaySlider = document.getElementById('overlay-slider');
        const cardSlider = document.getElementById('card-slider');
        const blurSlider = document.getElementById('blur-slider');
        const glassSlider = document.getElementById('glass-slider');

        if (data.accentColor) {
            document.documentElement.style.setProperty('--accent', data.accentColor);
        }
        if (data.overlayOpacity !== undefined && overlaySlider) {
            overlaySlider.value = data.overlayOpacity;
            document.getElementById('overlay-value').textContent = data.overlayOpacity + '%';
        }
        if (data.cardOpacity !== undefined && cardSlider) {
            cardSlider.value = data.cardOpacity;
            document.getElementById('card-value').textContent = data.cardOpacity + '%';
        }
        if (data.bgBlur !== undefined && blurSlider) {
            blurSlider.value = data.bgBlur;
            document.getElementById('blur-value').textContent = data.bgBlur + 'px';
        }
        if (data.glassBlur !== undefined && glassSlider) {
            glassSlider.value = data.glassBlur;
            document.getElementById('glass-value').textContent = data.glassBlur + 'px';
        }
        if (data.soundEnabled !== undefined) {
            soundEnabled = data.soundEnabled;
            const icon = document.getElementById('sound-icon');
            const btn = document.getElementById('sound-toggle');
            if (icon) icon.className = soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
            if (btn) btn.classList.toggle('muted', !soundEnabled);
        }
        if (data.videoSoundEnabled !== undefined) {
            videoSoundEnabled = data.videoSoundEnabled;
            updateVideoSoundIcon();
        }

        applyTransparency(
            overlaySlider ? overlaySlider.value : 35,
            cardSlider ? cardSlider.value : 65,
            blurSlider ? blurSlider.value : 0,
            glassSlider ? glassSlider.value : 12
        );
    } catch {}
}

async function saveServerSettings(botId, settings) {
    try {
        await fetch(`/api/bot/${botId}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
    } catch {}
}

async function loadSidebarProfile(botId) {
    try {
        const res = await fetch(`/api/bot/${botId}/profile`);
        const data = await res.json();
        const img = document.getElementById('bot-logo-img');
        const icon = document.getElementById('bot-logo-icon');
        if (data.exists) {
            img.src = data.url + '?t=' + Date.now();
            img.style.display = '';
            icon.style.display = 'none';
        } else {
            img.style.display = 'none';
            icon.style.display = '';
        }
    } catch {}
}

async function loadData() {
    if (!botId) return;

    const btn = document.getElementById('refresh-btn');
    btn.classList.add('spinning');

    try {
        const safeFetch = async (url) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(res.status);
                return await res.json();
            } catch { return null; }
        };

        const [stats, users, groups, warnings, status, health] = await Promise.all([
            safeFetch(`/api/bot/${botId}/stats`),
            safeFetch(`/api/bot/${botId}/users`),
            safeFetch(`/api/bot/${botId}/groups`),
            safeFetch(`/api/bot/${botId}/warnings`),
            safeFetch('/api/status'),
            safeFetch(`/api/bot/${botId}/bot-health`)
        ]);

        if (stats) renderStats(stats);
        if (health) renderUptime(health?.connected ? (health.uptime || 0) : 0);
        if (stats) renderTopUsers(stats.topUsers || []);
        if (users) renderUsers(users.users || []);
        if (groups) renderGroups(groups.groups || []);
        if (warnings) renderWarnings(warnings.warnings || []);
        renderBotStatus(health?.connected || false, health?.status || 'unknown');
        currentBotStatus = health?.status || 'unknown';

        const now = new Date();
        document.getElementById('last-update').textContent =
            `Aktualisiert: ${now.toLocaleTimeString('de-DE')}`;
    } catch (e) {
        console.error('Fehler beim Laden:', e);
    }

    setTimeout(() => btn.classList.remove('spinning'), 500);
}

function renderStats(stats) {
    document.getElementById('stat-users').textContent = stats.totalUsers || 0;
    document.getElementById('stat-groups').textContent = stats.totalGroups || 0;
    document.getElementById('stat-xp').textContent = formatNumber(stats.totalXP || 0);
    document.getElementById('stat-coins').textContent = formatNumber(stats.totalBalance || 0);
    document.getElementById('stat-warnings').textContent = stats.totalWarnings || 0;
}

function renderUptime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}T`);
    if (hours > 0) parts.push(`${hours}Std`);
    if (minutes > 0) parts.push(`${minutes}Min`);
    parts.push(`${seconds}Sek`);

    const uptimeEl = document.getElementById('stat-uptime');
    uptimeEl.textContent = parts.join(' ');
    uptimeEl.classList.toggle('small', parts.length > 2);
}

function renderBotStatus(running, botStatus) {
    const badge = document.getElementById('bot-status-badge');
    const statusText = document.getElementById('status-text');
    const sidebarBadge = document.getElementById('bot-badge');
    const startBtn = document.getElementById('bot-start-btn');
    const stopBtn = document.getElementById('bot-stop-btn');
    const restartBtn = document.getElementById('bot-restart-btn');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');

    badge.className = 'bot-status-badge ' + (running ? 'running' : 'stopped');
    let statusLabel = running ? 'Läuft' : 'Gestoppt';
    if (botStatus === 'waiting_qr') statusLabel = 'QR-Code nötig';
    else if (botStatus === 'logged_out') statusLabel = 'Ausgeloggt — neu verbinden';
    else if (botStatus === 'disconnected') statusLabel = 'Getrennt';
    statusText.textContent = statusLabel;

    sidebarBadge.textContent = running ? 'Online' : 'Offline';
    sidebarBadge.className = 'bot-badge ' + (running ? 'online' : 'offline');

    startBtn.disabled = running && botStatus !== 'disconnected' && botStatus !== 'logged_out';
    stopBtn.disabled = !running;
    restartBtn.disabled = false;
    restartBtn.textContent = botStatus === 'logged_out' ? 'Neu verbinden' : 'Neustart';

    // QR immer anzeigen
    const qrImg = document.getElementById('qr-image');
    const qrHint = document.getElementById('qr-hint');
    const qrUrl = `/api/bot/${botId}/qr?t=${Date.now()}`;
    qrImg.onload = function() {
        qrImg.style.display = '';
        if (qrHint) qrHint.style.display = '';
    };
    qrImg.onerror = function() {
        qrImg.style.display = 'none';
        if (qrHint) {
            if (running && botStatus === 'connected') {
                qrHint.textContent = 'Bot ist verbunden — kein QR-Code nötig';
                qrHint.style.display = '';
            } else if (botStatus === 'waiting_qr') {
                qrHint.textContent = 'QR-Code wird generiert...';
                qrHint.style.display = '';
            } else {
                qrHint.textContent = 'Kein QR-Code verfügbar — Bot neu starten';
                qrHint.style.display = '';
            }
        }
    };
    qrImg.src = qrUrl;
}

function renderTopUsers(users) {
    const container = document.getElementById('top-users-list');

    if (!users.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-users"></i><p>Keine Benutzer vorhanden</p></div>';
        return;
    }

    container.innerHTML = users.map((user, i) => {
        let rankClass = '';
        if (i === 0) rankClass = 'gold';
        else if (i === 1) rankClass = 'silver';
        else if (i === 2) rankClass = 'bronze';

        return `
            <div class="top-user-item">
                <div class="top-user-rank ${rankClass}">${i + 1}</div>
                <div class="top-user-info">
                    <div class="top-user-name">${escapeHtml(user.name)}</div>
                    <div class="top-user-meta">Level ${user.level} · ${user.rank}</div>
                </div>
                <div class="top-user-xp">${formatNumber(user.xp)} XP</div>
            </div>
        `;
    }).join('');
}

function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');

    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="muted">Keine Benutzer vorhanden</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((user, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(user.name)}</td>
            <td>${user.level}</td>
            <td>${formatNumber(user.xp)}</td>
            <td>${user.rank}</td>
            <td>${formatNumber(user.balance)}</td>
            <td>+${user.phone}</td>
        </tr>
    `).join('');
}

function renderGroups(groups) {
    const container = document.getElementById('groups-grid');

    if (!groups.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-layer-group"></i><p>Keine Gruppen vorhanden</p></div>';
        return;
    }

    container.innerHTML = groups.map(group => `
        <div class="group-card" onclick="openGroupModal('${group.jid}', '${escapeHtml(group.name).replace(/'/g, "\\'")}')">
            <div class="group-icon">
                <i class="fa-solid fa-users"></i>
            </div>
            <div class="group-name" title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</div>
            <div class="group-meta">
                <i class="fa-solid fa-user-group"></i>
                ${group.members >= 0 ? group.members + ' Mitglieder' : 'Mitglieder: k.A.'}
            </div>
        </div>
    `).join('');
}

// ========== GRUPPEN-DETAIL MODAL ==========
let currentGroupJid = null;
let pendingAdminAction = null;

async function openGroupModal(groupJid, groupName) {
    currentGroupJid = groupJid;
    const modal = document.getElementById('group-modal');
    const nameEl = document.getElementById('group-modal-name');
    const jidEl = document.getElementById('group-modal-jid');
    const metaEl = document.getElementById('group-modal-meta');
    const membersEl = document.getElementById('group-modal-members');
    const countEl = document.getElementById('group-modal-count');

    nameEl.textContent = groupName || 'Gruppe';
    jidEl.textContent = groupJid;
    metaEl.innerHTML = '';
    membersEl.innerHTML = '<p class="muted"><i class="fa-solid fa-spinner fa-spin"></i> Lädt Mitglieder...</p>';
    countEl.textContent = '';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(groupJid)}/members`);
        const data = await res.json();

        if (data.error) {
            membersEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>${escapeHtml(data.error)}</p></div>`;
            return;
        }

        nameEl.textContent = data.name || groupName || 'Gruppe';
        if (data.description) {
            metaEl.innerHTML = `<div class="group-description"><i class="fa-solid fa-info-circle"></i> ${escapeHtml(data.description)}</div>`;
        }

        const members = data.participants || [];
        countEl.textContent = `${members.length} Mitglieder`;

        if (!members.length) {
            membersEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-users"></i><p>Keine Mitglieder</p></div>';
            return;
        }

        membersEl.innerHTML = members.map(m => {
            const phone = m.phone || m.jid.split('@')[0];
            const displayName = m.name || phone;
            const isAdmin = m.admin === 'admin' || m.admin === 'superadmin';
            const isSuperAdmin = m.admin === 'superadmin';
            const isBot = m.isBot;
            const avatarChar = m.name ? m.name.charAt(0).toUpperCase() : phone.slice(-2);

            let badges = '';
            if (isSuperAdmin) badges += '<span class="badge badge-owner">Inhaber</span>';
            else if (isAdmin) badges += '<span class="badge badge-admin">Admin</span>';
            if (isBot) badges += '<span class="badge badge-bot">Bot</span>';

            let actionBtn = '';
            if (!isBot && botIsAdmin) {
                if (isAdmin) {
                    actionBtn = `<button class="member-action demote" onclick="confirmAdminAction('${m.jid}', '${escapeHtml(displayName).replace(/'/g, "\\'")}', 'demote')"><i class="fa-solid fa-arrow-down"></i> Admin entziehen</button>`;
                } else {
                    actionBtn = `<button class="member-action promote" onclick="confirmAdminAction('${m.jid}', '${escapeHtml(displayName).replace(/'/g, "\\'")}', 'promote')"><i class="fa-solid fa-arrow-up"></i> Admin machen</button>`;
                }
            }

            return `
                <div class="member-item">
                    <div class="member-avatar">${avatarChar}</div>
                    <div class="member-info">
                        <div class="member-name">${escapeHtml(displayName)} ${badges}</div>
                        <div class="member-phone">+${phone}</div>
                    </div>
                    <div class="member-actions">${actionBtn}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        membersEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Fehler beim Laden: ${escapeHtml(e.message)}</p></div>`;
    }
}

let botIsAdmin = false;

async function checkBotAdminStatus(groupJid) {
    try {
        const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(groupJid)}/members`);
        const data = await res.json();
        if (data.participants) {
            const botParticipant = data.participants.find(p => p.isBot);
            botIsAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
        }
    } catch {
        botIsAdmin = false;
    }
}

function confirmAdminAction(participantJid, name, action) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const btnEl = document.getElementById('confirm-btn');

    const isPromote = action === 'promote';
    titleEl.textContent = isPromote ? 'Admin ernennen' : 'Admin-Rechte entziehen';
    msgEl.textContent = `Bist du sicher, dass du ${name} ${isPromote ? 'zum Admin machen' : 'die Admin-Rechte entziehen'} willst?`;
    btnEl.className = isPromote ? 'settings-btn' : 'settings-btn danger';
    btnEl.textContent = isPromote ? 'Admin machen' : 'Admin entziehen';

    pendingAdminAction = { participantJid, action };
    modal.style.display = 'flex';
}

async function executeAdminAction() {
    if (!pendingAdminAction || !currentGroupJid) return;

    const { participantJid, action } = pendingAdminAction;
    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Wird ausgeführt...';

    try {
        const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(currentGroupJid)}/admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantJid, action })
        });
        const data = await res.json();

        closeConfirmModal();

        if (data.success) {
            showToast(data.message || 'Aktion erfolgreich!', 'success');
            openGroupModal(currentGroupJid, document.getElementById('group-modal-name').textContent);
        } else {
            showToast(data.error || 'Fehler bei der Aktion', 'error');
        }
    } catch (e) {
        closeConfirmModal();
        showToast('Verbindungsfehler: ' + e.message, 'error');
    }
}

function closeGroupModal() {
    document.getElementById('group-modal').style.display = 'none';
    currentGroupJid = null;
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    pendingAdminAction = null;
    const btn = document.getElementById('confirm-btn');
    btn.disabled = false;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

async function loadLoginLog() {
    const container = document.getElementById('loginlog-list');
    try {
        const res = await fetch('/api/login-log');
        const data = await res.json();
        if (!data.logs || !data.logs.length) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><p>Keine Log-Einträge vorhanden</p></div>';
            return;
        }
        container.innerHTML = data.logs.map(log => {
            const d = new Date(log.time);
            const time = d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const botName = log.bot === 'czeio' ? 'CZEIO Bot' : 'NeroX Bot';
            const botColor = log.bot === 'czeio' ? 'var(--czeio)' : 'var(--nerox)';
            return `
                <div class="loginlog-item">
                    <div class="loginlog-dot" style="background:${botColor}"></div>
                    <div class="loginlog-info">
                        <div class="loginlog-bot">${botName}</div>
                        <div class="loginlog-time">${time}</div>
                    </div>
                    <div class="loginlog-ip">${log.ip || 'unbekannt'}</div>
                </div>
            `;
        }).join('');
    } catch {
        container.innerHTML = '<p class="muted">Fehler beim Laden</p>';
    }
}

// Registrierungen laden
async function loadRegistrierungen() {
    const container = document.getElementById('registrierungen-list');
    try {
        const res = await fetch(`/api/bot/${botId}/registrierungen`);
        const data = await res.json();
        if (!data.registrations || !data.registrations.length) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-check"></i><p>Keine Registrierungen vorhanden</p></div>';
            return;
        }
        container.innerHTML = `
            <div style="margin-bottom:12px;color:var(--text-muted);font-size:13px;">
                <i class="fa-solid fa-users"></i> ${data.registrations.length} registrierte Nutzer
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border);text-align:left;">
                            <th style="padding:8px;">#</th>
                            <th style="padding:8px;">Name</th>
                            <th style="padding:8px;">Nummer</th>
                            <th style="padding:8px;">Registriert</th>
                            <th style="padding:8px;">Level</th>
                            <th style="padding:8px;">XP</th>
                            <th style="padding:8px;">Coins</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.registrations.map((r, i) => {
                            const d = new Date(r.registeredAt);
                            const regDate = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            const regTime = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            const now = Date.now();
                            const diff = now - r.registeredAt;
                            const mins = Math.floor(diff / 60000);
                            const hours = Math.floor(diff / 3600000);
                            const days = Math.floor(diff / 86400000);
                            let relative = '';
                            if (days > 0) relative = `vor ${days} Tag${days > 1 ? 'en' : ''}`;
                            else if (hours > 0) relative = `vor ${hours} Stunde${hours > 1 ? 'n' : ''}`;
                            else if (mins > 0) relative = `vor ${mins} Minute${mins > 1 ? 'n' : ''}`;
                            else relative = 'gerade eben';
                            return `
                                <tr style="border-bottom:1px solid var(--border);">
                                    <td style="padding:8px;">${i + 1}</td>
                                    <td style="padding:8px;font-weight:600;">${r.name}</td>
                                    <td style="padding:8px;">${r.phone}</td>
                                    <td style="padding:8px;" title="${regDate} ${regTime}">${relative}<br><span style="font-size:11px;color:var(--text-muted);">${regDate} ${regTime}</span></td>
                                    <td style="padding:8px;">${r.level}</td>
                                    <td style="padding:8px;">${r.xp}</td>
                                    <td style="padding:8px;">${r.balance}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch {
        container.innerHTML = '<p class="muted">Fehler beim Laden</p>';
    }
}

async function loadAniWorldDownloads() {
    const container = document.getElementById('aniworld-downloads-list');
    try {
        const res = await fetch('/api/aniworld-downloads');
        const data = await res.json();
        if (!data.files || !data.files.length) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-film"></i><p>Keine Downloads vorhanden</p><p style="font-size:12px;margin-top:8px;">Nutze den Bot: $aniworld <Suchbegriff></p></div>';
            return;
        }
        let totalSize = 0;
        data.files.forEach(f => totalSize += f.size);
        container.innerHTML = `
            <div style="margin-bottom:12px;color:var(--text-muted);font-size:13px;">
                <i class="fa-solid fa-database"></i> ${data.files.length} Dateien | ${(totalSize / 1024 / 1024).toFixed(0)}MB gesamt
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border);text-align:left;">
                            <th style="padding:8px;">#</th>
                            <th style="padding:8px;">Datei</th>
                            <th style="padding:8px;">Größe</th>
                            <th style="padding:8px;">Datum</th>
                            <th style="padding:8px;">Aktion</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.files.map((f, i) => {
                            const d = new Date(f.date);
                            const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            return `
                                <tr style="border-bottom:1px solid var(--border);">
                                    <td style="padding:8px;">${i + 1}</td>
                                    <td style="padding:8px;font-weight:600;word-break:break-all;">🎬 ${f.name}</td>
                                    <td style="padding:8px;">${f.sizeMB}MB</td>
                                    <td style="padding:8px;">${dateStr} ${timeStr}</td>
                                    <td style="padding:8px;">
                                        <a href="${f.url}" download style="color:var(--accent,#00d4aa);margin-right:10px;"><i class="fa-solid fa-download"></i></a>
                                        <button onclick="deleteAniWorldFile('${f.name}')" style="color:#ff4757;border:none;background:none;cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch {
        container.innerHTML = '<p class="muted">Fehler beim Laden</p>';
    }
}

async function deleteAniWorldFile(filename) {
    if (!confirm('Datei löschen: ' + filename + '?')) return;
    await fetch('/api/aniworld-downloads/' + encodeURIComponent(filename), { method: 'DELETE' });
    loadAniWorldDownloads();
}

async function loadCommands() {
    const container = document.getElementById('commands-list');
    const searchInput = document.getElementById('cmd-search');
    try {
        const res = await fetch('/api/bot/' + botId + '/commands');
        if (!res.ok) { container.innerHTML = '<p class="muted">Keine Befehle verfügbar</p>'; return; }
        const data = await res.json();
        window._commandsData = data;
        renderCommands(data);
        searchInput.oninput = () => {
            const q = searchInput.value.toLowerCase().trim();
            if (!q) { renderCommands(data); return; }
            const filtered = { ...data, categories: data.categories.map(cat => ({
                ...cat,
                commands: cat.commands.filter(c => c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
            })).filter(cat => cat.commands.length > 0) };
            renderCommands(filtered);
        };
    } catch { container.innerHTML = '<p class="muted">Fehler beim Laden</p>'; }
}

function renderCommands(data) {
    const container = document.getElementById('commands-list');
    if (!data.categories || !data.categories.length) { container.innerHTML = '<p class="muted">Keine Befehle</p>'; return; }
    container.innerHTML = data.categories.map(cat => `
        <div class="cmd-category">
            <div class="cmd-category-header">
                <i class="${cat.icon}"></i>
                <span>${cat.name}</span>
                <span class="cmd-count">${cat.commands.length}</span>
            </div>
            <div class="cmd-list">
                ${cat.commands.map(c => `
                    <div class="cmd-item">
                        <code class="cmd-name">${c.cmd}</code>
                        <span class="cmd-desc">${c.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

let apSelectedGroups = new Set();
let apGroupsData = [];

async function loadAdminPanel() {
    const container = document.getElementById('ap-groups-list');
    try {
        const res = await fetch(`/api/bot/${botId}/groups`);
        const data = await res.json();
        apGroupsData = data.groups || [];
        renderApGroups();
        apUpdateSettings();
    } catch { container.innerHTML = '<p class="muted">Fehler beim Laden</p>'; }
    try {
        const res = await fetch(`/api/bot/${botId}/prefix`);
        const data = await res.json();
        document.getElementById('ap-prefix-input').value = data.prefix || '';
    } catch {}
}

function renderApGroups() {
    const container = document.getElementById('ap-groups-list');
    if (!apGroupsData.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-layer-group"></i><p>Keine Gruppen vorhanden</p></div>';
        return;
    }
    container.innerHTML = apGroupsData.map(g => {
        const checked = apSelectedGroups.has(g.jid) ? 'checked' : '';
        return `
            <label class="ap-group-item">
                <input type="checkbox" class="ap-cb" data-jid="${g.jid}" ${checked}>
                <span class="ap-group-name">${escapeHtml(g.name || g.jid)}</span>
                <span class="ap-group-members">${g.members || '?'} Mitglieder</span>
            </label>
        `;
    }).join('');
    container.querySelectorAll('.ap-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) apSelectedGroups.add(cb.dataset.jid);
            else apSelectedGroups.delete(cb.dataset.jid);
            apUpdateSettings();
        });
    });
}

function apUpdateSettings() {
    const body = document.getElementById('ap-settings-body');
    const countEl = document.getElementById('ap-selected-count');
    const count = apSelectedGroups.size;
    countEl.textContent = count > 0 ? `(${count} Gruppe${count > 1 ? 'n' : ''})` : '';
    if (count === 0) {
        body.innerHTML = '<p class="muted">Mindestens eine Gruppe auswählen</p>';
        return;
    }
    body.innerHTML = `
        <div class="ap-toggles">
            <div class="ap-toggle-row">
                <span class="ap-toggle-label"><i class="fa-solid fa-link-slash"></i> Antilink</span>
                <label class="toggle"><input type="checkbox" id="ap-antilink"><span class="toggle-slider"></span></label>
            </div>
            <div class="ap-toggle-row">
                <span class="ap-toggle-label"><i class="fa-solid fa-hand-wave"></i> Willkommen</span>
                <label class="toggle"><input type="checkbox" id="ap-welcome"><span class="toggle-slider"></span></label>
            </div>
            <div class="ap-toggle-row">
                <span class="ap-toggle-label"><i class="fa-solid fa-icons"></i> Autosticker</span>
                <label class="toggle"><input type="checkbox" id="ap-autosticker"><span class="toggle-slider"></span></label>
            </div>
            <div class="ap-divider"></div>
            <div class="ap-toggle-row">
                <span class="ap-toggle-label"><i class="fa-solid fa-lock"></i> Lock (nur Admins schreiben)</span>
                <label class="toggle"><input type="checkbox" id="ap-lock"><span class="toggle-slider"></span></label>
            </div>
            <div class="ap-toggle-row">
                <span class="ap-toggle-label"><i class="fa-solid fa-comment-slash"></i> Botmute (Bot ignoriert Nicht-Admins)</span>
                <label class="toggle"><input type="checkbox" id="ap-botmute"><span class="toggle-slider"></span></label>
            </div>
            <div class="ap-toggle-row">
                <span class="ap-toggle-label"><i class="fa-solid fa-eye-slash"></i> Silent (kein Welcome)</span>
                <label class="toggle"><input type="checkbox" id="ap-silent"><span class="toggle-slider"></span></label>
            </div>
            <div class="ap-divider"></div>
            <div class="ap-toggle-row">
                <span class="ap-toggle-label"><i class="fa-solid fa-ban"></i> Badwords-Filter</span>
                <label class="toggle"><input type="checkbox" id="ap-badwords-enabled"><span class="toggle-slider"></span></label>
            </div>
        </div>
        <div class="ap-section">
            <h4><i class="fa-solid fa-ban"></i> Badwords</h4>
            <div id="ap-badwords-area"><p class="muted">Lädt...</p></div>
        </div>
        <div class="ap-section">
            <h4><i class="fa-solid fa-triangle-exclamation"></i> Warnungen</h4>
            <div id="ap-warnings-area"><p class="muted">Lädt...</p></div>
        </div>
    `;
    apLoadGroupStates();
    apLoadBadwords();
    apLoadWarnings();
    document.querySelectorAll('.ap-toggles .toggle input').forEach(tog => {
        tog.addEventListener('change', apApplyToggles);
    });
}

async function apLoadGroupStates() {
    const firstJid = [...apSelectedGroups][0];
    if (!firstJid) return;
    try {
        const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(firstJid)}/settings`);
        const data = await res.json();
        if (data.antilink !== undefined) document.getElementById('ap-antilink').checked = data.antilink;
        if (data.welcome !== undefined) document.getElementById('ap-welcome').checked = data.welcome;
        if (data.autosticker !== undefined) document.getElementById('ap-autosticker').checked = data.autosticker;
        if (data.badwordsEnabled !== undefined) document.getElementById('ap-badwords-enabled').checked = data.badwordsEnabled;
        if (data.adminmode) {
            if (data.adminmode.lock !== undefined) document.getElementById('ap-lock').checked = data.adminmode.lock;
            if (data.adminmode.botmute !== undefined) document.getElementById('ap-botmute').checked = data.adminmode.botmute;
            if (data.adminmode.silent !== undefined) document.getElementById('ap-silent').checked = data.adminmode.silent;
        }
    } catch {}
}

async function apApplyToggles() {
    const settings = {
        antilink: document.getElementById('ap-antilink').checked,
        welcome: document.getElementById('ap-welcome').checked,
        autosticker: document.getElementById('ap-autosticker').checked,
        badwordsEnabled: document.getElementById('ap-badwords-enabled').checked,
        adminmode: {
            lock: document.getElementById('ap-lock').checked,
            botmute: document.getElementById('ap-botmute').checked,
            silent: document.getElementById('ap-silent').checked
        }
    };
    let ok = 0, fail = 0;
    for (const jid of apSelectedGroups) {
        try {
            const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(jid)}/settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings)
            });
            if (res.ok) ok++; else fail++;
        } catch { fail++; }
    }
    showToast(`Einstellungen angewendet: ${ok} Gruppe(n)${fail > 0 ? ', ' + fail + ' fehlgeschlagen' : ''}`, ok > 0 ? 'success' : 'error');
}

async function apLoadBadwords() {
    const area = document.getElementById('ap-badwords-area');
    const allWords = new Map();
    for (const g of apGroupsData) {
        const jid = g.jid;
        try {
            const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(jid)}/settings`);
            const data = await res.json();
            (data.badwords || []).forEach(w => {
                const expanded = w.split('/').map(s => s.trim()).filter(Boolean);
                expanded.forEach(word => {
                    if (!allWords.has(word)) allWords.set(word, new Set());
                    allWords.get(word).add(jid);
                });
            });
        } catch {}
    }
    let html = '<div class="badwords-add"><input type="text" id="ap-badword-input" class="search-input" placeholder="Neues Badword..."><button id="ap-badword-add-btn" class="btn btn-sm"><i class="fa-solid fa-plus"></i> Hinzufügen</button></div>';
    html += `<p class="muted" style="margin:0 0 8px">${allWords.size} Badword(s) in ${apGroupsData.length} Gruppe(n)</p>`;
    if (allWords.size === 0) {
        html += '<p class="muted">Keine Badwords vorhanden</p>';
        area.innerHTML = html;
        setupApBadwordAdd();
        return;
    }
    html += '<div class="badwords-chips">' + [...allWords.keys()].sort().map(w => {
        const count = allWords.get(w).size;
        return `<span class="badword-chip">${w}<span class="badword-count">${count}/${apGroupsData.length}</span><button class="ap-bw-remove" data-word="${w}">&times;</button></span>`;
    }).join('') + '</div>';
    area.innerHTML = html;
    area.querySelectorAll('.ap-bw-remove').forEach(btn => {
        btn.onclick = async () => {
            const word = btn.dataset.word;
            let removed = 0;
            for (const g of apGroupsData) {
                try {
                    const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(g.jid)}/settings`);
                    const data = await res.json();
                    const words = (data.badwords || []).flatMap(w => w.split('/').map(s => s.trim()).filter(Boolean));
                    const idx = words.indexOf(word);
                    if (idx !== -1) { words.splice(idx, 1); removed++; }
                    await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(g.jid)}/settings`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ badwords: words })
                    });
                } catch {}
            }
            apLoadBadwords();
            showToast(`"${word}" aus ${removed} Gruppe(n) entfernt`, 'success');
        };
    });
    setupApBadwordAdd();
}

function setupApBadwordAdd() {
    const addBtn = document.getElementById('ap-badword-add-btn');
    const input = document.getElementById('ap-badword-input');
    if (!addBtn || !input) return;
    addBtn.onclick = async () => {
        const word = input.value.trim().toLowerCase();
        if (!word) return;
        let added = 0;
        for (const g of apGroupsData) {
            try {
                const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(g.jid)}/settings`);
                const data = await res.json();
                const words = (data.badwords || []).flatMap(w => w.split('/').map(s => s.trim()).filter(Boolean));
                if (!words.includes(word)) {
                    words.push(word);
                    await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(g.jid)}/settings`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ badwords: words })
                    });
                    added++;
                }
            } catch {}
        }
        input.value = '';
        apLoadBadwords();
        showToast(`"${word}" zu ${added} Gruppe(n) hinzugefügt`, 'success');
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') addBtn.click(); };
}

async function apLoadWarnings() {
    const area = document.getElementById('ap-warnings-area');
    const allWarns = new Map();
    for (const jid of apSelectedGroups) {
        try {
            const res = await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(jid)}/warnings`);
            const data = await res.json();
            (data.warnings || []).forEach(w => {
                if (!allWarns.has(w.jid)) allWarns.set(w.jid, { name: w.name, total: 0, groups: [] });
                allWarns.get(w.jid).total += w.count;
                allWarns.get(w.jid).groups.push({ jid, count: w.count });
            });
        } catch {}
    }
    if (allWarns.size === 0) {
        area.innerHTML = '<p class="muted">Keine Warnungen in Auswahl</p>';
        return;
    }
    area.innerHTML = '<div class="ap-warn-list">' + [...allWarns.entries()].map(([jid, info]) => `
        <div class="ap-warn-item">
            <div class="ap-warn-info">
                <span class="ap-warn-name">${escapeHtml(info.name)}</span>
                <span class="ap-warn-count">${info.total}/3 Warnungen</span>
            </div>
            <button class="btn btn-sm ap-warn-clear" data-jid="${jid}"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('') + '</div>';
    area.querySelectorAll('.ap-warn-clear').forEach(btn => {
        btn.onclick = async () => {
            const userJid = btn.dataset.jid;
            for (const g of apSelectedGroups) {
                try {
                    await fetch(`/api/bot/${botId}/groups/${encodeURIComponent(g)}/warnings`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userJid })
                    });
                } catch {}
            }
            apLoadWarnings();
            showToast('Warnungen zurückgesetzt', 'success');
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const selectAllBtn = document.getElementById('ap-select-all');
    const deselectAllBtn = document.getElementById('ap-deselect-all');
    if (selectAllBtn) selectAllBtn.onclick = () => {
        apGroupsData.forEach(g => apSelectedGroups.add(g.jid));
        renderApGroups();
        apUpdateSettings();
    };
    if (deselectAllBtn) deselectAllBtn.onclick = () => {
        apSelectedGroups.clear();
        renderApGroups();
        apUpdateSettings();
    };

    const prefixSaveBtn = document.getElementById('ap-prefix-save');
    const prefixInput = document.getElementById('ap-prefix-input');
    if (prefixSaveBtn && prefixInput) {
        prefixSaveBtn.onclick = async () => {
            const prefix = prefixInput.value.trim();
            if (!prefix) { showToast('Präfix eingeben', 'error'); return; }
            const res = await fetch(`/api/bot/${botId}/prefix`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix })
            });
            const d = await res.json();
            if (d.success) showToast(`Präfix geändert zu "${prefix}" — Bot startet neu`, 'success');
            else showToast(d.error || 'Fehler', 'error');
        };
        prefixInput.onkeydown = (e) => { if (e.key === 'Enter') prefixSaveBtn.click(); };
    }
});

function renderWarnings(warnings) {
    const container = document.getElementById('warnings-list');

    if (!warnings.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-shield-halved"></i><p>Keine Warnungen vorhanden</p></div>';
        return;
    }

    container.innerHTML = warnings.map(w => {
        const jid = w.jid || '';
        const phone = jid.replace('@s.whatsapp.net', '').replace('@lid', '');
        const displayName = w.name || phone;
        return `
        <div class="warning-item">
            <div class="warning-icon">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="warning-info">
                <div class="warning-name">${escapeHtml(displayName)}</div>
                <div class="warning-reason">${escapeHtml(w.reason)}</div>
            </div>
            <div class="warning-count">${w.count}x</div>
        </div>`;
    }).join('');
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function controlBot(action) {
    const msg = document.getElementById('bot-control-message');
    const startBtn = document.getElementById('bot-start-btn');
    const stopBtn = document.getElementById('bot-stop-btn');
    const restartBtn = document.getElementById('bot-restart-btn');

    msg.textContent = '';
    msg.className = 'form-message';

    [startBtn, stopBtn, restartBtn].forEach(btn => btn.classList.add('loading'));

    try {
        let endpoint = `/api/bot/${botId}/${action}`;
        if (action === 'restart' && currentBotStatus === 'logged_out') {
            endpoint = `/api/bot/${botId}/reconnect`;
        }
        const res = await fetch(endpoint, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            msg.textContent = data.message || `Bot ${action === 'start' ? 'gestartet' : action === 'stop' ? 'gestoppt' : 'neu gestartet'}!`;
            msg.className = 'form-message success';
            pollBotStatus(action);
            if (action === 'restart' && currentBotStatus === 'logged_out') {
                pollQRCode();
            }
        } else {
            msg.textContent = data.error || 'Fehler';
            msg.className = 'form-message error';
        }
    } catch {
        msg.textContent = 'Verbindungsfehler';
        msg.className = 'form-message error';
    }

    [startBtn, stopBtn, restartBtn].forEach(btn => btn.classList.remove('loading'));
}

function pollBotStatus(action) {
    let attempts = 0;
    const maxAttempts = action === 'restart' && currentBotStatus === 'logged_out' ? 15 : 5;
    const delays = action === 'stop' ? [800, 1200, 1500, 2000, 3000] : [1500, 2000, 3000, 4000, 5000];

    function tryLoad() {
        loadData();
        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(tryLoad, delays[attempts] || 2000);
        }
    }
    setTimeout(tryLoad, delays[0]);
}

function pollQRCode() {
    const qrImg = document.getElementById('qr-image');
    const qrHint = document.getElementById('qr-hint');
    if (!qrImg) return;
    let attempts = 0;
    function tryQR() {
        attempts++;
        qrImg.src = `/api/bot/${botId}/qr?t=${Date.now()}`;
        qrImg.onload = function() {
            qrImg.style.display = '';
            if (qrHint) { qrHint.textContent = 'QR-Code mit WhatsApp scannen'; qrHint.style.display = ''; }
        };
        qrImg.onerror = function() {
            if (attempts < 20) {
                setTimeout(tryQR, 2000);
            } else {
                qrImg.style.display = 'none';
                if (qrHint) { qrHint.textContent = 'QR-Code wird noch generiert...'; qrHint.style.display = ''; }
            }
        };
    }
    setTimeout(tryQR, 3000);
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('mouseenter', () => SOUNDS.hover());
        item.addEventListener('click', (e) => {
            e.preventDefault();
            SOUNDS.nav();
            const tab = item.dataset.tab;

            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            const titles = {
                overview: 'Übersicht',
                users: 'Benutzer',
                groups: 'Gruppen',
                warnings: 'Warnungen',
                commands: 'Befehle',
                adminpanel: 'Admin-Panel',
                settings: 'Einstellungen',
                loginlog: 'Login-Log',
                bestellungen: 'Bestellungen'
            };
            document.getElementById('page-title').textContent = titles[tab] || tab;

            if (tab === 'loginlog') loadLoginLog();
            if (tab === 'registrierungen') loadRegistrierungen();
            if (tab === 'aniworld') loadAniWorldDownloads();
            if (tab === 'bestellungen') loadBestellungen('pending');
            if (tab === 'commands') loadCommands();
            if (tab === 'adminpanel') loadAdminPanel();

            if (window.innerWidth <= 768) closeSidebar();
        });
    });
}

function setupEvents() {
    document.querySelectorAll('button, .bot-card, .refresh-btn, .logout-btn, .settings-btn').forEach(el => {
        el.addEventListener('mouseenter', () => SOUNDS.hover());
        el.addEventListener('click', () => SOUNDS.click());
    });

    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('active');
    });

    document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

    document.getElementById('refresh-btn').addEventListener('click', loadData);

    document.getElementById('logout-btn').addEventListener('click', async () => {
        if (refreshInterval) clearInterval(refreshInterval);
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
    });

    document.getElementById('user-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#users-tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });

    document.getElementById('bot-start-btn').addEventListener('click', () => controlBot('start'));
    document.getElementById('bot-stop-btn').addEventListener('click', () => controlBot('stop'));
    document.getElementById('bot-restart-btn').addEventListener('click', () => controlBot('restart'));

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirm = document.getElementById('confirm-password').value;
        const msg = document.getElementById('password-message');
        const btn = e.target.querySelector('.settings-btn');

        msg.textContent = '';
        msg.className = 'form-message';

        if (!current || !newPass || !confirm) {
            msg.textContent = 'Alle Felder ausfüllen';
            msg.className = 'form-message error';
            return;
        }

        if (newPass !== confirm) {
            msg.textContent = 'Neue Passwörter stimmen nicht überein';
            msg.className = 'form-message error';
            return;
        }

        if (newPass.length < 6) {
            msg.textContent = 'Passwort muss mindestens 6 Zeichen haben';
            msg.className = 'form-message error';
            return;
        }

        btn.disabled = true;
        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: current, newPassword: newPass })
            });
            const data = await res.json();

            if (data.success) {
                msg.textContent = 'Passwort erfolgreich geändert!';
                msg.className = 'form-message success';
                document.getElementById('password-form').reset();
            } else {
                msg.textContent = data.error || 'Fehler beim Ändern';
                msg.className = 'form-message error';
            }
        } catch {
            msg.textContent = 'Verbindungsfehler';
            msg.className = 'form-message error';
        }
        btn.disabled = false;
    });
}

let pendingProfileFile = null;

function setupProfileUpload() {
    const area = document.getElementById('profile-upload-area');
    const input = document.getElementById('profile-file-input');
    const msg = document.getElementById('profile-upload-message');
    const preview = document.getElementById('profile-preview');
    const deleteBtn = document.getElementById('profile-delete-btn');
    const saveBtn = document.getElementById('profile-save-btn');

    area.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
        if (!input.files.length) return;
        const file = input.files[0];
        if (file.size > 5 * 1024 * 1024) {
            msg.textContent = 'Datei zu gross (max 5MB)';
            msg.className = 'form-message error';
            return;
        }
        pendingProfileFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Vorschau">`;
        };
        reader.readAsDataURL(file);
        saveBtn.style.display = 'flex';
        msg.textContent = 'Bild ausgewählt - auf Speichern drücken';
        msg.className = 'form-message';
    });

    saveBtn.addEventListener('click', async () => {
        if (!pendingProfileFile) return;
        const formData = new FormData();
        formData.append('profile', pendingProfileFile);
        try {
            const res = await fetch(`/api/bot/${botId}/profile`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                msg.textContent = 'Profilbild gespeichert!';
                msg.className = 'form-message success';
                saveBtn.style.display = 'none';
                pendingProfileFile = null;
                loadProfile();
                loadSidebarProfile(botId);
            } else {
                msg.textContent = data.error || 'Fehler';
                msg.className = 'form-message error';
            }
        } catch {
            msg.textContent = 'Verbindungsfehler';
            msg.className = 'form-message error';
        }
    });

    deleteBtn.addEventListener('click', async () => {
        try {
            await fetch(`/api/bot/${botId}/profile`, { method: 'DELETE' });
            preview.innerHTML = '<i class="fa-solid fa-user" id="profile-placeholder"></i>';
            deleteBtn.style.display = 'none';
            saveBtn.style.display = 'none';
            pendingProfileFile = null;
            msg.textContent = 'Profilbild entfernt';
            msg.className = 'form-message success';
            loadSidebarProfile(botId);
        } catch {
            msg.textContent = 'Fehler beim Entfernen';
            msg.className = 'form-message error';
        }
    });

    loadProfile();
}

async function loadProfile() {
    try {
        const res = await fetch(`/api/bot/${botId}/profile`);
        const data = await res.json();
        const preview = document.getElementById('profile-preview');
        const deleteBtn = document.getElementById('profile-delete-btn');
        if (data.exists) {
            preview.innerHTML = `<img src="${data.url}?t=${Date.now()}" alt="Profilbild">`;
            deleteBtn.style.display = 'flex';
        } else {
            preview.innerHTML = '<i class="fa-solid fa-user" id="profile-placeholder"></i>';
            deleteBtn.style.display = 'none';
        }
    } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
    createParticles();
    initCursorCanvas();
    setupNavigation();
    setupEvents();
    setupSoundToggle();
    setupVideoSoundToggle();
    setupBackgroundUpload();
    setupProfileUpload();
    setupKiChat();

    const ok = await checkSession();
    if (ok) {
        setupTransparencySliders();
        document.querySelector('.nav-item[data-tab="overview"]').click();
    }
});

// ========== KI ASSISTENT ==========
function setupKiChat() {
    const btn = document.getElementById('ki-assistant-btn');
    const overlay = document.getElementById('ki-chat-overlay');
    const input = document.getElementById('ki-chat-input');
    const sendBtn = document.getElementById('ki-chat-send');

    btn.addEventListener('click', () => {
        overlay.style.display = 'flex';
        input.focus();
    });

    sendBtn.addEventListener('click', sendKiMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendKiMessage();
        }
    });
}

function closeKiChat() {
    document.getElementById('ki-chat-overlay').style.display = 'none';
}

window.closeKiChat = closeKiChat;

async function sendKiMessage() {
    const input = document.getElementById('ki-chat-input');
    const messages = document.getElementById('ki-chat-messages');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    messages.innerHTML += `
        <div class="ki-chat-msg user">
            <div class="ki-chat-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="ki-chat-bubble">${escapeHtml(text)}</div>
        </div>`;

    const loadingId = 'loading-' + Date.now();
    messages.innerHTML += `
        <div class="ki-chat-msg bot" id="${loadingId}">
            <div class="ki-chat-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="ki-chat-bubble loading">Denke nach...</div>
        </div>`;
    messages.scrollTop = messages.scrollHeight;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        const el = document.getElementById(loadingId);
        if (el) {
            const reply = data.response || data.reply || data.message || data.content || data.error || 'Keine Antwort erhalten.';
            el.querySelector('.ki-chat-bubble').textContent = reply;
            el.querySelector('.ki-chat-bubble').classList.remove('loading');
        }
    } catch (e) {
        const el = document.getElementById(loadingId);
        if (el) {
            el.querySelector('.ki-chat-bubble').textContent = 'Fehler: ' + e.message;
            el.querySelector('.ki-chat-bubble').classList.remove('loading');
        }
    }

    messages.scrollTop = messages.scrollHeight;
}

// --- Bestellungen ---
let bestellungFilter = 'pending';

async function loadBestellungen(filter) {
    bestellungFilter = filter || 'pending';
    const container = document.getElementById('bestellungen-list');
    if (!container) return;

    document.querySelectorAll('.best-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === bestellungFilter);
    });

    try {
        const res = await fetch('/api/anime/all-subs');
        const data = await res.json();
        const allPending = data.pending || [];
        const allActive = data.active || [];

        const pending = allPending.filter(s => s.status === 'pending');
        const approved = allActive.filter(s => s.status === 'approved' || s.active === true);
        const rejected = [...allPending, ...allActive].filter(s => s.status === 'rejected');

        document.getElementById('best-pending-count').textContent = pending.length;
        document.getElementById('best-approved-count').textContent = approved.length;
        document.getElementById('best-rejected-count').textContent = rejected.length;
        document.getElementById('best-total-count').textContent = approved.length;

        let filtered;
        if (bestellungFilter === 'all') filtered = [...allPending, ...allActive];
        else if (bestellungFilter === 'approved') filtered = approved;
        else if (bestellungFilter === 'rejected') filtered = rejected;
        else filtered = pending;

        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Keine Bestellungen vorhanden</p></div>';
            return;
        }

        const tierColors = { basic: '#00d4aa', standard: '#7c5cff', premium: '#ff6b81' };
        const tierNames = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };
        const statusColors = { pending: '#ffd700', approved: '#00d4aa', rejected: '#ff4757', active: '#00d4aa', revoked: '#ff4757' };
        const statusNames = { pending: 'Ausstehend', approved: 'Genehmigt', rejected: 'Abgelehnt', active: 'Aktiv', revoked: 'Widerrufen' };

        container.innerHTML = `
            <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Nutzer</th>
                            <th>Tier</th>
                            <th>Status</th>
                            <th>Datum</th>
                            <th>Ablauf</th>
                            <th>Token</th>
                            <th>Aktion</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((s, i) => {
                            const tierColor = tierColors[s.tier] || '#00d4aa';
                            const tierName = tierNames[s.tier] || s.tier || '—';
                            const st = s.status || (s.active ? 'active' : 'unknown');
                            const stColor = statusColors[st] || '#999';
                            const stName = statusNames[st] || st;
                            const date = s.createdAt ? new Date(s.createdAt).toLocaleString('de-DE') : '—';
                            const expiry = s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('de-DE') : '—';

                            let actions = '';
                            if (st === 'pending') {
                                actions = `
                                    <button onclick="dashBestellApprove('${s.id}')" class="btn btn-sm" style="background:linear-gradient(135deg,#00d4aa,#00b894);color:#fff;margin-right:6px"><i class="fa-solid fa-check"></i> OK</button>
                                    <button onclick="dashBestellReject('${s.id}')" class="btn btn-sm" style="background:rgba(255,71,87,0.15);color:#ff4757;border:1px solid rgba(255,71,87,0.3)"><i class="fa-solid fa-times"></i> Nein</button>`;
                            } else if (st === 'approved' || st === 'active') {
                                if (s.cancelled) {
                                    actions = `<button onclick="dashBestellUncancel('${s.id}')" class="btn btn-sm" style="background:rgba(0,212,170,0.15);color:#00d4aa;border:1px solid rgba(0,212,170,0.3);margin-right:6px"><i class="fa-solid fa-rotate-right"></i></button>
                                    <button onclick="dashBestellRevoke('${s.id}')" class="btn btn-sm" style="background:rgba(255,71,87,0.1);color:#ff4757;border:1px solid rgba(255,71,87,0.2)"><i class="fa-solid fa-ban"></i></button>`;
                                } else {
                                    actions = `<button onclick="dashBestellCancel('${s.id}')" class="btn btn-sm" style="background:rgba(255,165,0,0.15);color:#ffa500;border:1px solid rgba(255,165,0,0.3);margin-right:6px"><i class="fa-solid fa-clock"></i></button>
                                    <button onclick="dashBestellRevoke('${s.id}')" class="btn btn-sm" style="background:rgba(255,71,87,0.1);color:#ff4757;border:1px solid rgba(255,71,87,0.2)"><i class="fa-solid fa-ban"></i></button>`;
                                }
                            }

                            const cancelledBadge = s.cancelled ? ' <span style="color:#ffa500;font-size:0.7rem;font-weight:600"><i class="fa-solid fa-clock"></i> Gekündigt</span>' : '';

                            return `<tr>
                                <td>${i + 1}</td>
                                <td style="font-weight:600">@${s.username}</td>
                                <td><span style="color:${tierColor};font-weight:600">${tierName}</span></td>
                                <td><span style="color:${stColor};font-weight:600">${stName}</span>${cancelledBadge}</td>
                                <td style="font-size:12px;color:var(--text-muted)">${date}</td>
                                <td style="font-size:12px;color:var(--text-muted)">${expiry}</td>
                                <td><code style="background:rgba(255,255,255,0.06);padding:3px 8px;border-radius:5px;font-size:11px">${s.token || '—'}</code></td>
                                <td>${actions}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch {
        container.innerHTML = '<p class="muted">Fehler beim Laden der Bestellungen</p>';
    }
}

async function dashBestellApprove(subId) {
    try {
        const res = await fetch('/api/anime/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subId }) });
        const data = await res.json();
        if (data.success) {
            showToast('Abo bestätigt! Token: ' + data.token);
            loadBestellungen(bestellungFilter);
        } else { showToast('Fehler: ' + data.error); }
    } catch { showToast('Verbindungsfehler'); }
}

async function dashBestellReject(subId) {
    try {
        const res = await fetch('/api/anime/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subId }) });
        const data = await res.json();
        if (data.success) {
            showToast('Abo abgelehnt');
            loadBestellungen(bestellungFilter);
        } else { showToast('Fehler: ' + data.error); }
    } catch { showToast('Verbindungsfehler'); }
}

async function dashBestellRevoke(subId) {
    if (!confirm('Token wirklich widerrufen?')) return;
    try {
        const res = await fetch('/api/anime/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subId }) });
        const data = await res.json();
        if (data.success) {
            showToast('Token widerrufen (@' + data.username + ')');
            loadBestellungen(bestellungFilter);
        } else { showToast('Fehler: ' + data.error); }
    } catch { showToast('Verbindungsfehler'); }
}

async function dashBestellCancel(subId) {
    if (!confirm('Abo kündigen? Es bleibt bis zum Ablauf aktiv.')) return;
    try {
        const res = await fetch('/api/anime/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subId }) });
        const data = await res.json();
        if (data.success) {
            showToast('Abo gekündigt (@' + data.username + ')');
            loadBestellungen(bestellungFilter);
        } else { showToast('Fehler: ' + data.error); }
    } catch { showToast('Verbindungsfehler'); }
}

async function dashBestellUncancel(subId) {
    try {
        const res = await fetch('/api/anime/uncancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subId }) });
        const data = await res.json();
        if (data.success) {
            showToast('Kündigung rückgängig gemacht (@' + data.username + ')');
            loadBestellungen(bestellungFilter);
        } else { showToast('Fehler: ' + data.error); }
    } catch { showToast('Verbindungsfehler'); }
}
