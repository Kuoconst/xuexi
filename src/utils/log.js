// utils/log.js - 详细日志系统

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;

    // 全局日志架构：
    // 各课程页面的 content script 通过 chrome.runtime.sendMessage 把日志汇聚到
    // background service worker，由 background 统一写入：
    // - 显示日志（DISPLAY）→ chrome.storage.session 的 xbDisplayLogs（上限 500，刷新保留、关浏览器清空）
    // - 详细日志（其他类别）→ chrome.storage.local 的 xbDetailLogs（上限 1000，持久可导出）
    // 这样所有课程页面与主页共享同一份日志视图；实时跨页同步完全依赖
    // background 广播的 LOG_APPEND 消息（仅 DISPLAY）。
    // 本文件内的 _displayLogs/_detailLogs/_stream 仅为本页会话的内存副本。
    const LOG_MODE_KEY = 'xbLogMode';

    XB.Log = {
        _displayLogs: [],
        _detailLogs: [],
        _stream: [],        // 统一渲染流：模式切换时据此全量重放面板
        _startTime: Date.now(),
        _logMode: 'simple',
        _lastRestoreFingerprint: null,   // 上次恢复时的全局日志指纹，用于"仅变化才重放"

        /**
         * 设置日志模式（持久化，刷新后保持用户选择）
         * 切换后立即按新模式全量重放：简洁↔详细可随时来回切换，
         * 已发生的历史不会丢，只是展示粒度不同
         */
        setMode(mode) {
            this._logMode = mode;
            try {
                chrome.storage.local.set({ [LOG_MODE_KEY]: mode });
            } catch (e) {}
            if (this._onRerender) {
                this._onRerender(this.buildReplay());
            }
        },

        /**
         * 按当前模式生成应显示的完整序列（用于切换模式时的原地升级重放）
         * 显示规则：简洁模式只保留重要条目（成功/警告/错误，着色展示），
         * info 白色过程日志与详细层条目仅详细模式显示
         */
        buildReplay() {
            const isDetail = this._logMode === 'detail';
            const important = t => t === 'success' || t === 'error' || t === 'warning';
            return this._stream
                .filter(e => e.kind === 'display'
                    ? (isDetail || important(e.type))
                    : isDetail)
                .map(e => e.kind === 'display'
                    ? { time: e.time, text: e.text, type: e.type }
                    : { time: e.time, text: `[${e.category}] ${e.message}`, type: 'info' });
        },

        /**
         * 恢复上次的日志模式
         */
        async restoreMode() {
            try {
                const result = await chrome.storage.local.get([LOG_MODE_KEY]);
                if (result[LOG_MODE_KEY]) this._logMode = result[LOG_MODE_KEY];
            } catch (e) {}
            return this._logMode;
        },

        /**
         * 获取当前模式
         */
        getMode() {
            return this._logMode;
        },

        /**
         * 显示层条目
         * 实时渲染规则与重放一致：简洁模式只上屏重要条目（success/error/warning 着色），
         * info 白色过程日志仅详细模式上屏；文件始终全量记录。
         * 仅发送 entry.c === 'DISPLAY' 的 LOG_APPEND 消息到 background。
         */
        display(text, type = 'info', uiLevel = null) {
            const entry = { text, type, time: Date.now(), uiLevel };
            this._displayLogs.push(entry);
            this._stream.push({ time: entry.time, kind: 'display', text, type, uiLevel });

            try {
                chrome.runtime.sendMessage({
                    type: 'LOG_APPEND',
                    entry: { t: entry.time, c: 'DISPLAY', m: text, d: { type, uiLevel }, u: window.location.href }
                }, () => { void chrome.runtime.lastError; });
            } catch (e) {}

            const important = type === 'success' || type === 'error' || type === 'warning';
            if ((important || this._logMode === 'detail') && this._onDisplay) {
                this._onDisplay({ text: entry.text, type: entry.type, time: entry.time });
            }
            return entry;
        },

        /**
         * 追加跨页同步的简洁日志（其他页面广播而来，经 background 转发）。
         * 与 display() 的区别：不写全局层（避免回环广播），仅写入本页内存与渲染流，
         * 供面板显示与模式切换重放，使所有页面面板保持一致的日志视图。
         */
        appendRemoteDisplay(text, type = 'info', time = Date.now()) {
            const entry = { text, type, time, uiLevel: null };
            this._displayLogs.push(entry);
            this._stream.push({ time: entry.time, kind: 'display', text, type, uiLevel: null });

            const important = type === 'success' || type === 'error' || type === 'warning';
            if ((important || this._logMode === 'detail') && this._onDisplay) {
                this._onDisplay({ text: entry.text, type: entry.type, time: entry.time });
            }
            return entry;
        },

        /**
         * 记录详细日志（导出用，始终全量记录与屏幕档位无关）
         * 仅发送 entry.c 为其他类别（非 'DISPLAY'）的 LOG_APPEND 消息到 background。
         * @param {boolean} alreadyDisplayed - 该条已在屏幕显示过时传 true，
         *                                     避免与 display 流重复
         */
        detail(category, message, data = null, alreadyDisplayed = false) {
            const now = Date.now();
            const entry = { time: now, category, message, data };
            this._detailLogs.push(entry);

            try {
                chrome.runtime.sendMessage({
                    type: 'LOG_APPEND',
                    entry: { t: now, c: category, m: message, d: data || null, u: window.location.href }
                }, () => { void chrome.runtime.lastError; });
            } catch (e) { /* 上下文失效等场景仅保留本页内存 */ }

            if (!alreadyDisplayed) {
                // 仅存在于详细层的条目进入渲染流：详细模式下实时显示并可重放
                this._stream.push({ time: now, kind: 'detail', category, message });
                if (this._logMode === 'detail' && this._onDisplay) {
                    this._onDisplay({ text: `[${category}] ${message}`, type: 'info', time: now });
                }
            }
            return entry;
        },

        /**
         * 发送 LOG_GET 消息拉取全局显示日志与最近详细日志
         * @returns {Promise<Object>} { success, displayLogs?, detailLogs?, error? }
         */
        _sendLogGet() {
            return new Promise((resolve) => {
                try {
                    chrome.runtime.sendMessage({ type: 'LOG_GET' }, (resp) => {
                        if (chrome.runtime.lastError) {
                            resolve({ success: false, error: chrome.runtime.lastError.message });
                            return;
                        }
                        resolve(resp || { success: false });
                    });
                } catch (e) {
                    resolve({ success: false, error: e.message });
                }
            });
        },

        /**
         * 用拉取到的全局日志覆盖本页内存并重建渲染流（可重复调用）。
         * 显示日志覆盖 _displayLogs 并全部进入 _stream；
         * 详细日志覆盖 _detailLogs，非重复条目进入 _stream。
         * 去重规则：详细条目与某显示条目"文本内容相同 且 时间戳相差不超过 1000ms"
         * 视为同一条日志，只保留显示条目，跳过详细中的重复条目。
         */
        _restoreFromPayload(displayLogs, detailLogs) {
            this._displayLogs = (displayLogs || []).map(e => ({
                time: e.t || Date.now(),
                text: e.m || '',
                type: (e.d && e.d.type) || 'info',
                uiLevel: (e.d && e.d.uiLevel) || null
            }));
            this._detailLogs = (detailLogs || []).map(e => ({
                time: e.t || Date.now(),
                category: e.c || 'RUN',
                message: e.m || '',
                data: e.d || null,
                url: e.u || null
            }));

            this._stream = [];
            this._displayLogs.forEach(d => {
                this._stream.push({ time: d.time, kind: 'display', text: d.text, type: d.type, uiLevel: d.uiLevel });
            });

            // 文本 -> 时间戳列表 索引，用于快速判断详细条目是否与显示条目重复
            const textIndex = new Map();
            this._displayLogs.forEach(d => {
                const arr = textIndex.get(d.text) || [];
                arr.push(d.time);
                textIndex.set(d.text, arr);
            });
            const isDuplicate = (text, time) => {
                const times = textIndex.get(text);
                if (!times) return false;
                return times.some(t => Math.abs(t - time) <= 1000);
            };

            this._detailLogs.forEach(e => {
                if (isDuplicate(e.message, e.time)) return;
                this._stream.push({ time: e.time, kind: 'detail', category: e.category, message: e.message });
            });
        },

        /**
         * 应用一次全局恢复：覆盖内存 -> 记录指纹 -> 触发一次 _onRerender 全量重放
         */
        _applyGlobalRestore(displayLogs, detailLogs) {
            this._restoreFromPayload(displayLogs, detailLogs);
            this._lastRestoreFingerprint = JSON.stringify([displayLogs, detailLogs]);
            if (this._onRerender) this._onRerender(this.buildReplay());
        },

        /**
         * 从全局日志恢复历史并全量重放（可重复调用）。
         * 通过 LOG_GET 获取 displayLogs（最多 500 条）与 detailLogs（最近 500 条），
         * 覆盖本页内存后触发一次 _onRerender 全量重放。
         * 失败则最多重试 3 次，每次间隔 1 秒。
         * @returns {Promise<boolean>} 恢复成功返回 true
         */
        async restoreHistoryLogs() {
            const MAX_ATTEMPTS = 4; // 首次尝试 + 失败后最多 3 次重试
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                const resp = await this._sendLogGet();
                if (resp && resp.success && Array.isArray(resp.displayLogs) && Array.isArray(resp.detailLogs)) {
                    this._applyGlobalRestore(resp.displayLogs, resp.detailLogs);
                    return true;
                }
                if (attempt >= MAX_ATTEMPTS) break;
                await new Promise(r => setTimeout(r, 1000));
            }
            return false;
        },

        /**
         * 仅当全局日志有变化时才重新恢复并全量重放。
         * 供页面可见性变化与周期性兜底同步使用，避免无变化时反复重放导致滚动跳动。
         * @returns {Promise<boolean>} 本次检测到变化并已重放返回 true
         */
        async restoreHistoryLogsIfChanged() {
            const resp = await this._sendLogGet();
            if (!resp || !resp.success || !Array.isArray(resp.displayLogs) || !Array.isArray(resp.detailLogs)) return false;
            const fingerprint = JSON.stringify([resp.displayLogs, resp.detailLogs]);
            if (fingerprint === this._lastRestoreFingerprint) return false;
            this._applyGlobalRestore(resp.displayLogs, resp.detailLogs);
            return true;
        },

        /**
         * 仅清空本页显示日志内存（不发送消息，供广播接收端使用，避免回环广播）
         */
        clearDisplayLocal() {
            this._displayLogs = [];
            this._stream = this._stream.filter(e => e.kind !== 'display');
        },

        /**
         * 清空显示日志：发送 LOG_CLEAR_DISPLAY 并清空本页显示日志与流中的 display 条目
         */
        clearDisplay() {
            this.clearDisplayLocal();
            try {
                chrome.runtime.sendMessage({ type: 'LOG_CLEAR_DISPLAY' }, () => { void chrome.runtime.lastError; });
            } catch (e) {}
        },

        /**
         * 仅清空本页详细日志内存（不发送消息）
         */
        clearDetailLocal() {
            this._detailLogs = [];
            this._stream = this._stream.filter(e => e.kind !== 'detail');
        },

        /**
         * 清空详细日志：发送 LOG_CLEAR_DETAIL 并清空本页详细日志与流中的 detail 条目
         */
        clearDetail() {
            this.clearDetailLocal();
            try {
                chrome.runtime.sendMessage({ type: 'LOG_CLEAR_DETAIL' }, () => { void chrome.runtime.lastError; });
            } catch (e) {}
        },

        /**
         * 彻底清空：发送 LOG_CLEAR_ALL 并清空本页所有日志内存
         */
        clearAll() {
            this._displayLogs = [];
            this._detailLogs = [];
            this._stream = [];
            this._startTime = Date.now();
            try {
                chrome.runtime.sendMessage({ type: 'LOG_CLEAR_ALL' }, () => { void chrome.runtime.lastError; });
            } catch (e) {}
        },

        /**
         * 按当前模式触发一次面板全量重放
         */
        rerenderNow() {
            if (this._onRerender) this._onRerender(this.buildReplay());
        },

        /**
         * 记录题目信息（仅详细层；简洁层由 fill 的答案行承担）
         */
        question(index, question) {
            this.detail('QUESTION', `第${index}题`, {
                index: index,
                type: question.type,
                title: question.title,
                options: question.options ? question.options.map(o => `${o.letter}. ${o.text}`) : [],
                questionId: question.questionId
            }, true);
        },

        /**
         * 记录 LLM 调用
         */
        llm(prompt, rawAnswer, parsedAnswer) {
            this.detail('LLM', 'API 调用', {
                prompt: prompt,
                rawAnswer: rawAnswer,
                parsedAnswer: parsedAnswer,
                promptLength: prompt.length,
                responseLength: rawAnswer.length
            });
        },

        /**
         * 记录字体解密结果
         * @param {number} totalReplacements 替换的文本节点数
         * @param {number} uniqueMappings 唯一映射字符数
         * @param {Array} decryptDetails [{char, replacement}] 加密字符合对
         */
        fontDecrypt(totalReplacements, uniqueMappings, decryptDetails) {
            // 直观格式："𥽾->是"，文件中保留前 300 组完整对照
            const pairs = (decryptDetails || [])
                .filter(d => d && d.char)
                .map(d => `${d.char}->${d.replacement}`);
            const seen = new Set();
            const uniquePairs = pairs.filter(p => !seen.has(p) && seen.add(p));

            this.detail('FONT', `字体解密：替换 ${totalReplacements} 处文本，唯一映射 ${uniqueMappings} 个，示例: ${uniquePairs.slice(0, 8).join(' ')}`, {
                mappings: uniquePairs.slice(0, 300),
                mappingCount: uniquePairs.length
            });
        },

        /**
         * 记录答案填入（简洁模式的核心行：第N题 [题型] 答案: X）
         */
        fill(index, typeName, answer, success) {
            this.detail('FILL', `第${index}题 [${typeName}] 填入答案: ${answer}`, {
                questionIndex: index,
                questionType: typeName,
                answer: answer,
                success: success
            }, true);
            if (success) {
                this.display(`第${index}题 [${typeName}] 答案: ${answer}`, 'success');
            } else {
                this.display(`第${index}题 [${typeName}] 填入失败`, 'error');
            }
        },

        /**
         * 记录系统事件
         */
        system(message, data = null) {
            this.detail('SYSTEM', message, data);
        },

        /**
         * 记录错误
         */
        error(category, message, error) {
            this.detail(category, `错误: ${message}`, {
                error: error.message || String(error),
                stack: error.stack || null
            }, true);
            this.display(`[${category}] ${message}`, 'error');
        },

        /**
         * 设置显示回调（单条实时渲染）
         */
        onDisplay(callback) {
            this._onDisplay = callback;
        },

        /**
         * 设置全量重放回调（模式切换时面板据此清屏重建）
         */
        onRerender(callback) {
            this._onRerender = callback;
        },

        /**
         * 生成导出的日志文本
         */
        exportText() {
            const now = new Date();
            const lines = [];

            // 各类别条目分布，方便快速判断哪些环节被记录了
            const catCounts = {};
            this._detailLogs.forEach(e => {
                catCounts[e.category] = (catCounts[e.category] || 0) + 1;
            });

            lines.push('========================================');
            lines.push('学习通Bot 运行日志（详细版）');
            lines.push(`导出时间: ${now.toLocaleString()}`);
            let manifestVersion = '未知';
            try { manifestVersion = chrome.runtime.getManifest().version || '未知'; } catch (e) {}
            lines.push(`版本: v${manifestVersion}`);
            lines.push(`运行时长: ${((Date.now() - this._startTime) / 1000).toFixed(1)}秒`);

            // 环境信息：排查问题时定位系统/浏览器/内核版本
            lines.push('-------- 环境信息 --------');
            try {
                lines.push(`页面URL: ${window.location.href}`);
                lines.push(`页面标题: ${document.title}`);
                lines.push(`UserAgent: ${navigator.userAgent}`);
                const uad = navigator.userAgentData;
                if (uad) {
                    lines.push(`系统平台: ${uad.platform}`);
                    const brands = (uad.brands || []).map(b => `${b.brand}/${b.version}`).join(', ');
                    if (brands) lines.push(`浏览器/内核: ${brands}`);
                }
                lines.push(`语言: ${navigator.language}`);
                if (navigator.hardwareConcurrency) lines.push(`CPU线程数: ${navigator.hardwareConcurrency}`);
                if (navigator.deviceMemory) lines.push(`设备内存: ${navigator.deviceMemory}GB`);
                lines.push(`屏幕: ${screen.width}x${screen.height} @DPR ${window.devicePixelRatio}`);
                lines.push(`扩展版本: ${(chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '未知'}`);
            } catch (e) {
                lines.push(`环境信息采集失败: ${e.message}`);
            }

            lines.push(`详细条目数: ${this._detailLogs.length}`);
            if (this._detailLogs.length > 0) {
                lines.push(`条目分布: ${Object.entries(catCounts).map(([k, v]) => `${k}×${v}`).join(', ')}`);
            } else {
                lines.push('（本次未记录到详细日志：请先运行答题/刷课任务后再导出）');
            }
            lines.push('========================================');
            lines.push('');

            // 详细日志（URL 变化时插入分段行，区分不同课程页面产生的记录）
            let lastUrl = null;
            this._detailLogs.forEach(entry => {
                if (entry.url && entry.url !== lastUrl) {
                    lastUrl = entry.url;
                    lines.push(`---- 页面: ${entry.url} ----`);
                }
                const time = new Date(entry.time).toLocaleTimeString();
                const ms = String(new Date(entry.time).getMilliseconds()).padStart(3, '0');
                lines.push(`[${time}.${ms}] [${entry.category}] ${entry.message}`);
                if (entry.data) {
                    const jsonStr = JSON.stringify(entry.data, null, 2);
                    lines.push('  ' + jsonStr.split('\n').join('\n  '));
                }
            });

            lines.push('');
            lines.push('========================================');
            lines.push('--- 简洁日志 ---');
            lines.push('========================================');
            lines.push('');

            // 简洁日志基于当前 _displayLogs；为空时仅输出段标题
            this._displayLogs.forEach(log => {
                const time = new Date(log.time).toLocaleTimeString();
                const ms = String(new Date(log.time).getMilliseconds()).padStart(3, '0');
                lines.push(`[${time}.${ms}] [${log.type.toUpperCase().padEnd(7)}] ${log.text}`);
            });

            return lines.join('\n');
        },

        /**
         * 下载日志文件（异步：先经 LOG_EXPORT 从 background 获取完整详细日志
         * （最多 1000 条、含其他课程页面、关闭浏览器后仍存在），再按原格式导出）
         */
        async download() {
            const resp = await new Promise((resolve) => {
                try {
                    chrome.runtime.sendMessage({ type: 'LOG_EXPORT' }, (r) => {
                        if (chrome.runtime.lastError) {
                            resolve({ success: false, error: chrome.runtime.lastError.message });
                            return;
                        }
                        resolve(r || { success: false });
                    });
                } catch (e) {
                    resolve({ success: false, error: e.message });
                }
            });

            if (resp && resp.success && Array.isArray(resp.detailLogs)) {
                this._detailLogs = resp.detailLogs.map(e => ({
                    time: e.t || Date.now(),
                    category: e.c || 'RUN',
                    message: e.m || '',
                    data: e.d || null,
                    url: e.u || null
                }));
            }

            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;

            const content = this.exportText();
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xuexitong-bot-log-${timestamp}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return this._detailLogs.length;
        }
    };
})();
