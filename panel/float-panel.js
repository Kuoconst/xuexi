// float-panel.js - 悬浮窗面板（完整版：拖动 + 智能定位）

(function() {
    'use strict';

    if (window.__xuexitongBotPanel) return;
    window.__xuexitongBotPanel = true;

    const XB = window.XuexitongBot;

    // 思考等级四档：滑条下标 0~3，none 表示不思考
    const EFFORT_LEVELS = ['不思考', 'Low', 'High', 'Max'];
    const EFFORT_KEYS = ['none', 'low', 'high', 'max'];

    // ========== 样式 ==========
    const style = document.createElement('style');
    style.textContent = `
        /* 统一盒模型：防止 padding/border 把 width:100% 的输入框撑出面板 */
        .xb-panel, .xb-panel *, .xb-restore-btn, .xb-restore-btn * {
            box-sizing: border-box;
        }

        :root {
            --xb-primary: #6366f1;
            --xb-primary-light: #818cf8;
            --xb-primary-dark: #4f46e5;
            --xb-success: #10b981;
            --xb-warning: #f59e0b;
            --xb-error: #ef4444;
            --xb-info: #3b82f6;
            --xb-bg: rgba(15, 23, 42, 0.95);
            --xb-bg-card: rgba(255, 255, 255, 0.06);
            --xb-bg-hover: rgba(255, 255, 255, 0.1);
            --xb-border: rgba(255, 255, 255, 0.1);
            --xb-text: #f1f5f9;
            --xb-text-secondary: #94a3b8;
            --xb-text-muted: #64748b;
            --xb-radius: 14px;
            --xb-radius-sm: 10px;
            --xb-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .xb-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 340px;
            background: var(--xb-bg);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--xb-border);
            border-radius: var(--xb-radius);
            box-shadow: var(--xb-shadow);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: var(--xb-text);
            user-select: none;
            -webkit-user-select: none;
            overflow: hidden;
            /* 阻止滚轮/触摸滚动穿透到底层网页 */
            overscroll-behavior: contain;
        }

        .xb-panel.xb-hidden { display: none; }

        .xb-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--xb-border);
            background: rgba(255, 255, 255, 0.03);
            cursor: move;
            border-radius: var(--xb-radius) var(--xb-radius) 0 0;
        }

        .xb-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .xb-logo {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--xb-primary), var(--xb-primary-light));
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: white;
        }

        .xb-title { font-size: 14px; font-weight: 600; }
        .xb-version { font-size: 10px; color: var(--xb-text-muted); background: var(--xb-bg-card); padding: 1px 6px; border-radius: 10px; margin-left: 4px; }

        .xb-header-btns { display: flex; gap: 4px; }

        .xb-icon-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: var(--xb-bg-card);
            border-radius: 6px;
            color: var(--xb-text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s;
        }

        .xb-icon-btn:hover { background: var(--xb-bg-hover); color: var(--xb-text); }
        .xb-icon-btn.close:hover { background: rgba(239, 68, 68, 0.15); color: var(--xb-error); }

        #xbBtnBack { display: none; }
        #xbBtnBack.visible { display: flex; }

        /* 内容区域 */
        .xb-content {
            padding: 14px;
            height: var(--view-height, 400px);
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
            /* 滚动到顶/底时不再把滚动传递给底层网页 */
            overscroll-behavior: contain;
        }
        .xb-content::-webkit-scrollbar { width: 4px; }
        .xb-content::-webkit-scrollbar-thumb { background: var(--xb-border); border-radius: 2px; }

        .xb-api-card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: var(--xb-bg-card);
            border-radius: var(--xb-radius-sm);
            border: 1px solid var(--xb-border);
            margin-bottom: 14px;
        }

        .xb-api-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--xb-text-muted); }
        .xb-api-dot.active { background: var(--xb-success); box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
        .xb-api-info { flex: 1; min-width: 0; }
        .xb-api-name { font-size: 13px; font-weight: 500; }
        .xb-api-model { font-size: 11px; color: var(--xb-text-muted); }

        .xb-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }

        .xb-btn {
            padding: 12px;
            border: none;
            border-radius: var(--xb-radius-sm);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
        }

        .xb-btn-primary { background: linear-gradient(135deg, var(--xb-primary), var(--xb-primary-dark)); color: white; }
        .xb-btn-primary:hover { box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4); transform: translateY(-1px); }
        .xb-btn-secondary { background: var(--xb-bg-card); color: var(--xb-text); border: 1px solid var(--xb-border); }
        .xb-btn-secondary:hover { background: var(--xb-bg-hover); }
        .xb-btn.active { background: linear-gradient(135deg, var(--xb-error), #dc2626); }
        .xb-btn-icon { font-size: 16px; }

        .xb-log-box { background: var(--xb-bg-card); border-radius: var(--xb-radius-sm); border: 1px solid var(--xb-border); overflow: hidden; margin-bottom: 14px; }
        .xb-log-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(0, 0, 0, 0.2); border-bottom: 1px solid var(--xb-border); }
        .xb-log-title { font-size: 11px; font-weight: 600; color: var(--xb-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .xb-log-modes { display: flex; gap: 4px; }
        .xb-log-mode-btn { padding: 2px 8px; border: none; background: transparent; color: var(--xb-text-muted); font-size: 10px; border-radius: 4px; cursor: pointer; }
        .xb-log-mode-btn.active { background: var(--xb-bg-hover); color: var(--xb-text); }
        .xb-log-clear-btn { color: var(--xb-error); }
        .xb-log-clear-btn:hover { background: rgba(239, 68, 68, 0.12); color: var(--xb-error); }
        .xb-log-content { height: 140px; overflow-y: auto; padding: 8px 12px; font-size: 11px; line-height: 1.5; user-select: text; -webkit-user-select: text; overscroll-behavior: contain; }
        .xb-log-content::-webkit-scrollbar { width: 3px; }
        .xb-log-content::-webkit-scrollbar-thumb { background: var(--xb-border); border-radius: 2px; }
        .xb-log-item { padding: 3px 0; display: flex; gap: 6px; }
        .xb-log-item .xb-log-icon { flex-shrink: 0; width: 14px; text-align: center; }
        .xb-log-item.success .xb-log-icon { color: var(--xb-success); }
        .xb-log-item.error .xb-log-icon { color: var(--xb-error); }
        .xb-log-item.warning .xb-log-icon { color: var(--xb-warning); }
        .xb-log-item.info .xb-log-icon { color: var(--xb-info); }
        .xb-log-item .xb-log-text { color: var(--xb-text-secondary); word-break: break-all; }
        .xb-log-item.success .xb-log-text { color: #a7f3d0; }
        .xb-log-item.error .xb-log-text { color: #fca5a5; }
        .xb-log-item.warning .xb-log-text { color: #fcd34d; }

        .xb-status-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--xb-bg-card); border-radius: var(--xb-radius-sm); border: 1px solid var(--xb-border); font-size: 11px; color: var(--xb-text-secondary); }
        .xb-status-item { display: flex; align-items: center; gap: 5px; }
        .xb-status-item i { font-size: 12px; color: var(--xb-text-muted); }

        .xb-settings-section { margin-bottom: 16px; }
        .xb-settings-title { font-size: 11px; font-weight: 600; color: var(--xb-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .xb-settings-title i { color: var(--xb-primary-light); font-size: 14px; }

        /* 不设 overflow:hidden，否则会裁剪绝对定位的模型下拉列表 */
        .xb-form-group { margin-bottom: 12px; max-width: 100%; }
        .xb-form-label { display: block; font-size: 11px; color: var(--xb-text-secondary); margin-bottom: 5px; }
        .xb-form-input { width: 100%; padding: 8px 12px; background: var(--xb-bg-card); border: 1px solid var(--xb-border); border-radius: var(--xb-radius-sm); color: var(--xb-text); font-size: 12px; transition: border-color 0.2s; }
        .xb-form-input:focus { outline: none; border-color: var(--xb-primary); }
        .xb-form-input::placeholder { color: var(--xb-text-muted); }

        .xb-switch-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
        .xb-switch-label { font-size: 12px; color: var(--xb-text-secondary); }
        .xb-switch { width: 40px; height: 22px; background: var(--xb-bg-hover); border-radius: 11px; cursor: pointer; position: relative; transition: background 0.2s; border: 1px solid var(--xb-border); flex-shrink: 0; z-index: 1; }
        .xb-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: var(--xb-text-muted); border-radius: 50%; transition: all 0.2s; pointer-events: none; }
        .xb-switch.on { background: var(--xb-primary); border-color: var(--xb-primary); }
        .xb-switch.on::after { left: 20px; background: white; }

        /* 自定义下拉框 */
        .xb-select { position: relative; }
        .xb-select-selected {
            width: 100%;
            padding: 8px 32px 8px 12px;
            background: var(--xb-bg-card);
            border: 1px solid var(--xb-border);
            border-radius: var(--xb-radius-sm);
            color: var(--xb-text);
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: border-color 0.2s;
        }
        .xb-select-selected:hover { border-color: var(--xb-primary); }
        .xb-select-selected i { font-size: 12px; color: var(--xb-text-muted); transition: transform 0.2s; }
        .xb-select-open .xb-select-selected i { transform: rotate(180deg); }
        .xb-select-open .xb-select-selected { border-color: var(--xb-primary); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        .xb-select-selected .xb-select-placeholder { color: var(--xb-text-muted); }
        .xb-select-list {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            /* 必须用不透明纯色：半透明背景会和下方设置项文字重叠导致看不清 */
            background: #1e293b;
            border: 1px solid var(--xb-primary);
            border-top: none;
            border-radius: 0 0 var(--xb-radius-sm) var(--xb-radius-sm);
            z-index: 10000;
            display: none;
        }
        .xb-select-open .xb-select-list { display: block; }
        .xb-select-item {
            padding: 8px 12px;
            font-size: 12px;
            color: var(--xb-text-secondary);
            cursor: pointer;
            transition: background 0.15s;
        }
        .xb-select-item:hover { background: var(--xb-bg-hover); color: var(--xb-text); }
        .xb-select-item.selected { color: var(--xb-primary-light); background: rgba(99, 102, 241, 0.1); }
        .xb-select-list::-webkit-scrollbar { width: 3px; }
        .xb-select-list::-webkit-scrollbar-thumb { background: var(--xb-border); border-radius: 3px; }

        .xb-range-group { display: flex; align-items: center; gap: 10px; }
        .xb-range { flex: 1; height: 5px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, var(--xb-primary) 0%, var(--xb-primary) 10%, var(--xb-bg-hover) 10%, var(--xb-bg-hover) 100%); border-radius: 3px; outline: none; cursor: pointer; }
        .xb-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 2px var(--xb-primary); cursor: pointer; }
        .xb-range-value { min-width: 36px; text-align: right; font-size: 12px; font-weight: 600; color: var(--xb-primary-light); }

        /* 有级滑条档位刻度：白色小点标示每一档位置（仅思考等级滑条使用），
           位置按滑块宽度修正：left = 8px + (100% - 16px) * 档位比例，确保与滑块中心对齐 */
        .xb-range-ticks { position: relative; flex: 1; display: flex; align-items: center; }
        .xb-range-ticks .xb-range { position: relative; z-index: 1; }
        .xb-tick { position: absolute; top: 50%; width: 4px; height: 4px; border-radius: 50%; background: rgba(255, 255, 255, 0.85); transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 0 3px rgba(0, 0, 0, 0.35); }

        .xb-settings-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; cursor: pointer; transition: background 0.2s; border-radius: var(--xb-radius-sm); margin: 0 -14px; }
        .xb-settings-row:hover { background: var(--xb-bg-card); }
        .xb-settings-row-left { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--xb-text-secondary); }
        .xb-settings-row-left i { font-size: 15px; color: var(--xb-text-muted); }
        .xb-settings-row-right i { font-size: 14px; color: var(--xb-text-muted); }

        .xb-btn-block { width: 100%; padding: 10px; border: none; border-radius: var(--xb-radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
        .xb-btn-outline { background: var(--xb-bg-card); color: var(--xb-text-secondary); border: 1px solid var(--xb-border); }
        .xb-btn-outline:hover { background: var(--xb-bg-hover); }

        /* 弹窗 */
        .xb-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 2147483647; display: flex; align-items: center; justify-content: center; }
        .xb-modal { background: var(--xb-bg-card); backdrop-filter: blur(20px); border: 1px solid var(--xb-border); border-radius: var(--xb-radius); padding: 24px; width: 280px; max-width: 90vw; }
        .xb-modal-title { font-size: 16px; font-weight: 600; margin-bottom: 10px; }
        .xb-modal-text { font-size: 13px; color: var(--xb-text-secondary); margin-bottom: 20px; line-height: 1.5; }
        .xb-modal-actions { display: flex; gap: 8px; }
        .xb-modal-btn { flex: 1; padding: 10px; border: none; border-radius: var(--xb-radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .xb-modal-btn.primary { background: linear-gradient(135deg, var(--xb-primary), var(--xb-primary-dark)); color: white; }
        .xb-modal-btn.secondary { background: var(--xb-bg-card); color: var(--xb-text-secondary); border: 1px solid var(--xb-border); }
        .xb-modal-btn:hover { transform: translateY(-1px); }

        /* 悬浮球 */
        .xb-restore-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            background: var(--xb-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--xb-border);
            border-radius: 14px;
            box-shadow: var(--xb-shadow);
            display: none;
            align-items: center;
            justify-content: center;
            cursor: move;
            z-index: 2147483647;
            font-size: 22px;
            color: var(--xb-primary-light);
            user-select: none;
            -webkit-user-select: none;
        }

        .xb-restore-btn.show { display: flex; }
        .xb-restore-btn:active { transform: scale(0.95); }
    `;
    document.head.appendChild(style);

    // ========== Remix Icon ==========
    if (!document.querySelector('link[href*="remixicon"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css';
        document.head.appendChild(link);
    }

    // ========== HTML ==========
    const panelHTML = `
        <div class="xb-panel" id="xbPanel">
            <div class="xb-header" id="xbDragHandle">
                <div class="xb-header-left">
                    <div class="xb-logo"><i class="ri-robot-2-fill"></i></div>
                    <div>
                        <span class="xb-title">学习通Bot</span>
                        <span class="xb-version" id="xbVersion">v3.1.0</span>
                    </div>
                </div>
                <div class="xb-header-btns">
                    <button class="xb-icon-btn" id="xbBtnBack" title="返回"><i class="ri-arrow-left-s-line"></i></button>
                    <button class="xb-icon-btn" id="xbBtnSettings" title="设置"><i class="ri-settings-3-line" id="xbSettingsIcon"></i></button>
                    <button class="xb-icon-btn" id="xbBtnMinimize" title="最小化"><i class="ri-subtract-line"></i></button>
                    <button class="xb-icon-btn close" id="xbBtnClose" title="关闭"><i class="ri-close-line"></i></button>
                </div>
            </div>
            <!-- 主视图 -->
            <div class="xb-content" id="xbViewMain">
                <div class="xb-api-card">
                    <div class="xb-api-dot" id="xbApiDot"></div>
                    <div class="xb-api-info">
                        <div class="xb-api-name" id="xbApiName">未配置 API</div>
                        <div class="xb-api-model"><span id="xbApiModel"></span><span id="xbApiEffort" style="display:none;color:var(--xb-warning);margin-left:6px;"></span></div>
                    </div>
                </div>
                <div class="xb-btn-row">
                    <button class="xb-btn xb-btn-primary" id="xbBtnStart"><i class="ri-play-fill xb-btn-icon"></i>开始答题</button>
                    <button class="xb-btn xb-btn-secondary" id="xbBtnBrush"><i class="ri-book-open-fill xb-btn-icon"></i>刷课</button>
                </div>
                <div class="xb-log-box">
                    <div class="xb-log-header">
                        <span class="xb-log-title">运行日志</span>
                        <div class="xb-log-modes">
                            <button class="xb-log-mode-btn active" id="xbLogSimple">简洁</button>
                            <button class="xb-log-mode-btn" id="xbLogDetail">详细</button>
                            <button class="xb-log-mode-btn xb-log-clear-btn" id="xbLogClear">清空</button>
                        </div>
                    </div>
                    <div class="xb-log-content" id="xbLogContent">
                        <div class="xb-log-item info"><span class="xb-log-icon"><i class="ri-information-line"></i></span><span class="xb-log-text">等待开始...</span></div>
                    </div>
                </div>
                <div class="xb-status-bar">
                    <div class="xb-status-item"><i class="ri-list-check-2"></i><span>进度: <span id="xbProgress">0/0</span></span></div>
                    <div class="xb-status-item"><i class="ri-time-line"></i><span id="xbStatusText">等待中</span></div>
                </div>
            </div>
            <!-- 设置视图 -->
            <div class="xb-content" id="xbViewSettings" style="display:none;">
                <div class="xb-settings-section">
                    <div class="xb-settings-title"><i class="ri-key-2-line"></i> API 设置</div>
                    <div class="xb-switch-item">
                        <span class="xb-switch-label">使用 OpenAI 兼容接口 <span style="font-size:10px;color:var(--xb-text-muted);">(默认 DeepSeek)</span></span>
                        <div class="xb-switch" id="xbSwitchApi"></div>
                    </div>
                    <div class="xb-form-group" id="xbOpenaiUrlGroup" style="display:none; margin-top:10px;">
                        <label class="xb-form-label">API 接口地址</label>
                        <input type="text" class="xb-form-input" id="xbOpenaiUrl" placeholder="https://api.example.com/v1">
                    </div>
                    <div class="xb-form-group" style="margin-top:10px;">
                        <label class="xb-form-label">API Key</label>
                        <input type="password" class="xb-form-input" id="xbApiKey" placeholder="输入 API Key">
                    </div>
                    <div class="xb-form-group" style="margin-top:10px;">
                        <button class="xb-btn xb-btn-primary" id="xbBtnFetchModels" style="width:100%;"><i class="ri-refresh-line"></i> 获取模型</button>
                    </div>
                    <div class="xb-form-group" style="margin-top:10px;">
                        <label class="xb-form-label">模型</label>
                        <div class="xb-select" id="xbModelSelectWrap">
                            <div class="xb-select-selected" id="xbModelSelectTrigger">
                                <span class="xb-select-placeholder">请先获取模型列表</span>
                                <i class="ri-arrow-down-s-line"></i>
                            </div>
                            <div class="xb-select-list" id="xbModelSelectList"></div>
                            <input type="hidden" id="xbModelSelectValue" value="">
                        </div>
                    </div>
                </div>
                <div class="xb-settings-section">
                    <div class="xb-settings-title"><i class="ri-file-list-3-line"></i> 答题设置</div>
                    <div class="xb-form-group">
                        <label class="xb-form-label">答题间隔</label>
                        <div class="xb-range-group">
                            <input type="range" class="xb-range" id="xbIntervalRange" min="0" max="10" value="1" step="0.5">
                            <span class="xb-range-value" id="xbIntervalValue">1.0s</span>
                        </div>
                    </div>
                    <div class="xb-switch-item">
                        <span class="xb-switch-label">重写已答题目</span>
                        <div class="xb-switch on" id="xbSwitchRewrite"></div>
                    </div>
                </div>
                <div class="xb-settings-section">
                    <div class="xb-settings-title"><i class="ri-play-circle-line"></i> 刷课设置</div>
                    <div class="xb-form-group">
                        <label class="xb-form-label">视频倍速</label>
                        <div class="xb-select" id="xbSpeedSelectWrap">
                            <div class="xb-select-selected" id="xbSpeedSelectTrigger">
                                <span class="xb-select-placeholder">1x</span>
                                <i class="ri-arrow-down-s-line"></i>
                            </div>
                            <div class="xb-select-list" id="xbSpeedSelectList"></div>
                            <input type="hidden" id="xbSpeedValue" value="1">
                        </div>
                    </div>
                    <div class="xb-switch-item">
                        <span class="xb-switch-label">静音播放</span>
                        <div class="xb-switch on" id="xbSwitchMute"></div>
                    </div>
                    <div class="xb-switch-item">
                        <span class="xb-switch-label">自动下一章</span>
                        <div class="xb-switch on" id="xbSwitchAutoNext"></div>
                    </div>
                    <div class="xb-switch-item">
                        <span class="xb-switch-label">跳过已完成</span>
                        <div class="xb-switch on" id="xbSwitchSkip"></div>
                    </div>
                </div>
                <div class="xb-settings-row" id="xbRowAdvanced">
                    <div class="xb-settings-row-left"><i class="ri-tools-line"></i> 高级选项</div>
                    <div class="xb-settings-row-right"><i class="ri-arrow-right-s-line"></i></div>
                </div>
            </div>
            <!-- 高级设置视图 -->
            <div class="xb-content" id="xbViewAdvanced" style="display:none;">
                <div class="xb-settings-section">
                    <div class="xb-settings-title"><i class="ri-shield-alert-line"></i> 容错选项</div>
                    <div class="xb-switch-item">
                        <div>
                            <div style="font-size:12px;color:var(--xb-text);">随机填充</div>
                            <div style="font-size:10px;color:var(--xb-text-muted);margin-top:2px;">LLM 回答失败时随机填写答案</div>
                        </div>
                        <div class="xb-switch" id="xbSwitchRandom"></div>
                    </div>
                    <div class="xb-switch-item">
                        <div>
                            <div style="font-size:12px;color:var(--xb-text);">自动提交</div>
                            <div style="font-size:10px;color:var(--xb-text-muted);margin-top:2px;">答题完成后自动交卷；关闭时仅保存答案</div>
                        </div>
                        <div class="xb-switch" id="xbSwitchAutoSubmit"></div>
                    </div>
                    <div class="xb-switch-item">
                        <div>
                            <div style="font-size:12px;color:var(--xb-text);">拖拽完成</div>
                            <div style="font-size:10px;color:var(--xb-text-muted);margin-top:2px;">可拖拽视频直接拉满进度条，减少等待（有一定风控风险）</div>
                        </div>
                        <div class="xb-switch on" id="xbSwitchSeekSkip"></div>
                    </div>
                </div>
                <div class="xb-settings-section">
                    <div class="xb-settings-title"><i class="ri-brain-line"></i> API 设置</div>
                    <div class="xb-form-group">
                        <label class="xb-form-label">思考等级</label>
                        <div class="xb-range-group">
                            <div class="xb-range-ticks">
                                <input type="range" class="xb-range" id="xbEffortRange" min="0" max="3" value="0" step="1">
                                <span class="xb-tick" style="left: 8px;"></span>
                                <span class="xb-tick" style="left: calc(8px + (100% - 16px) / 3);"></span>
                                <span class="xb-tick" style="left: calc(8px + (100% - 16px) / 3 * 2);"></span>
                                <span class="xb-tick" style="left: calc(100% - 8px);"></span>
                            </div>
                            <span class="xb-range-value" id="xbEffortValue">不思考</span>
                        </div>
                        <div id="xbEffortWarn" style="display:none;font-size:10px;color:var(--xb-warning);margin-top:6px;line-height:1.5;">
                            自定义接口的思考等级参数可能不被该服务商支持，答题报错请调回「不思考」
                        </div>
                    </div>
                </div>
                <div class="xb-settings-section">
                    <div class="xb-settings-title"><i class="ri-refresh-line"></i> 恢复默认</div>
                    <button class="xb-btn-block xb-btn-outline" id="xbBtnRestoreDefaults"><i class="ri-restart-line"></i> 恢复默认设置</button>
                    <div style="font-size:10px;color:var(--xb-text-muted);margin-top:6px;text-align:center;">将所有设置恢复为默认值</div>
                </div>
                <div class="xb-settings-section">
                    <div class="xb-settings-title"><i class="ri-bug-line"></i> 调试工具</div>
                    <button class="xb-btn-block xb-btn-outline" id="xbBtnExportLog"><i class="ri-download-2-line"></i> 导出运行日志</button>
                    <div style="font-size:10px;color:var(--xb-text-muted);margin-top:6px;text-align:center;">包含题目详情、LLM 返回、字体替换等完整信息</div>
                    <button class="xb-btn-block xb-btn-outline" id="xbBtnClearLogsGlobal" style="color:var(--xb-error);"><i class="ri-delete-bin-line"></i> 清空持久化日志记录</button>
                    <div style="font-size:10px;color:var(--xb-text-muted);margin-top:6px;text-align:center;">删除全局汇聚的全部历史日志（含其他课程页面），此后导出文件为空</div>
                </div>
            </div>
            <!-- 确认弹窗（通用：恢复默认/清空日志共用） -->
            <div class="xb-modal-overlay" id="xbModalOverlay" style="display:none;">
                <div class="xb-modal">
                    <div class="xb-modal-title" id="xbModalTitle">确认操作</div>
                    <div class="xb-modal-text" id="xbModalText">确定要执行此操作吗？</div>
                    <div class="xb-modal-actions">
                        <button class="xb-modal-btn secondary" id="xbModalCancel">取消</button>
                        <button class="xb-modal-btn primary" id="xbModalConfirm">确定</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="xb-restore-btn" id="xbRestoreBtn"><i class="ri-robot-2-fill"></i></div>
    `;

    const container = document.createElement('div');
    container.innerHTML = panelHTML;
    document.body.appendChild(container);

    // ========== DOM ==========
    const $ = id => document.getElementById(id);
    const panel = $('xbPanel');
    const restoreBtn = $('xbRestoreBtn');
    const dragHandle = $('xbDragHandle');

    // ========== 拖动功能 ==========
    let isDragging = false;
    let dragHappened = false;
    let dragStartX, dragStartY, dragStartLeft, dragStartTop;

    // 面板拖动
    dragHandle.addEventListener('mousedown', startDrag);
    dragHandle.addEventListener('touchstart', startDrag, { passive: false });

    // 悬浮球拖动
    restoreBtn.addEventListener('mousedown', startBallDrag);
    restoreBtn.addEventListener('touchstart', startBallDrag, { passive: false });

    function startDrag(e) {
        if (e.target.closest('.xb-icon-btn')) return;
        e.preventDefault();
        isDragging = true;
        dragHappened = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartX = clientX;
        dragStartY = clientY;
        const rect = panel.getBoundingClientRect();
        dragStartLeft = rect.left;
        dragStartTop = rect.top;
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }

    function startBallDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        dragHappened = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartX = clientX;
        dragStartY = clientY;
        const rect = restoreBtn.getBoundingClientRect();
        dragStartLeft = rect.left;
        dragStartTop = rect.top;
        document.addEventListener('mousemove', onBallDrag);
        document.addEventListener('mouseup', stopBallDrag);
        document.addEventListener('touchmove', onBallDrag, { passive: false });
        document.addEventListener('touchend', stopBallDrag);
    }

    function onDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragHappened = true;

        let newLeft = dragStartLeft + dx;
        let newTop = dragStartTop + dy;

        const pw = panel.offsetWidth;
        const ph = panel.offsetHeight;
        const ww = window.innerWidth;
        const wh = window.innerHeight;

        newLeft = Math.max(0, Math.min(newLeft, ww - pw));
        newTop = Math.max(0, Math.min(newTop, wh - ph));

        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.right = 'auto';
    }

    function onBallDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragHappened = true;

        let newLeft = dragStartLeft + dx;
        let newTop = dragStartTop + dy;

        const bw = restoreBtn.offsetWidth;
        const bh = restoreBtn.offsetHeight;
        const ww = window.innerWidth;
        const wh = window.innerHeight;

        newLeft = Math.max(0, Math.min(newLeft, ww - bw));
        newTop = Math.max(0, Math.min(newTop, wh - bh));

        restoreBtn.style.left = newLeft + 'px';
        restoreBtn.style.top = newTop + 'px';
        restoreBtn.style.right = 'auto';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', stopDrag);
    }

    function stopBallDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onBallDrag);
        document.removeEventListener('mouseup', stopBallDrag);
        document.removeEventListener('touchmove', onBallDrag);
        document.removeEventListener('touchend', stopBallDrag);
    }

    // ========== 智能定位 ==========
    function showPanelAtBall() {
        const ballRect = restoreBtn.getBoundingClientRect();
        const panelWidth = 340;
        const panelHeight = 460;
        const margin = 10;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let left, top;

        // 水平定位
        if (ballRect.left < winWidth / 2) {
            // 球在左边，面板放在球右边
            left = ballRect.right + margin;
            if (left + panelWidth > winWidth) {
                left = winWidth - panelWidth - margin;
            }
        } else {
            // 球在右边，面板放在球左边
            left = ballRect.left - panelWidth - margin;
            if (left < margin) {
                left = margin;
            }
        }

        // 垂直定位
        if (ballRect.top < winHeight / 2) {
            // 球在上边，面板放在球下边
            top = ballRect.bottom + margin;
            if (top + panelHeight > winHeight) {
                top = winHeight - panelHeight - margin;
            }
        } else {
            // 球在下边，面板放在球上边
            top = ballRect.top - panelHeight - margin;
            if (top < margin) {
                top = margin;
            }
        }

        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
        panel.style.right = 'auto';
    }

    // ========== 阻止滚轮穿透 ==========
    // 判定：从事件目标向上，是否存在能沿本次滚动方向继续滚动的祖先容器。
    // 主页视图的 .xb-content 高度=内容自然高度（无溢出、非滚动容器），
    // overscroll-behavior 对其无效，必须靠这里逐层检查后决定是否拦截。
    function findScrollableAncestor(startEl, deltaY) {
        let el = startEl;
        while (el && el !== panel) {
            if (el.nodeType === 1) {
                const cs = window.getComputedStyle(el);
                const scrollable = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
                                   el.scrollHeight > el.clientHeight;
                if (scrollable) {
                    const atTop = el.scrollTop <= 0;
                    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
                    if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
                        return el; // 该容器还能消化这次滚动
                    }
                }
            }
            el = el.parentElement;
        }
        return null;
    }

    panel.addEventListener('wheel', (e) => {
        if (!findScrollableAncestor(e.target, e.deltaY)) {
            e.preventDefault(); // 没有任何容器能消化 → 拦截，防止穿透到底层网页
        } else {
            e.stopPropagation(); // 面板内部消化滚动，不冒泡给页面
        }
    }, { passive: false });

    // ========== 视图切换 ==========
    let viewHistory = ['main'];

    function updateBackButton() {
        const btnSettings = $('xbBtnSettings');
        const settingsIcon = $('xbSettingsIcon');
        const currentView = viewHistory[viewHistory.length - 1];
        if (currentView === 'main') {
            btnSettings.onclick = function() { showView('settings'); };
            settingsIcon.className = 'ri-settings-3-line';
            btnSettings.title = '设置';
        } else {
            btnSettings.onclick = goBack;
            settingsIcon.className = 'ri-arrow-left-s-line';
            btnSettings.title = '返回';
        }
    }

    function goBack() {
        if (viewHistory.length > 1) {
            viewHistory.pop();
            showView(viewHistory[viewHistory.length - 1]);
        }
    }

    function showView(view) {
        const main = $('xbViewMain');
        const settings = $('xbViewSettings');
        const advanced = $('xbViewAdvanced');

        if (view !== viewHistory[viewHistory.length - 1]) {
            viewHistory.push(view);
        }

        if (view === 'main') {
            main.style.display = 'block';
            settings.style.display = 'none';
            advanced.style.display = 'none';
        } else if (view === 'settings') {
            main.style.display = 'none';
            settings.style.display = 'block';
            advanced.style.display = 'none';
        } else if (view === 'advanced') {
            main.style.display = 'none';
            settings.style.display = 'none';
            advanced.style.display = 'block';
        }

        updateBackButton();
    }

    // ========== 开关切换 ==========
    // 注意：content script 运行在隔离世界，HTML 内联 onclick 会在页面主世界执行
    // 而主世界访问不到这里的函数，因此必须用 addEventListener 绑定
    function toggleSwitch(el, targetId) {
        el.classList.toggle('on');
        if (targetId) {
            $(targetId).style.display = el.classList.contains('on') ? 'block' : 'none';
        }
    }

    $('xbSwitchApi').addEventListener('click', function() {
        toggleSwitch(this, 'xbOpenaiUrlGroup');
        // 切换类型后按新类型的 Key/Model 刷新主页状态卡片，并同步思考等级提示行
        saveSettings().then(updateApiStatusCard);
        updateEffortWarn();
    });
    $('xbSwitchRewrite').addEventListener('click', function() { toggleSwitch(this); saveSettings(); });
    $('xbSwitchAutoNext').addEventListener('click', function() { toggleSwitch(this); saveSettings(); });
    $('xbSwitchSkip').addEventListener('click', function() { toggleSwitch(this); saveSettings(); });
    $('xbSwitchSeekSkip').addEventListener('click', function() { toggleSwitch(this); saveSettings(); });
    $('xbSwitchMute').addEventListener('click', function() { toggleSwitch(this); saveSettings(); });
    $('xbSwitchRandom').addEventListener('click', function() { toggleSwitch(this); saveSettings(); });
    $('xbSwitchAutoSubmit').addEventListener('click', function() { toggleSwitch(this); saveSettings(); });

    // 输入项变化即时持久化
    $('xbApiKey').addEventListener('change', saveSettings);
    $('xbOpenaiUrl').addEventListener('change', saveSettings);
    $('xbIntervalRange').addEventListener('change', saveSettings);
    // 思考等级：拖动实时刷新档位文字与提示行，松手后持久化
    $('xbEffortRange').addEventListener('input', updateEffortWarn);
    $('xbEffortRange').addEventListener('change', saveSettings);

    // ========== 通用二次确认弹窗 ==========
    let _modalAction = null;
    function showConfirm(title, text, confirmLabel, action) {
        $('xbModalTitle').textContent = title;
        $('xbModalText').textContent = text;
        $('xbModalConfirm').textContent = confirmLabel;
        _modalAction = action;
        $('xbModalOverlay').style.display = 'flex';
    }
    function closeModal() {
        $('xbModalOverlay').style.display = 'none';
        _modalAction = null;
    }
    $('xbModalCancel').addEventListener('click', closeModal);
    $('xbModalConfirm').addEventListener('click', () => {
        const action = _modalAction;
        closeModal();
        if (action) action();
    });

    // ========== 恢复默认 ==========
    function restoreDefaults() {
        $('xbSwitchApi').classList.remove('on');
        $('xbSwitchRewrite').classList.add('on');
        $('xbSwitchAutoNext').classList.add('on');
        $('xbSwitchSkip').classList.add('on');
        $('xbSwitchSeekSkip').classList.add('on');
        $('xbSwitchRandom').classList.remove('on');
        $('xbSwitchAutoSubmit').classList.remove('on');
        $('xbOpenaiUrlGroup').style.display = 'none';
        $('xbIntervalRange').value = 1;
        $('xbIntervalValue').textContent = '1.0s';
        $('xbEffortRange').value = 0;
        $('xbEffortRange').dispatchEvent(new Event('input'));
        selectSpeed(1); // 倍速已是下拉框，用 selectSpeed 同步显示与隐藏值
        addLogEntry('已恢复默认设置', 'success');
        saveSettings();
    }

    /**
     * 思考等级提示行：仅当使用自定义 OpenAI 兼容接口且选择非「不思考」档时显示，
     * 提醒该服务商可能不支持 reasoning_effort 参数
     */
    function updateEffortWarn() {
        const effortIdx = parseInt($('xbEffortRange').value, 10) || 0;
        const effort = EFFORT_KEYS[effortIdx] || 'none';
        const isOpenApi = $('xbSwitchApi').classList.contains('on');
        $('xbEffortWarn').style.display = (isOpenApi && effort !== 'none') ? 'block' : 'none';
        updateApiEffortBadge();
    }

    /**
     * 首页状态卡：在模型名后以黄色小字实时显示当前思考等级
     * （滑条拖动 / 恢复默认 / 设置加载均经 updateEffortWarn 联动到此处）
     */
    function updateApiEffortBadge() {
        const effortIdx = parseInt($('xbEffortRange').value, 10) || 0;
        const badge = $('xbApiEffort');
        badge.textContent = EFFORT_LEVELS[effortIdx] || '不思考';
        badge.style.display = 'inline';
    }

    // ========== 清空日志 ==========
    // 首页「清空」：仅清空显示日志（本页 + 所有页面面板），详细日志保留。
    // background 会广播 LOG_CLEAR_DISPLAY 给所有已打开的课程标签页同步清空显示视图
    function performClearLogs() {
        logContent.innerHTML = '';
        logState.logs = [];
        if (typeof XB !== 'undefined' && XB.Log && XB.Log.clearDisplay) {
            XB.Log.clearDisplay();
        }
        if (typeof XB !== 'undefined' && XB.Log && XB.Log.rerenderNow) XB.Log.rerenderNow();
        // skipDetail：清空提示不写全局层，避免"清空后还有残留日志"的假象
        addLogEntry('显示日志已清空（详细日志记录保留）', 'success', { skipDetail: true });
    }

    $('xbRowAdvanced').addEventListener('click', () => showView('advanced'));
    $('xbBtnRestoreDefaults').addEventListener('click', () =>
        showConfirm('确认恢复', '确定要将所有设置恢复为默认值吗？此操作不可撤销。', '确定恢复', restoreDefaults));
    $('xbLogClear').addEventListener('click', () =>
        showConfirm('确认清空日志', '确定要清空显示日志吗？将同时清除所有页面面板的显示日志，详细日志记录保留，此操作不可撤销。', '确定清空', performClearLogs));

    // 高级设置：仅清空详细日志记录（含其他课程页面的记录），显示日志保留
    $('xbBtnClearLogsGlobal').addEventListener('click', () =>
        showConfirm('确认清空持久化日志', '确定要删除全部详细日志记录吗？包括其他课程页面产生的记录，导出文件将不再包含它们，显示日志不受影响，此操作不可撤销。', '确定清空', () => {
            if (typeof XB !== 'undefined' && XB.Log && XB.Log.clearDetail) {
                XB.Log.clearDetail();
            }
            if (typeof XB !== 'undefined' && XB.Log && XB.Log.rerenderNow) XB.Log.rerenderNow();
            logContent.innerHTML = '';
            logState.logs = [];
            addLogEntry('已清空详细日志记录（显示日志保留）', 'success', { skipDetail: true });
        }));

    // ========== 自定义下拉框 ==========
    let selectOpen = null;

    function toggleSelect(el) {
        const wrap = el.closest('.xb-select');
        if (selectOpen && selectOpen !== wrap) {
            selectOpen.classList.remove('xb-select-open');
        }
        wrap.classList.toggle('xb-select-open');
        selectOpen = wrap.classList.contains('xb-select-open') ? wrap : null;
    }

    $('xbModelSelectTrigger').addEventListener('click', function(e) { toggleSelect(this); });
    $('xbSpeedSelectTrigger').addEventListener('click', function(e) { toggleSelect(this); });

    // 初始化倍速选择器
    function initSpeedSelector() {
        const speeds = [1, 1.25, 1.5, 2];
        const list = $('xbSpeedSelectList');
        list.innerHTML = '';

        speeds.forEach(speed => {
            const item = document.createElement('div');
            item.className = 'xb-select-item';
            item.textContent = speed + 'x';
            item.dataset.value = speed;
            item.onclick = function(e) {
                e.stopPropagation();
                selectSpeed(speed);
                list.parentElement.classList.remove('xb-select-open');
                selectOpen = null;
            };
            list.appendChild(item);
        });

        // 恢复已保存的倍速
        chrome.storage.local.get(['apiSettings'], (result) => {
            if (result.apiSettings && result.apiSettings.videoSpeed) {
                selectSpeed(result.apiSettings.videoSpeed);
            }
        });
    }

    // 选中倍速
    function selectSpeed(speed) {
        $('xbSpeedValue').value = speed;
        const span = document.querySelector('#xbSpeedSelectWrap .xb-select-selected span');
        if (span) {
            span.textContent = speed + 'x';
            span.classList.remove('xb-select-placeholder');
        }
        document.querySelectorAll('#xbSpeedSelectList .xb-select-item')
            .forEach(i => i.classList.toggle('selected', parseFloat(i.dataset.value) === speed));
        saveSettings();
    }

    function populateModelSelect(models) {
        const list = $('xbModelSelectList');
        list.innerHTML = '';
        models.forEach(model => {
            const item = document.createElement('div');
            item.className = 'xb-select-item';
            item.textContent = model;
            item.onclick = function(e) {
                e.stopPropagation();
                selectModel(model);
                list.parentElement.classList.remove('xb-select-open');
                selectOpen = null;
            };
            list.appendChild(item);
        });
    }

    // 选中模型：更新显示、hidden input、高亮项并持久化
    function selectModel(model) {
        if (!model) return;
        $('xbModelSelectValue').value = model;
        const span = document.querySelector('#xbModelSelectWrap .xb-select-selected span');
        if (span) {
            span.textContent = model;
            span.classList.remove('xb-select-placeholder');
        }
        document.querySelectorAll('#xbModelSelectList .xb-select-item')
            .forEach(i => i.classList.toggle('selected', i.textContent === model));
        saveSettings();
    }

    // 密钥脱敏：显示前4位和后4位，中间用圆点隐藏
    function maskApiKey(key) {
        if (!key) return '';
        const k = String(key).trim();
        if (k.length <= 8) return '•'.repeat(Math.max(k.length, 6));
        return k.slice(0, 4) + '••••••' + k.slice(-4);
    }

    // 点击外部关闭下拉框
    document.addEventListener('click', (e) => {
        if (selectOpen && !e.target.closest('.xb-select')) {
            selectOpen.classList.remove('xb-select-open');
            selectOpen = null;
        }
    });

    // 初始化倍速选择器
    initSpeedSelector();

    // ========== 日志系统 ==========
    const logContent = $('xbLogContent');
    const logState = { logs: [] };

    // 统一的日志渲染：图标 + 文本（text 做兜底防 undefined，文本用 textContent 防注入）
    function renderLogItem(text, type = 'info') {
        const icons = { info: 'ri-information-line', success: 'ri-checkbox-circle-line', warning: 'ri-alert-line', error: 'ri-error-warning-line' };
        const safeText = String(text == null ? '' : text);
        const item = document.createElement('div');
        item.className = `xb-log-item ${type}`;
        item.innerHTML = `<span class="xb-log-icon"><i class="${icons[type] || icons.info}"></i></span><span class="xb-log-text"></span>`;
        item.querySelector('.xb-log-text').textContent = safeText;
        logContent.appendChild(item);
        logContent.scrollTop = logContent.scrollHeight;
        return item;
    }

    function addLogEntry(text, type = 'info', opts = {}) {
        renderLogItem(text, type);

        // 面板自身操作写入详细日志供导出；来自 XB.Log.display 的已记录过，跳过防重复。
        // skipDetail=true 时不写全局层，避免"清空/导出"等提示残留在全局日志里
        if (!opts.skipDetail && typeof XB !== 'undefined' && XB.Log) {
            XB.Log.detail('PANEL', text, null, true); // 屏幕已显示，不重复
        }
    }

    // 监听 background 广播的跨页日志（background 仅广播 DISPLAY 简洁日志），实现实时同步。
    // 收到后按当前模式过滤追加：简洁模式只上屏重要条目（success/error/warning），
    // 详细模式全部上屏。background 广播时已排除来源标签页，本页不会重复渲染自己的日志。
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'LOG_APPEND') {
            const entry = message.entry || {};
            if (entry.c !== 'DISPLAY') return; // 详细日志由切页/刷新时的全局快照可见，不实时推送

            const text = entry.m || '';
            const type = (entry.d && entry.d.type) || 'info';
            // 走统一渲染路径：进渲染流、按模式过滤上屏（简洁模式重要条目、详细模式全部），
            // 并确保模式切换重放时跨页日志不丢失
            if (typeof XB !== 'undefined' && XB.Log && XB.Log.appendRemoteDisplay) {
                XB.Log.appendRemoteDisplay(text, type, entry.t || Date.now());
            }
            return;
        }
        // 其他页面清空显示日志时广播而来：仅清空本页显示日志视图与内存（不再发消息，避免回环广播）
        if (message.type === 'LOG_CLEAR_DISPLAY') {
            if (typeof XB !== 'undefined' && XB.Log && XB.Log.clearDisplayLocal) XB.Log.clearDisplayLocal();
            if (typeof XB !== 'undefined' && XB.Log && XB.Log.rerenderNow) XB.Log.rerenderNow();
        }
    });

    // 恢复历史日志：从 background 拉取全局显示日志（最多 500 条）与最近详细日志（500 条），
    // 覆盖本页内存并触发一次全量重放（restoreHistoryLogs 内部已处理去重与 rerender）
    async function restoreHistoryLogs() {
        if (typeof XB !== 'undefined' && XB.Log && XB.Log.restoreHistoryLogs) {
            await XB.Log.restoreHistoryLogs();
        }
    }

    function connectLogSystem() {
        if (typeof XB !== 'undefined' && XB.Log) {
            XB.Log.onDisplay(entry => {
                // skipDetail: display 层日志已在 XB.Log 中，避免导出时重复
                addLogEntry(entry.text, entry.type, { skipDetail: true });
                logState.logs.push(entry);
            });
            // 模式切换 → 清屏按新模式全量重放（简洁↔详细原地升级/降级，历史不丢）
            XB.Log.onRerender(entries => {
                logContent.innerHTML = '';
                logState.logs = [];
                if (entries.length === 0) {
                    // 当前模式没有可显示的历史时给出占位提示，避免面板空白让人误以为出 bug
                    renderLogItem('暂无日志', 'info');
                    return;
                }
                entries.forEach(e => {
                    renderLogItem(e.text, e.type);
                    logState.logs.push({ text: e.text, type: e.type, time: e.time });
                });
                logContent.scrollTop = logContent.scrollHeight;
            });
        }
    }

    // 按钮高亮与实际模式对齐（模式会从 storage 恢复）
    async function syncLogModeButtons() {
        if (typeof XB === 'undefined' || !XB.Log || !XB.Log.restoreMode) return;
        const mode = await XB.Log.restoreMode();
        if (mode === 'detail') {
            $('xbLogDetail').classList.add('active');
            $('xbLogSimple').classList.remove('active');
        }
    }

    async function downloadLogs() {
        if (typeof XB !== 'undefined' && XB.Log) {
            try {
                // download 为异步：先从全局汇聚层拉取全量（含其他课程页面）再导出
                const count = await XB.Log.download();
                addLogEntry(`已导出 ${count} 条详细日志（全局全量）`, 'success');
            } catch (e) {
                addLogEntry(`导出失败: ${e.message}`, 'error');
            }
        } else {
            const lines = logState.logs.map(l => `[${new Date(l.time).toLocaleTimeString()}] ${l.text}`);
            const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xuexitong-log-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    // ========== 滑动条 ==========
    function setupRange(rangeId, valueId, format) {
        const range = $(rangeId);
        const value = $(valueId);
        function update() {
            const val = parseFloat(range.value);
            const min = parseFloat(range.min);
            const max = parseFloat(range.max);
            const pct = ((val - min) / (max - min)) * 100;
            range.style.background = `linear-gradient(to right, var(--xb-primary) ${pct}%, var(--xb-bg-hover) ${pct}%)`;
            value.textContent = format(val);
        }
        range.addEventListener('input', update);
        update();
    }
    setupRange('xbIntervalRange', 'xbIntervalValue', v => v.toFixed(1) + 's');
    setupRange('xbEffortRange', 'xbEffortValue', v => EFFORT_LEVELS[v] || '不思考');

    // ========== 事件绑定 ==========
    $('xbBtnMinimize').addEventListener('click', () => {
        panel.classList.add('xb-hidden');
        restoreBtn.classList.add('show');
    });

    $('xbBtnClose').addEventListener('click', () => {
        panel.style.display = 'none';
        restoreBtn.classList.add('show');
    });

    restoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dragHappened) {
            dragHappened = false;
            return;
        }
        panel.classList.remove('xb-hidden');
        panel.style.display = '';
        showPanelAtBall();
        restoreBtn.classList.remove('show');
    });

    // ========== 配置收集与持久化 ==========
    // 与 popup.js / 原版共享同一份 chrome.storage.local.apiSettings
    function normalizeBaseUrl(u) {
        return (u || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
    }

    async function readStoredSettings() {
        try {
            const result = await chrome.storage.local.get(['apiSettings']);
            return result.apiSettings || {};
        } catch (e) {
            return {};
        }
    }

    async function saveSettings() {
        const isOpenApi = $('xbSwitchApi').classList.contains('on');
        const prev = await readStoredSettings();
        // 保留另一种 API 类型的 Key/Model，避免切换时互相覆盖丢失
        const settings = {
            ...prev,
            apiType: isOpenApi ? 'openai' : 'deepseek',
            interval: parseFloat($('xbIntervalRange').value) || 1,
            rewriteMode: $('xbSwitchRewrite').classList.contains('on') ? 'rewrite' : 'skip',
            videoSpeed: parseFloat($('xbSpeedValue').value) || 1,
            muteVideo: $('xbSwitchMute').classList.contains('on'),
            autoNext: $('xbSwitchAutoNext').classList.contains('on'),
            skipFinished: $('xbSwitchSkip').classList.contains('on'),
            seekSkip: $('xbSwitchSeekSkip').classList.contains('on'),
            randomFill: $('xbSwitchRandom').classList.contains('on'),
            autoSubmit: $('xbSwitchAutoSubmit').classList.contains('on'),
            reasoningEffort: EFFORT_KEYS[parseInt($('xbEffortRange').value, 10)] || 'none'
        };
        if (isOpenApi) {
            settings.openaiKey = $('xbApiKey').value.trim();
            settings.openaiUrl = normalizeBaseUrl($('xbOpenaiUrl').value);
            settings.openaiModel = $('xbModelSelectValue').value || prev.openaiModel || '';
        } else {
            settings.deepseekKey = $('xbApiKey').value.trim();
            settings.deepseekModel = $('xbModelSelectValue').value || prev.deepseekModel || '';
        }
        await chrome.storage.local.set({ apiSettings: settings });
        return settings;
    }

    function updateApiStatusCard(s) {
        const type = s.apiType || 'deepseek';
        const model = s.deepseekModel || s.openaiModel || '';
        const key = type === 'openai' ? s.openaiKey : s.deepseekKey;
        const hasKey = !!key;
        $('xbApiDot').classList.toggle('active', hasKey);
        // 提供商名称后附脱敏密钥（前4位+圆点+后4位），方便区分多个 Key
        $('xbApiName').textContent = hasKey
            ? `${type === 'openai' ? 'OpenAI 兼容接口' : 'DeepSeek'} · ${maskApiKey(key)}`
            : '未配置 API';
        $('xbApiModel').textContent = hasKey ? model : '';
    }

    async function loadSettings() {
        const s = await readStoredSettings();

        // 思考等级滑条独立于 API Key 是否配置，先行恢复并刷新档位显示
        const effortIdx = EFFORT_KEYS.indexOf(s.reasoningEffort);
        $('xbEffortRange').value = effortIdx >= 0 ? effortIdx : 0;
        $('xbEffortRange').dispatchEvent(new Event('input'));

        if (!s.apiType && !s.deepseekKey && !s.openaiKey) return;

        if (s.apiType === 'openai') $('xbSwitchApi').classList.add('on');
        $('xbOpenaiUrlGroup').style.display = s.apiType === 'openai' ? 'block' : 'none';
        $('xbApiKey').value = (s.apiType === 'openai' ? s.openaiKey : s.deepseekKey) || '';
        if (s.apiType === 'openai') $('xbOpenaiUrl').value = s.openaiUrl || '';

        $('xbIntervalRange').value = s.interval != null ? s.interval : 1;
        $('xbIntervalRange').dispatchEvent(new Event('input'));

        if (s.videoSpeed != null) {
            selectSpeed(s.videoSpeed);
        }

        $('xbSwitchRewrite').classList.toggle('on', s.rewriteMode !== 'skip');
        $('xbSwitchAutoNext').classList.toggle('on', s.autoNext !== false);
        $('xbSwitchSkip').classList.toggle('on', s.skipFinished !== false);
        $('xbSwitchSeekSkip').classList.toggle('on', s.seekSkip !== false);
        $('xbSwitchMute').classList.toggle('on', s.muteVideo !== false);
        $('xbSwitchRandom').classList.toggle('on', s.randomFill === true);
        $('xbSwitchAutoSubmit').classList.toggle('on', s.autoSubmit === true);

        const savedModel = (s.apiType === 'openai' ? s.openaiModel : s.deepseekModel) || '';
        if (savedModel) {
            // 回显已保存的模型（列表暂只含这一项，重新获取模型后会补全并自动选中）
            populateModelSelect([savedModel]);
            selectModel(savedModel);
        }

        updateApiStatusCard(s);
    }

    // 收集配置：保存 UI 状态 -> 校验 -> 构造与 main.js/background 协议一致的 config
    async function collectApiConfig() {
        let settings;
        try {
            settings = await saveSettings();
        } catch (e) {
            addLogEntry('读取设置失败，请刷新页面重试', 'error');
            return null;
        }
        if (!settings.deepseekKey && !settings.openaiKey) {
            addLogEntry('请先在「设置」中配置 API Key', 'error');
            showView('settings');
            return null;
        }
        const isOpen = settings.apiType === 'openai';
        if (isOpen && !settings.openaiUrl) {
            addLogEntry('使用 OpenAI 兼容接口需先填写接口地址', 'error');
            showView('settings');
            return null;
        }
        const model = isOpen ? settings.openaiModel : settings.deepseekModel;
        if (!model) {
            addLogEntry('请先获取并选择模型', 'error');
            showView('settings');
            return null;
        }
        const effort = settings.reasoningEffort || 'none';
        if (isOpen && effort !== 'none') {
            // 自定义兼容端点无法预知是否支持思考等级参数，提前提醒
            const effortLabel = EFFORT_LEVELS[EFFORT_KEYS.indexOf(effort)] || effort;
            addLogEntry(`已启用思考等级 ${effortLabel}：自定义 OpenAI 兼容接口可能不支持该参数，答题报错请调回「不思考」`, 'warning');
        }
        return {
            settings,
            config: {
                type: settings.apiType,
                url: isOpen ? settings.openaiUrl : '',
                key: isOpen ? settings.openaiKey : settings.deepseekKey,
                model: model,
                reasoningEffort: effort
            }
        };
    }

    function sendPanelMessage(msg) {
        try {
            window.postMessage({ source: 'xuexitong-bot-panel', ...msg }, '*');
        } catch (e) {}
    }

    function resetRunButtons() {
        isAnswering = false;
        isBrushing = false;
        $('xbBtnStart').classList.remove('active');
        $('xbBtnStart').innerHTML = '<i class="ri-play-fill xb-btn-icon"></i>开始答题';
        $('xbBtnBrush').classList.remove('active');
        $('xbBtnBrush').innerHTML = '<i class="ri-book-open-fill xb-btn-icon"></i>刷课';
    }

    let isAnswering = false, isBrushing = false;
    $('xbBtnStart').addEventListener('click', async () => {
        if (isAnswering) {
            sendPanelMessage({ type: 'stopAnswer' });
            resetRunButtons();
            addLogEntry('已停止答题', 'warning');
            return;
        }
        if (isBrushing) {
            sendPanelMessage({ type: 'stopAnswer' });
            isBrushing = false;
            $('xbBtnBrush').classList.remove('active');
            $('xbBtnBrush').innerHTML = '<i class="ri-book-open-fill xb-btn-icon"></i>刷课';
        }
        const bundle = await collectApiConfig();
        if (!bundle) return;
        const { config, settings } = bundle;

        isAnswering = true;
        $('xbBtnStart').classList.add('active');
        $('xbBtnStart').innerHTML = '<i class="ri-stop-fill xb-btn-icon"></i>停止答题';
        if (typeof XB !== 'undefined' && XB.Log) XB.Log.detail('SYSTEM', '──── 用户发起新任务：开始答题 ────');
        addLogEntry(`开始答题 [${config.type === 'openai' ? 'OpenAI兼容' : 'DeepSeek'}] 模型: ${config.model}`, 'info');

        // 与原版协议一致：携带完整配置供 main.js 使用
        sendPanelMessage({
            type: 'startAnswer',
            config: config,
            interval: (settings.interval || 3) * 1000,
            rewriteMode: settings.rewriteMode !== 'skip',
            brushConfig: { enabled: false },
            answerConfig: { randomFill: settings.randomFill === true, autoSubmit: settings.autoSubmit === true }
        });
    });

    $('xbBtnBrush').addEventListener('click', async () => {
        if (isBrushing) {
            sendPanelMessage({ type: 'stopAnswer' });
            resetRunButtons();
            addLogEntry('已停止刷课', 'warning');
            return;
        }
        if (isAnswering) {
            sendPanelMessage({ type: 'stopAnswer' });
            isAnswering = false;
            $('xbBtnStart').classList.remove('active');
            $('xbBtnStart').innerHTML = '<i class="ri-play-fill xb-btn-icon"></i>开始答题';
        }
        const bundle = await collectApiConfig();
        if (!bundle) return;
        const { config, settings } = bundle;

        isBrushing = true;
        $('xbBtnBrush').classList.add('active');
        $('xbBtnBrush').innerHTML = '<i class="ri-stop-fill xb-btn-icon"></i>停止刷课';
        if (typeof XB !== 'undefined' && XB.Log) XB.Log.detail('SYSTEM', '──── 用户发起新任务：开始刷课 ────');
        addLogEntry(`开始刷课 [${config.type === 'openai' ? 'OpenAI兼容' : 'DeepSeek'}] 倍速: ${settings.videoSpeed || 1}x`, 'info');

        sendPanelMessage({
            type: 'startAnswer',
            config: config,
            interval: (settings.interval || 3) * 1000,
            rewriteMode: settings.rewriteMode !== 'skip',
            brushConfig: {
                enabled: true,
                videoSpeed: settings.videoSpeed || 1,
                autoNext: settings.autoNext !== false,
                skipFinished: settings.skipFinished !== false,
                seekSkip: settings.seekSkip !== false
            },
            answerConfig: { randomFill: settings.randomFill === true, autoSubmit: settings.autoSubmit === true }
        });
    });

    $('xbLogSimple').addEventListener('click', () => { $('xbLogSimple').classList.add('active'); $('xbLogDetail').classList.remove('active'); if (XB?.Log) XB.Log.setMode('simple'); });
    $('xbLogDetail').addEventListener('click', () => { $('xbLogDetail').classList.add('active'); $('xbLogSimple').classList.remove('active'); if (XB?.Log) XB.Log.setMode('detail'); });

    $('xbBtnExportLog').addEventListener('click', downloadLogs);

    let fetchModelsReqId = null;
    $('xbBtnFetchModels').addEventListener('click', () => {
        const apiKey = $('xbApiKey').value.trim();
        if (!apiKey) {
            addLogEntry('请先输入 API Key', 'error');
            $('xbApiKey').style.borderColor = 'var(--xb-error)';
            setTimeout(() => { $('xbApiKey').style.borderColor = ''; }, 2000);
            return;
        }
        const isOpen = $('xbSwitchApi').classList.contains('on');
        const openaiUrl = normalizeBaseUrl($('xbOpenaiUrl').value);
        if (isOpen && !openaiUrl) {
            addLogEntry('请先填写 OpenAI 接口地址', 'error');
            return;
        }
        const btn = $('xbBtnFetchModels');
        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line"></i> 获取中...';
        addLogEntry('正在获取模型列表...', 'info');

        // 通过 background service worker 真实请求 /models 接口
        fetchModelsReqId = 'fm_' + Date.now();
        try {
            chrome.runtime.sendMessage({
                type: 'FETCH_MODELS',
                requestId: fetchModelsReqId,
                config: { type: isOpen ? 'openai' : 'deepseek', url: isOpen ? openaiUrl : '', key: apiKey }
            });
        } catch (e) {
            fetchModelsReqId = null;
            btn.disabled = false;
            btn.innerHTML = '<i class="ri-refresh-line"></i> 获取模型';
            addLogEntry('发送请求失败: ' + e.message, 'error');
        }
    });

    // background 处理完后通过 tabs.sendMessage 推回结果
    chrome.runtime.onMessage.addListener((message) => {
        if (!message || message.type !== 'FETCH_MODELS_RESPONSE') return;
        if (!fetchModelsReqId || message.requestId !== fetchModelsReqId) return;
        fetchModelsReqId = null;
        const btn = $('xbBtnFetchModels');
        btn.disabled = false;
        btn.innerHTML = '<i class="ri-refresh-line"></i> 获取模型';
        if (message.success) {
            const models = (message.data || [])
                .map(m => typeof m === 'string' ? m : (m.id || m.name))
                .filter(Boolean).sort();
            if (models.length === 0) {
                addLogEntry('接口未返回任何模型', 'warning');
            } else {
                populateModelSelect(models);
                // 自动选中：优先恢复上次使用的模型，不在列表中则选第一个
                readStoredSettings().then(s => {
                    const prev = $('xbSwitchApi').classList.contains('on') ? s.openaiModel : s.deepseekModel;
                    const toSelect = (prev && models.includes(prev)) ? prev : models[0];
                    selectModel(toSelect);
                    addLogEntry(`获取到 ${models.length} 个模型，已自动选择: ${toSelect}`, 'success');
                });
            }
        } else {
            addLogEntry(`获取模型失败: ${message.error || '未知错误'}`, 'error');
        }
    });

    window.addEventListener('message', event => {
        if (event.data?.source === 'xuexitong-bot-content') {
            const msg = event.data;
            if (msg.type === 'log') {
                // 统一入流：面板收到的日志经 XB.Log.display 写入渲染流，
                // 这样"实时显示 / 模式切换重放 / 导出"三方共用同一份数据。
                // 此前只走 addLogEntry 直接上屏、不入流，导致切换模式重放时面板空白
                if (typeof XB !== 'undefined' && XB.Log && XB.Log.display) {
                    XB.Log.display(msg.text, msg.level || 'info', msg.uiLevel || null);
                } else {
                    // XB.Log 未就绪时的兜底直渲
                    addLogEntry(msg.text, msg.level || 'info', { skipDetail: true });
                    logState.logs.push({ text: msg.text, type: msg.level || 'info', time: Date.now() });
                }
            }
            else if (msg.type === 'progress') { $('xbProgress').textContent = `${msg.current}/${msg.total}`; }
            else if (msg.type === 'finished') {
                isAnswering = false; isBrushing = false;
                $('xbBtnStart').classList.remove('active');
                $('xbBtnStart').innerHTML = '<i class="ri-play-fill xb-btn-icon"></i>开始答题';
                $('xbBtnBrush').classList.remove('active');
                $('xbBtnBrush').innerHTML = '<i class="ri-book-open-fill xb-btn-icon"></i>刷课';
                addLogEntry('任务完成！', 'success');
            }
        }
    });

    // ========== 初始化 ==========
    const mainEl = $('xbViewMain');
    const mainHeight = mainEl.offsetHeight;
    document.documentElement.style.setProperty('--view-height', mainHeight + 'px');

    // 版本号从 manifest 动态读取，避免硬编码不同步
    try {
        const v = chrome.runtime.getManifest().version;
        if (v) $('xbVersion').textContent = 'v' + v;
    } catch (e) {}

    connectLogSystem();
    setTimeout(connectLogSystem, 500);
    setTimeout(connectLogSystem, 1500);

    // 先恢复日志模式（异步读 storage），再按该模式决定是否渲染历史日志
    syncLogModeButtons().then(restoreHistoryLogs);

    // 课程切换自动恢复：学习通内部跳转课程/章节时 content 脚本不会重载，
    // 面板仍是旧实例。轮询 URL，变化时直接重新从全局拉取历史日志
    //（restoreHistoryLogs 可重复调用，内部覆盖内存并全量重放），
    // 避免需要手动刷新才能看到其他页面的日志。
    let trackedUrl = window.location.href;
    setInterval(async () => {
        const currentUrl = window.location.href;
        if (currentUrl === trackedUrl) return;
        trackedUrl = currentUrl;

        await restoreHistoryLogs();
    }, 2000);

    // 主页（如 i.chaoxing.com/base）等 SPA 页面 URL 几乎不变，且后台标签页的
    // 实时广播可能被挂起/冻结吞掉，仅靠 URL 轮询无法触发恢复。
    // 因此在标签页重新可见时、以及周期性兜底（仅当全局日志有变化时才重放，
    // 避免无变化时反复清屏导致滚动跳动），主动补拉全局日志。
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (typeof XB !== 'undefined' && XB.Log && XB.Log.restoreHistoryLogsIfChanged) {
            XB.Log.restoreHistoryLogsIfChanged();
        }
    });
    setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (typeof XB !== 'undefined' && XB.Log && XB.Log.restoreHistoryLogsIfChanged) {
            XB.Log.restoreHistoryLogsIfChanged();
        }
    }, 10000);

    loadSettings();

    updateBackButton();
})();
