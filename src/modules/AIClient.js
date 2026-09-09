// modules/AIClient.js - LLM API 调用模块（通过 background service worker）
// 注意：此类不直接发起 fetch，而是通过 chrome.runtime.sendMessage 与 background 通信

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;
    const Types = XB.Types;
    const Config = XB.Config;

    class AIClient {
        constructor() {
            this._config = null;
            this._pendingRequests = new Map();
            this._messageHandler = null;
        }

        /**
         * 设置 API 配置
         */
        setConfig(config) {
            this._config = config;
        }

        /**
         * 获取 API 配置
         */
        getConfig() {
            return this._config;
        }

        /**
         * 生成唯一请求 ID
         */
        _generateRequestId() {
            return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * 组装 prompt
         */
        buildPrompt(question) {
            const type = question.type;
            const title = question.title;

            if (type === Types.SINGLE) {
                const optionsText = question.options.map(o => `${o.letter}. ${o.text}`).join('\n');
                return `请回答单选题，只返回一个大写字母，不要任何其他内容。\n\n题目：${title}\n选项：\n${optionsText}\n\n返回格式：A`;
            }

            if (type === Types.MULTIPLE) {
                const optionsText = question.options.map(o => `${o.letter}. ${o.text}`).join('\n');
                return `请回答多选题，只返回多个大写字母（如AB），不要任何其他内容。\n\n题目：${title}\n选项：\n${optionsText}\n\n返回格式：AB`;
            }

            if (type === Types.JUDGE) {
                return `请回答判断题，只返回"对"或"错"，不要任何其他内容。\n\n题目：${title}\n\n返回格式：对`;
            }

            if (type === Types.BLANK) {
                return `请回答填空题，要求：\n1. 用简短的一句话回答，不超过50字\n2. 多个答案用|分隔，不要换行\n3. 不要使用任何markdown格式（不要用**加粗**、不要用代码块）\n4. 不要解释，直接返回答案\n\n题目：${title}\n\n返回格式：答案1|答案2`;
            }

            if (type === Types.ESSAY) {
                return `请回答以下简答题，要求：\n1. 用200-300字回答\n2. 不要使用任何markdown格式（不要用**加粗**、不要用数字列表、不要用代码块）\n3. 用普通段落格式，像学生手写答案一样自然\n4. 可以适当加一些口语化表达，不要太完美\n5. 直接返回答案内容，不要包含"答案"等前缀\n\n题目：${title}`;
            }

            return null;
        }

        /**
         * 清理 LLM 原始响应
         */
        _cleanRawAnswer(rawAnswer) {
            let cleaned = rawAnswer.replace(/<think>[\s\S]*?<\/think>/g, '');
            cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
            cleaned = cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            cleaned = cleaned.replace(/\*\*/g, '');
            cleaned = cleaned.replace(/^(答案|选择|选|正确选项|正确答案)[：:是为]?\s*/i, '');
            cleaned = cleaned.replace(/^(是|为|：|:)\s*/i, '');
            return cleaned;
        }

        /**
         * 从清理后的答案中提取最终结果
         */
        parseAnswer(question, rawAnswer) {
            const cleanedAnswer = this._cleanRawAnswer(rawAnswer);
            const type = question.type;
            const optionLetters = question.options.map(o => o.letter);
            const letterPattern = optionLetters.join('');

            if (type === Types.SINGLE) {
                // 优先匹配独立的字母
                const independentMatch = cleanedAnswer.match(
                    new RegExp(`(?:^|\\s|：|:)([${letterPattern}])(?:\\s|$|，|,。|\\.|、|；|;)`)
                );
                if (independentMatch) return independentMatch[1];

                // 降级：匹配第一个出现的字母
                const match = cleanedAnswer.match(new RegExp(`([${letterPattern}])`));
                return match ? match[1] : null;
            }

            if (type === Types.MULTIPLE) {
                const matches = cleanedAnswer.match(new RegExp(`[${letterPattern}]`, 'g'));
                return matches ? [...new Set(matches)].sort().join('') : null;
            }

            if (type === Types.JUDGE) {
                const isWrong = cleanedAnswer.includes('错') ||
                                cleanedAnswer.includes('不正确') ||
                                cleanedAnswer.includes('不对') ||
                                cleanedAnswer.includes('错误') ||
                                cleanedAnswer.includes('不');
                return isWrong ? '错' : '对';
            }

            return cleanedAnswer;
        }

        /**
         * 调用 background 发送请求（核心方法，不直接 fetch）
         */
        async call(prompt) {
            if (!this._config) {
                throw new Error('API 配置未设置');
            }

            const requestId = this._generateRequestId();

            // 记录请求明细（不含密钥）
            if (typeof XB !== 'undefined' && XB.Log) {
                XB.Log.detail('API', `发起 LLM 请求`, {
                    requestId: requestId,
                    type: this._config.type,
                    model: this._config.model,
                    reasoningEffort: this._config.reasoningEffort || 'none',
                    promptLength: prompt.length
                });
            }

            return new Promise((resolve, reject) => {
                // 存储 pending 请求
                this._pendingRequests.set(requestId, { resolve, reject });

                // 设置超时
                const timeoutId = setTimeout(() => {
                    if (this._pendingRequests.has(requestId)) {
                        this._pendingRequests.delete(requestId);
                        reject(new Error('API 请求超时'));
                    }
                }, Config.API_TIMEOUT);

                // 保存 timeoutId 以便清理
                const pending = this._pendingRequests.get(requestId);
                if (pending) pending.timeoutId = timeoutId;

                // 发送消息给 background
                chrome.runtime.sendMessage({
                    type: 'API_CALL',
                    requestId: requestId,
                    config: this._config,
                    prompt: prompt
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        // 仅当请求仍在等待响应时才按失败处理。
                        // 真实结果经 tabs.sendMessage 推送并已 resolve 时，
                        // 这里的 lastError 只是通道关闭噪音，必须忽略
                        const pending = this._pendingRequests.get(requestId);
                        if (pending) {
                            this._pendingRequests.delete(requestId);
                            clearTimeout(pending.timeoutId);
                            pending.reject(new Error(chrome.runtime.lastError.message));
                        }
                    }
                });
            });
        }

        /**
         * 处理 background 返回的响应
         */
        _handleBackgroundResponse(message) {
            if (message.type === 'API_RESPONSE') {
                const { requestId, success, data, error } = message;
                const pending = this._pendingRequests.get(requestId);

                if (pending) {
                    clearTimeout(pending.timeoutId);
                    this._pendingRequests.delete(requestId);

                    if (success) {
                        pending.resolve(data);
                    } else {
                        // API 失败明细入档（错误原文来自 background 的 fetch 异常）
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('API', `LLM 请求失败`, { requestId: requestId, error: error || 'Unknown' });
                        }
                        pending.reject(new Error(error || 'Unknown API error'));
                    }
                }
            }
        }

        /**
         * 初始化消息监听
         */
        initMessageHandler() {
            this._messageHandler = (message) => {
                if (message && message.type === 'API_RESPONSE') {
                    this._handleBackgroundResponse(message);
                }
            };
            chrome.runtime.onMessage.addListener(this._messageHandler);
        }

        /**
         * 获取答案（组合 buildPrompt + call + parseAnswer）
         */
        async getAnswer(question) {
            const prompt = this.buildPrompt(question);
            if (!prompt) return null;

            const rawAnswer = await this.call(prompt);
            const parsed = this.parseAnswer(question, rawAnswer);

            // 记录详细日志
            if (typeof XB !== 'undefined' && XB.Log) {
                XB.Log.llm(prompt, rawAnswer, parsed);
            }

            return parsed;
        }

        /**
         * 销毁
         */
        destroy() {
            if (this._messageHandler) {
                chrome.runtime.onMessage.removeListener(this._messageHandler);
            }
            this._pendingRequests.clear();
        }
    }

    XB.AIClient = AIClient;
})();
