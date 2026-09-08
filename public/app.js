(() => {
    const splashTitle = "NEROX X CZEIO X MISSY";
    const pageTitle = "NEROX X CZEIO X MISSY";
    const splashTitleEl = document.getElementById("splash-title");
    const splash = document.getElementById("splash");
    const page = document.getElementById("page");
    let currentBot = null;

    // SPLASH: Buchstabe fuer Buchstabe einblenden mit Glow
    let splashChars = [];
    function animateSplashTitle(i) {
        if (i <= splashTitle.length) {
            const span = document.createElement("span");
            span.className = "splash-char";
            span.textContent = splashTitle[i] === " " ? "\u00A0" : splashTitle[i];
            span.style.animationDelay = (i * 0.06) + "s";
            splashTitleEl.appendChild(span);
            splashChars.push(span);
            setTimeout(() => animateSplashTitle(i + 1), 60);
        } else {
            // Glow-Welle nach dem letzten Buchstaben
            setTimeout(() => {
                splashChars.forEach((ch, idx) => {
                    setTimeout(() => ch.classList.add("glow"), idx * 50);
                });
            }, 300);
        }
    }
    animateSplashTitle(0);

    // Splash nach 3.5s ausblenden
    setTimeout(() => {
        splash.classList.add("hidden");
        page.classList.add("visible");
        setTimeout(animatePageTitle, 200);
        setTimeout(triggerCardShimmer, 400);
    }, 3500);

    // PAGE TITLE: Buchstaben nacheinander einblenden
    function animatePageTitle() {
        const titleEl = document.querySelector(".title");
        titleEl.innerHTML = "";
        for (let i = 0; i < pageTitle.length; i++) {
            const span = document.createElement("span");
            span.className = "char";
            span.textContent = pageTitle[i] === " " ? "\u00A0" : pageTitle[i];
            span.style.animationDelay = (i * 0.04) + "s";
            titleEl.appendChild(span);
        }
    }

    // CARD SHIMMER: Einmaliger Schimmer über beide Karten
    function triggerCardShimmer() {
        const cards = document.querySelectorAll(".bot-card");
        cards.forEach((card, i) => {
            setTimeout(() => card.classList.add("loaded"), i * 200);
        });
    }

    // Enter-Taste im Login-Modal
    document.getElementById("login-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
    });

    window.openLogin = function (bot) {
        if (bot === 'anime') {
            window.location.href = '/anime-login';
            return;
        }
        currentBot = bot;
        const modal = document.getElementById("login-modal");
        const modalContent = document.getElementById("modal-content");
        modal.classList.remove("hidden");
        
        {
            modalContent.classList.remove("anime-modal");
            const botNames = { czeio: "CZEIO" };
            document.getElementById("modal-title").textContent = botNames[bot] || bot;
            document.getElementById("modal-desc").textContent = "Bot-Panel Zugang";
            document.getElementById("modal-icon-fallback").className = "fa-solid fa-user";
            clearModalParticles();
        }
        document.getElementById("login-password").value = "";
        document.getElementById("login-error").textContent = "";
        document.getElementById("login-password").focus();

        // Profilbild laden
        const img = document.getElementById("modal-icon-img");
        const fallback = document.getElementById("modal-icon-fallback");
        fetch(`/api/bot/${bot}/profile`).then(r => r.json()).then(data => {
            if (data.exists) {
                img.src = data.url + '?t=' + Date.now();
                img.style.display = '';
                fallback.style.display = 'none';
            } else {
                img.style.display = 'none';
                fallback.style.display = '';
            }
        }).catch(() => {
            img.style.display = 'none';
            fallback.style.display = '';
        });
    };

    window.closeLogin = function () {
        document.getElementById("login-modal").classList.add("hidden");
        document.getElementById("modal-content").classList.remove("anime-modal");
        clearModalParticles();
        currentBot = null;
    };

    // Anime Particles
    function spawnParticles(container, count) {
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'anime-particle';
            const colors = ['#ff4757', '#7c5cff', '#00d4aa', '#ff6b81', '#a78bfa'];
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDelay = (Math.random() * 4) + 's';
            p.style.animationDuration = (3 + Math.random() * 3) + 's';
            container.appendChild(p);
        }
    }

    function spawnModalParticles() {
        const container = document.getElementById('modal-particles');
        if (!container) return;
        container.innerHTML = '';
        spawnParticles(container, 15);
    }

    function clearModalParticles() {
        const container = document.getElementById('modal-particles');
        if (container) container.innerHTML = '';
    }

    // Init anime card particles
    setTimeout(() => {
        const ap = document.getElementById('anime-particles');
        if (ap) spawnParticles(ap, 12);
    }, 2500);

    window.togglePass = function () {
        const input = document.getElementById("login-password");
        const icon = document.getElementById("eye-icon");
        const isPass = input.type === "password";
        input.type = isPass ? "text" : "password";
        icon.className = isPass ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    };

    window.doLogin = async function () {
        const pass = document.getElementById("login-password").value;
        const errEl = document.getElementById("login-error");
        const btn = document.getElementById("login-btn");
        const btnText = btn.querySelector(".btn-text");
        const btnLoader = btn.querySelector(".btn-loader");

        errEl.textContent = "";

        if (!pass) {
            errEl.textContent = "Bitte Passwort eingeben";
            return;
        }

        btnText.classList.add("hidden");
        btnLoader.classList.remove("hidden");
        btn.disabled = true;

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bot: currentBot, password: pass }),
            });
            const data = await res.json();

            if (data.success) {
                if (currentBot === 'anime') {
                    // Anime-Token speichern
                    localStorage.setItem('anime_token', pass);
                    localStorage.setItem('anime_user', data.username || 'User');
                    window.location.href = '/anime.html';
                } else {
                    window.location.href = `/dashboard?bot=${currentBot}`;
                }
            } else {
                errEl.textContent = data.error || "Falsches Passwort";
                btn.disabled = false;
                btnText.classList.remove("hidden");
                btnLoader.classList.add("hidden");
            }
        } catch {
            errEl.textContent = "Verbindungsfehler";
            btn.disabled = false;
            btnText.classList.remove("hidden");
            btnLoader.classList.add("hidden");
        }
    };

    window.closeModal = function (e) {
        if (e.target.id === "login-modal") closeLogin();
    };

    // Profile bilder laden
    async function loadProfiles() {
        for (const bot of ['czeio']) {
            try {
                const res = await fetch(`/api/bot/${bot}/profile`);
                const data = await res.json();
                const avatar = document.getElementById(`avatar-${bot}`);
                if (data.exists && avatar) {
                    avatar.innerHTML = `<img src="${data.url}?t=${Date.now()}" alt="${bot}">`;
                }
            } catch {}
        }
    }
    loadProfiles();

    // Video Sound Toggle
    const video = document.getElementById('login-bg-video');
    const soundBtn = document.getElementById('login-sound-btn');
    const soundIcon = document.getElementById('login-sound-icon');
    let videoMuted = true;

    soundBtn.addEventListener('click', () => {
        videoMuted = !videoMuted;
        video.muted = videoMuted;
        soundIcon.className = videoMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
        soundBtn.classList.toggle('active', !videoMuted);
    });
})();
