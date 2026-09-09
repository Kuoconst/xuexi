// utils/api.js - API 请求工具（通过 background 中转）

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;
    const Config = XB.Config;

    XB.Utils = XB.Utils || {};

    /**
     * 生成唯一请求 ID
     */
    function _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 通过 background 获取模型列表
     */
    function fetchModels(config) {
        return new Promise((resolve, reject) => {
            const requestId = _generateRequestId();

            // 临时监听响应
            const handler = (message) => {
                if (message && message.type === 'FETCH_MODELS_RESPONSE' && message.requestId === requestId) {
                    chrome.runtime.onMessage.removeListener(handler);
                    if (message.success) {
                        resolve(message.data);
                    } else {
                        reject(new Error(message.error || '获取模型失败'));
                    }
                }
            };
            chrome.runtime.onMessage.addListener(handler);

            // 设置超时
            const timeoutId = setTimeout(() => {
                chrome.runtime.onMessage.removeListener(handler);
                reject(new Error('获取模型超时'));
            }, Config.API_TIMEOUT);

            // 保存 timeoutId
            const originalHandler = handler;
            const wrappedHandler = (message) => {
                if (message && message.type === 'FETCH_MODELS_RESPONSE' && message.requestId === requestId) {
                    clearTimeout(timeoutId);
                }
                originalHandler(message);
            };
            chrome.runtime.onMessage.removeListener(handler);
            chrome.runtime.onMessage.addListener(wrappedHandler);

            // 发送请求
            chrome.runtime.sendMessage({
                type: 'FETCH_MODELS',
                requestId: requestId,
                config: config
            }, (response) => {
                if (chrome.runtime.lastError) {
                    clearTimeout(timeoutId);
                    chrome.runtime.onMessage.removeListener(wrappedHandler);
                    reject(new Error(chrome.runtime.lastError.message));
                }
            });
        });
    }

    // 导出
    XB.Utils.fetchModels = fetchModels;
})();
