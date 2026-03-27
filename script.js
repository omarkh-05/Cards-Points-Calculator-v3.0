 /** * 1. CONFIGURATION MODULE
     * الثوابت والحدود والقيم الخاصة بالألعاب
     */
    const CONFIG = {
        KINGDOM_VALUES: { 'latsh': -15, 'dinari': -10, 'banat': -25, 'sheikh': -75 },
        COMPLEX_OPTIONS: [
            { id: 'latsh', name: 'لطوش' }, { id: 'dinari', name: 'ديناري' },
            { id: 'banat', name: 'بنات' }, { id: 'sheikh', name: 'شيخ كبة' }
        ],
        RANGE_LIMITS: {
            'latsh': { min: 0, max: 13, sum: 13, minTotal: 13 },
            'dinari': { min: 0, max: 13, sum: 13, minTotal: 13 },
            'banat': { min: 0, max: 8, sum: 8, minTotal: 4 },
            'sheikh': { min: 0, max: 2, sum: 2, minTotal: 1 },
            'trix': { min: 1, max: 4, sum: 10, minTotal: 10 },
            'tarneeb': { min: 0, max: 26, sum: 26, minTotal: 0 },
            'hand': { min: -60, max: 300, sum: 500, minTotal: -240 }
        },
        INITIAL_KINGDOMS: {
            trix: [
                { id: 'latsh', name: 'لطوش (-15)', val: -15 },
                { id: 'dinari', name: 'ديناري (-10)', val: -10 },
                { id: 'banat', name: 'بنات (-25)', val: -25 },
                { id: 'sheikh', name: 'شيخ كبة (-75)', val: -75 },
                { id: 'trix', name: 'تركس (مركز)', val: 'rank' }
            ],
            complex: [
                { id: 'complex', name: 'كومبليكس', val: 'complex' },
                { id: 'trix', name: 'تركس (مركز)', val: 'rank' }
            ]
        }
    };

    /**
     * 2. DATABASE MODULE (IndexedDB)
     * إدارة تخزين واسترجاع سجلات المباريات
     */
    const DB_MODULE = {
        db: null,
        init() {
            const request = indexedDB.open("ProCardGamesDB", 2);
            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                if (!this.db.objectStoreNames.contains("game_logs")) {
                    this.db.createObjectStore("game_logs", { keyPath: "id", autoIncrement: true });
                }
            };
            request.onsuccess = (e) => { this.db = e.target.result; };
        },
        saveGame(gameName, winnerName, winnerScore) {
            if (!this.db) return;
            const transaction = this.db.transaction(["game_logs"], "readwrite");
            const store = transaction.objectStore("game_logs");
            store.add({
                gameName, winnerName, winnerScore,
                date: new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            });
        },
        getLogs(callback) {
            if (!this.db) return;
            const transaction = this.db.transaction(["game_logs"], "readonly");
            const req = transaction.objectStore("game_logs").getAll();
            req.onsuccess = () => callback(req.result.reverse());
        }
    };

    /**
     * 3. VALIDATION MODULE
     * التحقق من سلامة البيانات المدخلة والمجموع
     */
    const VALIDATOR = {
        validateIndividual(val, targetKey) {
            const lim = CONFIG.RANGE_LIMITS[targetKey];
            if (!lim) return true;
            if (val > lim.max) return { ok: false, msg: `الحد الأقصى المسموح هو ${lim.max}` };
            if (val < lim.min) return { ok: false, msg: `الحد الأدنى المسموح هو ${lim.min}` };
            if (val === lim.min) return { ok: true };
            return { ok: true };
        },
        validateSum(total, targetKey) {
            const lim = CONFIG.RANGE_LIMITS[targetKey];
            if (!lim) return true;
            if (total > lim.sum) return { ok: false, msg: `المجموع لا يمكن أن يتجاوز ${lim.sum}. المجموع الحالي: ${total}` };
            if (total < lim.minTotal) return { ok: false, msg: `المجموع لا يمكن أن يقل عن ${lim.minTotal}. المجموع الحالي: ${total}` };
            return { ok: true };
        }
    };

    /**
     * 4. GAME ENGINE
     * منطق اللعبة الأساسي
     */
    const GAME_ENGINE = {
        state: { type: '', title: '', mode: 'normal', players: [], roundActive: false, availableKingdoms: [] },

        initGame(type, title) {
            this.state = { type, title, players: [], roundActive: false, mode: (type === 'tarneeb' ? 'team' : 'normal'), availableKingdoms: CONFIG.INITIAL_KINGDOMS[type] ? [...CONFIG.INITIAL_KINGDOMS[type]] : [] };
            UI_RENDERER.setupGameUI(title, type);
            this.setMode(this.state.mode, true);
            this.setupKingdoms();
            UI_RENDERER.renderPlayers();
            UI_RENDERER.updateRoundButton(false);
            UI_RENDERER.switchView('game');
        },

        setupKingdoms() {
            const section = document.getElementById('kingdom-section');
            const select = document.getElementById('kingdom-select');
            if (this.state.type === 'trix' || this.state.type === 'complex') {
                section.style.display = 'block';
                if (this.state.availableKingdoms.length === 0) this.state.availableKingdoms = [...CONFIG.INITIAL_KINGDOMS[this.state.type]];
                select.innerHTML = '';
                this.state.availableKingdoms.forEach(k => {
                    const opt = document.createElement('option'); opt.value = k.id; opt.innerText = k.name; select.appendChild(opt);
                });
            } else section.style.display = 'none';
        },

        addPlayer() {
            const input = document.getElementById('player-input');
            const name = input.value.trim();
            if (!name) return;
            if (this.state.mode === 'normal' && this.state.players.length >= 4) return UI_RENDERER.showSimpleModal("عفواً!", "الحد الأقصى هو 4 لاعبين.");
            if (this.state.mode === 'team' && this.state.players.length >= 2) return UI_RENDERER.showSimpleModal("عفواً!", "الحد الأقصى هو فريقين.");
            this.state.players.push({ id: Date.now(), name, score: 0, history: [], usedComplexOptions: [] });
            input.value = ''; UI_RENDERER.renderPlayers();
        },

        toggleRound() {
            if (this.state.players.length === 0) return UI_RENDERER.showSimpleModal("تنبيه ⚠️", "يرجى إضافة لاعبين قبل البدء.");
            this.state.roundActive = !this.state.roundActive;
            if (!this.state.roundActive) {
                const select = document.getElementById('kingdom-select');
                if (select?.value && (this.state.type === 'trix' || this.state.type === 'complex')) {
                    this.state.availableKingdoms = this.state.availableKingdoms.filter(k => k.id !== select.value);
                    this.setupKingdoms();
                }
                this.state.players.forEach(p => p.usedComplexOptions = []);
            }
            UI_RENDERER.updateRoundButton(this.state.roundActive);
            UI_RENDERER.renderPlayers();
        },

        addComplexScore(pid) {
            const input = document.getElementById(`in-${pid}`);
            const kSelect = document.getElementById(`k-select-${pid}`);
            const count = parseInt(input.value);
            const kType = kSelect.value;
            if (isNaN(count)) return;
            
            const check = VALIDATOR.validateIndividual(count, kType);
            if (!check.ok) return UI_RENDERER.showSimpleModal("خطأ ❌", check.msg);
            
            const player = this.state.players.find(x => x.id === pid);
            const change = count * CONFIG.KINGDOM_VALUES[kType];
            player.score += change; player.history.push(change);
            player.usedComplexOptions.push(kType);
            UI_RENDERER.renderPlayers();
        },

        submitAllScores() {
            const inputs = document.querySelectorAll('.bulk-input');
            const kType = document.getElementById('kingdom-select')?.value;
            let total = 0;
            const temp = [];

            for (let input of inputs) {
                const val = parseInt(input.value) || 0;
                total += val;
                temp.push({ pid: parseFloat(input.getAttribute('data-id')), val });
            }

            const target = (this.state.type === 'hand') ? 'hand' : (kType === 'trix' ? 'trix' : kType);
            const sumCheck = VALIDATOR.validateSum(total, target);
            if (!sumCheck.ok) return UI_RENDERER.showSimpleModal("خطأ في المجموع!", sumCheck.msg);

            for (let item of temp) {
                const indCheck = VALIDATOR.validateIndividual(item.val, target);
                if (!indCheck.ok) return UI_RENDERER.showSimpleModal("قيمة غير مسموحة!", indCheck.msg);
            }

            temp.forEach(item => {
                const p = this.state.players.find(x => x.id === item.pid);
                let change = item.val;
                if (this.state.type === 'trix' || this.state.type === 'complex') {
                    const kObj = CONFIG.INITIAL_KINGDOMS[this.state.type].find(k => k.id === kType);
                    if (kObj?.val === 'rank') change = {1:200, 2:150, 3:100, 4:50}[item.val] || 0;
                    else if (kObj?.val) change = item.val * kObj.val;
                }
                p.score += change; p.history.push(change);
            });
            UI_RENDERER.renderPlayers();
        },

        handleModeSwitch(newMode) {
            if (this.state.mode === newMode) return;
            if (this.state.players.length > 0) {
                UI_RENDERER.showConfirmModal("تغيير النظام؟", "سيتم تصفير اللاعبين الحاليين. هل تود الاستمرار؟", () => this.setMode(newMode));
            } else this.setMode(newMode);
        },

        setMode(m, skip = false) {
            this.state.mode = m;
            if (!skip) this.state.players = [];
            UI_RENDERER.updateModeButtons(m);
            UI_RENDERER.renderPlayers();
        },

        openTarneebCheatModal() {
            const options = this.state.players.map(p => ({
                label: p.name,
                action: () => { p.score -= 5; p.history.push(-5); UI_RENDERER.closeModal(); UI_RENDERER.renderPlayers(); }
            }));
            UI_RENDERER.showSelectionModal("من الفريق الغشاش؟ 🕵️‍♂️", "سيتم خصم 5 نقاط فورية.", options);
        },

        confirmEndGame() {
            UI_RENDERER.showConfirmModal("إغلاق اللعبة؟", "سيتم حفظ النتيجة النهائية في السجل والعودة للقائمة.", () => {
                if (this.state.players.length > 0) {
                    const sorted = [...this.state.players].sort((a,b) => b.score - a.score);
                    DB_MODULE.saveGame(this.state.title, sorted[0].name, sorted[0].score);
                }
                UI_RENDERER.switchView('home');
            });
        },

        confirmExit() { UI_RENDERER.switchView('home'); },
        
        showWinner() {
            if (!this.state.players.length) return;
            const winner = [...this.state.players].sort((a,b) => b.score - a.score)[0];
            UI_RENDERER.showSimpleModal("بطل الجولة الحالية 🏆", `البطل الحالي هو:\n\n✨ ${winner.name} ✨\nبرصيد ${winner.score} نقطة`);
        }
    };

    /**
     * 5. UI RENDERER MODULE
     * تحديث الواجهة والتعامل مع عناصر الـ DOM
     */
    const UI_RENDERER = {
        switchView(v) { document.querySelectorAll('.view').forEach(el => el.classList.remove('active')); document.getElementById(v + '-view').classList.add('active'); this.closeModal(); },
        
        closeModal() { document.getElementById('modal').style.display = 'none'; },

        setupGameUI(title, type) {
            document.getElementById('current-game-title').innerText = title;
            document.getElementById('mode-selector').style.display = (type === 'tarneeb') ? 'none' : 'block';
            document.getElementById('tarneeb-cheat-btn').style.display = (type === 'tarneeb') ? 'block' : 'none';
        },

        updateRoundButton(isActive) {
            const btn = document.getElementById('btn-round-control');
            btn.innerText = isActive ? "أنهِ الجولة الحالية 🏁" : "ابدأ جولة جديدة 🚀";
            btn.className = isActive ? "btn-main btn-end-round" : "btn-main btn-start";
        },

        updateModeButtons(m) {
            document.getElementById('mode-normal').classList.toggle('active', m === 'normal');
            document.getElementById('mode-team').classList.toggle('active', m === 'team');
        },

        renderPlayers() {
            const list = document.getElementById('players-list');
            list.innerHTML = '';
            const kingdomId = document.getElementById('kingdom-select')?.value;
            const isComplex = (GAME_ENGINE.state.type === 'complex' && kingdomId === 'complex');
            document.getElementById('bulk-action-container').style.display = (GAME_ENGINE.state.roundActive && !isComplex) ? 'block' : 'none';

            GAME_ENGINE.state.players.forEach(p => {
                const card = document.createElement('div');
                card.className = 'player-card';
                let historyHtml = p.history.length > 0 
                    ? p.history.map(h => `<span class="history-badge ${h >= 0 ? 'positive' : 'negative'}">${h >= 0 ? '+' : ''}${h}</span>`).join('')
                    : '<span class="empty-history">لا جولات</span>';

                let actionHtml = '';
                if (GAME_ENGINE.state.roundActive) {
                    if (isComplex) {
                        const avail = CONFIG.COMPLEX_OPTIONS.filter(opt => !p.usedComplexOptions.includes(opt.id));
                        actionHtml = avail.length > 0 ? `<div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;"><select id="k-select-${p.id}">${avail.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}</select><div style="display:flex; gap:8px;"><input type="number" id="in-${p.id}" placeholder="العدد..." inputmode="numeric"><button class="btn-individual" onclick="GAME_ENGINE.addComplexScore(${p.id})">أضف</button></div></div>` : '<div style="font-size:0.7rem; color:gray; text-align:center; margin-top:10px;">انتهت الخيارات</div>';
                    } else {
                        actionHtml = `<input type="number" class="bulk-input" data-id="${p.id}" placeholder="${kingdomId === 'trix' ? 'الترتيب (1-4)' : 'العدد...'}" inputmode="numeric" style="margin-top:10px; border-color:var(--primary-blue)">`;
                    }
                }
                card.innerHTML = `<div class="card-header"><span class="player-name-tag">${p.name}</span><span class="total-score ${p.score < 0 ? 'score-negative' : 'score-positive'}">${p.score}</span></div><div class="score-history">${historyHtml}</div>${actionHtml}`;
                list.appendChild(card);
            });
        },

        showLogsView() {
            this.switchView('logs');
            const list = document.getElementById('logs-list');
            list.innerHTML = '<p style="text-align:center;">جاري الجلب...</p>';
            DB_MODULE.getLogs(logs => {
                list.innerHTML = logs.length ? logs.map(l => `<div class="log-card"><div class="log-grid"><div class="log-game-name">${l.gameName}</div><div class="log-score">${l.winnerScore}</div><div class="log-winner">🏆 البطل: ${l.winnerName}</div><div class="log-date">${l.date}</div></div></div>`).join('') : '<p style="text-align:center; color:gray;">لا يوجد سجل</p>';
            });
        },

        showSimpleModal(t, b) {
            const m = document.getElementById('modal');
            document.getElementById('modal-title').innerText = t;
            document.getElementById('modal-body').innerText = b;
            document.getElementById('modal-selection').innerHTML = '';
            document.getElementById('modal-btns').innerHTML = `<button onclick="UI_RENDERER.closeModal()" class="btn-main btn-start" style="margin:0">حسناً</button>`;
            m.style.display = 'flex';
        },

        showConfirmModal(t, b, onConfirm) {
            const m = document.getElementById('modal');
            document.getElementById('modal-title').innerText = t;
            document.getElementById('modal-body').innerText = b;
            document.getElementById('modal-selection').innerHTML = '';
            document.getElementById('modal-btns').innerHTML = `<button onclick="UI_RENDERER.closeModal()" style="flex:1; background:#334155; border:none; color:white; border-radius:12px; padding:15px;">إلغاء</button><button id="modal-confirm-btn" style="flex:1; background:var(--primary-blue); color:white; border:none; border-radius:12px; padding:15px;">نعم</button>`;
            document.getElementById('modal-confirm-btn').onclick = () => { onConfirm(); this.closeModal(); };
            m.style.display = 'flex';
        },

        showSelectionModal(t, b, options) {
            const m = document.getElementById('modal');
            document.getElementById('modal-title').innerText = t;
            document.getElementById('modal-body').innerText = b;
            const sel = document.getElementById('modal-selection');
            sel.innerHTML = '';
            options.forEach(opt => {
                const btn = document.createElement('div');
                btn.className = 'selection-btn'; btn.innerText = opt.label; btn.onclick = opt.action;
                sel.appendChild(btn);
            });
            document.getElementById('modal-btns').innerHTML = `<button onclick="UI_RENDERER.closeModal()" style="width:100%; background:#444; border:none; color:white; border-radius:12px; padding:15px;">إغاء</button>`;
            m.style.display = 'flex';
        }
    };

    // التشغيل عند تحميل الصفحة
    window.onload = () => { DB_MODULE.init(); };