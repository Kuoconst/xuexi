// background.js - 后台服务脚本（ES Module）
// 负责：1. 中转 API 请求  2. 消息转发  3. 全局日志汇聚（显示/详细分库存储）

// ============================================================
// 全局日志汇聚层
// 各课程页面的 content script 把日志发到这里统一写入。
// - 显示日志（entry.c === 'DISPLAY'）：chrome.storage.session 的 xbDisplayLogs
//   （会话级，刷新保留、浏览器关闭后清空，上限 500 条）
// - 详细日志（entry.c 为其他类别）：chrome.storage.local 的 xbDetailLogs
//   （持久化，浏览器关闭后仍可导出，上限 1000 条）
// 通过两个 Promise 写队列串行处理追加，避免并发读改写互相覆盖。
// ============================================================
const DISPLAY_LOG_KEY = 'xbDisplayLogs';
const DETAIL_LOG_KEY = 'xbDetailLogs';
const DISPLAY_LOG_MAX = 500;       // 显示日志滚动保留上限
const DETAIL_LOG_MAX = 1000;       // 详细日志滚动保留上限
const DETAIL_RECENT = 500;         // LOG_GET 返回给面板恢复的最近详细条数
const BROADCAST_URLS = ['*://*.chaoxing.com/*', '*://*.xuexitong.com/*'];

// 思考档位 -> 输出 token 上限：思考内容计入输出预算，高档位需放宽避免答案被截断
const EFFORT_MAX_TOKENS = { none: 2000, low: 2000, high: 4096, max: 8192 };

// 显示日志 / 详细日志各自的串行写队列（Promise 链），
// 追加、清空操作都挂到对应队列尾部，保证顺序与不丢更新
let displayLogWriteQueue = Promise.resolve();
let detailLogWriteQueue = Promise.resolve();

/**
 * 读取指定存储区域中的数组（不存在或非法时返回空数组）
 */
function readList(area, key) {
    return chrome.storage[area].get([key]).then(result =>
        Array.isArray(result[key]) ? result[key] : []
    );
}

/**
 * 追加一条日志到存储数组：读 -> push -> 裁剪到上限 -> 写回
 */
function appendEntry(area, key, entry, max) {
    return readList(area, key).then(list => {
        list.push({
            t: entry.t || Date.now(),
            c: entry.c || 'RUN',
            m: entry.m || '',
            d: entry.d || null,
            u: entry.u || null
        });
        if (list.length > max) list.splice(0, list.length - max);
        return chrome.storage[area].set({ [key]: list });
    });
}

/**
 * 显示日志追加入队。返回真实 task（调用方可见成功/失败），
 * 队列尾部另存一个吞错分支，保证单个失败不会让后续任务断链。
 */
function enqueueDisplayAppend(entry) {
    const task = displayLogWriteQueue.then(() =>
        appendEntry('session', DISPLAY_LOG_KEY, entry, DISPLAY_LOG_MAX)
    );
    displayLogWriteQueue = task.catch(() => {});
    return task;
}

/**
 * 详细日志追加入队（同上）
 */
function enqueueDetailAppend(entry) {
    const task = detailLogWriteQueue.then(() =>
        appendEntry('local', DETAIL_LOG_KEY, entry, DETAIL_LOG_MAX)
    );
    detailLogWriteQueue = task.catch(() => {});
    return task;
}

/**
 * 实时跨页同步：将新增的简洁日志（DISPLAY 类目）广播给其他已打开的课程标签页。
 * 仅同步 DISPLAY（面板/简洁日志），详细日志量大，由刷新/恢复时的快照可见。
 * 使用 url 过滤查询，无需额外 "tabs" 权限；广播时排除来源标签页，避免本页重复渲染。
 */
function broadcastLogAppend(entry, sender) {
    if (!entry || entry.c !== 'DISPLAY') return;
    const senderTabId = sender && sender.tab ? sender.tab.id : null;
    try {
        chrome.tabs.query({ url: BROADCAST_URLS }, (tabs) => {
            for (const tab of tabs) {
                if (tab.id === senderTabId) continue;
                try {
                    chrome.tabs.sendMessage(tab.id, { type: 'LOG_APPEND', entry });
                } catch (e) {}
            }
        });
    } catch (e) {}
}

/**
 * 显示日志清空广播：通知所有已打开的课程标签页清空各自面板显示日志（排除来源标签页）。
 * 来源页由发起方自己完成本页清空，这里只负责同步其他页面。
 */
function broadcastLogClear(sender) {
    const senderTabId = sender && sender.tab ? sender.tab.id : null;
    try {
        chrome.tabs.query({ url: BROADCAST_URLS }, (tabs) => {
            for (const tab of tabs) {
                if (tab.id === senderTabId) continue;
                try {
                    chrome.tabs.sendMessage(tab.id, { type: 'LOG_CLEAR_DISPLAY' });
                } catch (e) {}
            }
        });
    } catch (e) {}
}

// 消息转发：content -> popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 全局日志追加：按 entry.c 类型路由进对应写队列
    if (message.type === 'LOG_APPEND') {
        const entry = message.entry || {};
        const isDisplay = entry.c === 'DISPLAY';
        const task = isDisplay ? enqueueDisplayAppend(entry) : enqueueDetailAppend(entry);
        task
            .then(() => {
                try { sendResponse({ success: true }); } catch (e) {}
                // 持久化成功后再广播，保证各面板与存储一致
                if (isDisplay) broadcastLogAppend(entry, sender);
            })
            .catch(error => {
                try { sendResponse({ success: false, error: error.message }); } catch (e) {}
            });
        return true; // 异步响应
    }

    // 拉取全局日志：等待两个队列排空后读取，供面板恢复使用
    if (message.type === 'LOG_GET') {
        Promise.all([displayLogWriteQueue, detailLogWriteQueue])
            .then(async () => {
                const [displayRes, detailRes] = await Promise.all([
                    chrome.storage.session.get([DISPLAY_LOG_KEY]),
                    chrome.storage.local.get([DETAIL_LOG_KEY])
                ]);
                const displayLogs = Array.isArray(displayRes[DISPLAY_LOG_KEY]) ? displayRes[DISPLAY_LOG_KEY] : [];
                const detailLogs = Array.isArray(detailRes[DETAIL_LOG_KEY]) ? detailRes[DETAIL_LOG_KEY] : [];
                try {
                    sendResponse({
                        success: true,
                        displayLogs,                                     // 完整显示数组（最多 500 条）
                        detailLogs: detailLogs.slice(-DETAIL_RECENT)      // 最近 500 条详细数组
                    });
                } catch (e) {}
            })
            .catch(error => {
                try { sendResponse({ success: false, error: error.message }); } catch (e) {}
            });
        return true; // 异步响应
    }

    // 导出完整详细日志（最多 1000 条，关闭浏览器后仍存在）
    if (message.type === 'LOG_EXPORT') {
        detailLogWriteQueue
            .then(async () => {
                const res = await chrome.storage.local.get([DETAIL_LOG_KEY]);
                const detailLogs = Array.isArray(res[DETAIL_LOG_KEY]) ? res[DETAIL_LOG_KEY] : [];
                try { sendResponse({ success: true, detailLogs }); } catch (e) {}
            })
            .catch(error => {
                try { sendResponse({ success: false, error: error.message }); } catch (e) {}
            });
        return true; // 异步响应
    }

    // 仅清空显示日志（session），并广播通知其他页面清空显示视图
    if (message.type === 'LOG_CLEAR_DISPLAY') {
        const task = displayLogWriteQueue.then(() =>
            chrome.storage.session.set({ [DISPLAY_LOG_KEY]: [] })
        );
        displayLogWriteQueue = task.catch(() => {});
        task
            .then(() => { try { sendResponse({ success: true }); } catch (e) {} })
            .catch(error => { try { sendResponse({ success: false, error: error.message }); } catch (e) {} });
        broadcastLogClear(sender);
        return true; // 异步响应
    }

    // 仅清空详细日志（local）
    if (message.type === 'LOG_CLEAR_DETAIL') {
        const task = detailLogWriteQueue.then(() =>
            chrome.storage.local.set({ [DETAIL_LOG_KEY]: [] })
        );
        detailLogWriteQueue = task.catch(() => {});
        task
            .then(() => { try { sendResponse({ success: true }); } catch (e) {} })
            .catch(error => { try { sendResponse({ success: false, error: error.message }); } catch (e) {} });
        return true; // 异步响应
    }

    // 同时清空显示与详细日志，并广播通知其他页面清空显示视图
    if (message.type === 'LOG_CLEAR_ALL') {
        const displayTask = displayLogWriteQueue.then(() =>
            chrome.storage.session.set({ [DISPLAY_LOG_KEY]: [] })
        );
        const detailTask = detailLogWriteQueue.then(() =>
            chrome.storage.local.set({ [DETAIL_LOG_KEY]: [] })
        );
        displayLogWriteQueue = displayTask.catch(() => {});
        detailLogWriteQueue = detailTask.catch(() => {});
        Promise.all([displayTask, detailTask])
            .then(() => { try { sendResponse({ success: true }); } catch (e) {} })
            .catch(error => { try { sendResponse({ success: false, error: error.message }); } catch (e) {} });
        broadcastLogClear(sender);
        return true; // 异步响应
    }

    // API 调用请求：在 background 中执行 fetch
    if (message.type === 'API_CALL') {
        handleApiCall(message)
            .then(result => {
                // 先 sendResponse 正常关闭消息通道，否则 Chrome 报
                // "message channel closed before a response was received"
                try {
                    sendResponse({ type: 'API_RESPONSE', requestId: message.requestId, success: true, data: result });
                } catch (e) {}
                // 再经 tabs.sendMessage 推送，content 侧 AIClient 通过 onMessage 接收真实结果
                if (sender.tab && sender.tab.id) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'API_RESPONSE',
                        requestId: message.requestId,
                        success: true,
                        data: result
                    });
                }
            })
            .catch(error => {
                try {
                    sendResponse({ type: 'API_RESPONSE', requestId: message.requestId, success: false, error: error.message });
                } catch (e) {}
                if (sender.tab && sender.tab.id) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'API_RESPONSE',
                        requestId: message.requestId,
                        success: false,
                        error: error.message
                    });
                }
            });
        return true; // 异步响应
    }

    // 获取模型列表请求
    if (message.type === 'FETCH_MODELS') {
        handleFetchModels(message)
            .then(result => {
                try {
                    sendResponse({ type: 'FETCH_MODELS_RESPONSE', requestId: message.requestId, success: true, data: result });
                } catch (e) {}
                if (sender.tab && sender.tab.id) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'FETCH_MODELS_RESPONSE',
                        requestId: message.requestId,
                        success: true,
                        data: result
                    });
                }
            })
            .catch(error => {
                try {
                    sendResponse({ type: 'FETCH_MODELS_RESPONSE', requestId: message.requestId, success: false, error: error.message });
                } catch (e) {}
                if (sender.tab && sender.tab.id) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'FETCH_MODELS_RESPONSE',
                        requestId: message.requestId,
                        success: false,
                        error: error.message
                    });
                }
            });
        return true; // 异步响应
    }

    // 其他消息（log/progress/finished 等单向广播）：无需响应，
    // 返回 false 让通道立即关闭，避免 "channel closed" 报错刷屏
    return false;
});

/**
 * 归一化 OpenAI 兼容接口地址：
 * 去尾部斜杠和 /chat/completions 后缀（兼容旧版配置直接填完整地址的情况）
 */
function normalizeBaseUrl(u) {
    return (u || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
}

/**
 * 处理 API 调用（在 service worker 中执行 fetch）
 */
async function handleApiCall(message) {
    const { config, prompt } = message;

    // 构建请求 URL
    const url = config.type === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : `${normalizeBaseUrl(config.url)}/chat/completions`;

    // 思考等级：none（不思考）/ low / high / max
    const effort = String(config.reasoningEffort || 'none').toLowerCase();

    // DeepSeek V4 深度适配（官方规范）：思考模式默认打开且 effort 默认为 high，
    // 因此"不思考"必须显式发送开关关闭；强度控制走 OpenAI 格式 reasoning_effort
    //（low/high/max 直传，服务端自行映射：low->low, high->xhigh, max->max）
    const body = {
        model: config.model,
        messages: [{
            role: 'user',
            content: prompt
        }],
        temperature: 0.1,
        max_tokens: EFFORT_MAX_TOKENS[effort] || 2000
    };
    if (config.type === 'deepseek') {
        if (effort === 'none') {
            body.thinking = { type: 'disabled' };
        } else {
            body.reasoning_effort = effort;
        }
    } else if (effort !== 'none') {
        // OpenAI 兼容自定义端点：统一走 reasoning_effort，"不思考"省略字段
        //（是否支持由服务商决定，面板已在选择非不思考档位时给出提示）
        body.reasoning_effort = effort;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

/**
 * 处理获取模型列表请求
 */
async function handleFetchModels(message) {
    const { config } = message;

    let url;
    if (config.type === 'deepseek') {
        url = 'https://api.deepseek.com/v1/models';
    } else {
        const base = normalizeBaseUrl(config.url);
        // 用户填的地址可能带或不带 /v1 前缀，避免拼出 /v1/v1/models
        url = /\/v1$/.test(base) ? `${base}/models` : `${base}/v1/models`;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${config.key}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取模型失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data || data.models || [];
}

// 插件安装事件
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[Background] 学习通bot已安装');
    } else if (details.reason === 'update') {
        console.log('[Background] 学习通bot已更新');
    }
});
