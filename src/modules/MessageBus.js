// modules/MessageBus.js - 消息通信模块

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;

    class MessageBus {
        constructor() {
            this._sourceContent = 'xuexitong-bot-content';
            this._sourcePanel = 'xuexitong-bot-panel';
        }

        /**
         * 广播消息（双通道：chrome.runtime + window.postMessage）
         */
        _broadcast(message) {
            // 通道1：发送给 background -> popup
            try {
                chrome.runtime.sendMessage(message);
            } catch (e) {}

            // 通道2：发送给页面内的 float-panel
            try {
                window.postMessage({ source: this._sourceContent, ...message }, '*');
            } catch (e) {}
        }

        /**
         * 发送日志
         * 所有运行日志（答题/刷课/提交等流程）同时写入详细日志，供导出排查
         */
        sendLog(text, level = 'info', uiLevel = null) {
            try {
                if (window.XuexitongBot && window.XuexitongBot.Log) {
                    window.XuexitongBot.Log.detail('RUN', text, null, true); // 已广播显示，详细模式不重复打印
                }
            } catch (e) {}

            this._broadcast({
                type: 'log',
                text,
                level,
                uiLevel
            });
        }

        /**
         * 发送进度
         */
        sendProgress(current, total) {
            this._broadcast({
                type: 'progress',
                current,
                total
            });
        }

        /**
         * 发送完成通知
         */
        sendFinished() {
            this._broadcast({
                type: 'finished'
            });
        }

        /**
         * 发送状态
         */
        sendStatus(status) {
            this._broadcast({
                type: 'status',
                status
            });
        }

        /**
         * 监听来自 float-panel 的消息
         */
        onMessage(callback) {
            window.addEventListener('message', (event) => {
                if (event.data && event.data.source === this._sourcePanel) {
                    callback(event.data);
                }
            });
        }

        /**
         * 监听来自 chrome.runtime 的消息
         */
        onRuntimeMessage(callback) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                // 仅当 callback 显式返回 true 时才承诺异步响应；否则返回 false 让通道
                // 立即关闭。避免对无响应的跨页广播消息（LOG_APPEND/LOG_CLEAR_DISPLAY 等）
                // 报 "message channel closed before a response was received"
                return callback(message, sender, sendResponse) === true;
            });
        }
    }

    XB.MessageBus = MessageBus;
})();
