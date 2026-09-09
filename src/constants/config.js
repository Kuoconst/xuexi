// constants/config.js - 默认配置

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    window.XuexitongBot.Config = {
        // 超时配置（毫秒）
        DEFAULT_TIMEOUT: 3000,
        IFRAME_LOAD_TIMEOUT: 15000,
        VIDEO_TIMEOUT: 1800000, // 30分钟
        API_TIMEOUT: 120000,    // API调用超时（高思考档位响应更慢，需放宽）

        // 重试配置
        MAX_DEPTH: 10,
        MAX_RETRIES: 15,
        SCROLL_MAX_ROUNDS: 30,
        MAX_SCROLL_ATTEMPTS: 30,

        // 间隔配置（毫秒）
        QUESTION_INTERVAL: 500,
        CHAPTER_INTERVAL: 3000,
        TAB_INTERVAL: 3000,
        IFRAME_WAIT: 2000,

        // 视频配置
        VIDEO_END_THRESHOLD: 2, // 距离结束2秒视为完成

        // API 配置
        API_TEMPERATURE: 0.1,
        API_MAX_TOKENS: 2000,

        // 刷课默认配置
        DEFAULT_BRUSH_CONFIG: {
            enabled: false,
            videoSpeed: 1,
            muteVideo: true,
            autoNext: true,
            skipFinished: true,
            seekSkip: true
        },

        // 答题默认配置
        DEFAULT_ANSWER_CONFIG: {
            randomFill: false
        },

        // 运行状态恢复时间窗口（毫秒）
        RESTORE_WINDOW: 5 * 60 * 1000
    };
})();
