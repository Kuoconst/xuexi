// main.js - 入口文件（BotController 组装所有模块）

(function() {
    'use strict';

    console.log('[Bot] main.js 已加载');

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;
    const Config = XB.Config;

    /**
     * BotController - 总控制器
     */
    class BotController {
        constructor() {
            this._isRunning = false;
            this._config = null;
            this._interval = 1000;
            this._rewriteMode = true;
            this._brushConfig = { ...Config.DEFAULT_BRUSH_CONFIG };
            this._answerConfig = { ...Config.DEFAULT_ANSWER_CONFIG };
            this._isAnsweringActive = false;

            // 初始化模块
            this._messageBus = new XB.MessageBus();
            this._fontDecryptor = new XB.FontDecryptor();
            this._questionDetector = new XB.QuestionDetector();
            this._aiClient = new XB.AIClient();
            this._answerFiller = new XB.AnswerFiller();
            this._coursePlayer = new XB.CoursePlayer(this._messageBus, this._aiClient);

            // 初始化 AI 消息处理
            this._aiClient.initMessageHandler();
        }

        /**
         * 初始化
         */
        init() {
            // 清除旧的运行状态
            chrome.storage.local.get(['runningConfig'], (result) => {
                if (result.runningConfig && result.runningConfig.isRunning) {
                    chrome.storage.local.set({ runningConfig: { isRunning: false } });
                }
            });

            // 页面会话起点标记：导出文件中区分每次刷新的边界
            if (typeof XB !== 'undefined' && XB.Log) {
                XB.Log.system('脚本注入（页面加载）', { url: window.location.href, title: document.title });
            }

            // 监听来自 float-panel 和 popup 的消息
            this._messageBus.onMessage((message) => this._handleStartMessage(message));
            this._messageBus.onRuntimeMessage((message, sender, sendResponse) => this._handleRuntimeMessage(message, sendResponse));

            // 页面加载时检查恢复
            window.addEventListener('load', () => this._checkAndRestore());

            console.log('[Bot] 初始化完成');
        }

        /**
         * 处理启动消息
         */
        _handleStartMessage(message) {
            if (message.type === 'startAnswer') {
                if (this._isAnsweringActive || this._isRunning) {
                    // 已在运行中，只更新配置
                    this._config = message.config;
                    this._brushConfig = message.brushConfig || this._brushConfig;
                    this._answerConfig = message.answerConfig || this._answerConfig;
                    // 让新配置立即对运行中的模块生效
                    if (message.config) this._aiClient.setConfig(message.config);
                    if (message.brushConfig) this._coursePlayer.setConfig(message.brushConfig);
                    return;
                }

                this._config = message.config;
                this._interval = message.interval;
                this._rewriteMode = message.rewriteMode !== false;
                this._brushConfig = message.brushConfig || this._brushConfig;
                this._answerConfig = message.answerConfig || this._answerConfig;
                this._isRunning = true;

                this._aiClient.setConfig(this._config);
                this._coursePlayer.setConfig(this._brushConfig);
                        this._coursePlayer.setAnswerConfig(this._answerConfig);

                chrome.storage.local.set({
                    runningConfig: {
                        config: this._config,
                        interval: this._interval,
                        rewriteMode: this._rewriteMode,
                        brushConfig: this._brushConfig,
                        answerConfig: this._answerConfig,
                        isRunning: true,
                        startTime: Date.now()
                    }
                });

                setTimeout(() => this._startAnswering(), 500);

            } else if (message.type === 'stopAnswer') {
                this.stop();
            }
        }

        /**
         * 处理 runtime 消息
         */
        _handleRuntimeMessage(message, sendResponse) {
            if (message.type === 'startAnswer') {
                this._handleStartMessage(message);
            } else if (message.type === 'stopAnswer') {
                this.stop();
            } else if (message.type === 'getStatus') {
                // popup 查询状态：必须通过 sendResponse 回传
                if (sendResponse) {
                    sendResponse({
                        isRunning: this._isRunning,
                        config: this._config,
                        interval: this._interval
                    });
                }
            }
        }

        /**
         * 停止
         */
        stop() {
            this._isRunning = false;
            this._coursePlayer.setRunning(false);
            chrome.storage.local.set({ runningConfig: { isRunning: false } });
        }

        /**
         * 开始答题
         */
        async _startAnswering() {
            if (this._isAnsweringActive) return;
            this._isAnsweringActive = true;

            try {
                // 刷课模式
                if (this._brushConfig.enabled) {
                    this._coursePlayer.setRunning(true);
                    await this._coursePlayer.start();
                    // start() 多条退出路径已保证通知一次，此处仅幂等兜底
                    this._coursePlayer.notifyFinishedIfNeeded();
                    return;
                }

                // 答题模式
                this._messageBus.sendLog('开始检测题目...', 'info', 'hidden');

                // 记录系统日志（配置摘要不含 API Key，防止泄露）
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.system('开始答题', {
                        url: window.location.href,
                        pageTitle: document.title,
                        apiType: this._config ? this._config.type : null,
                        model: this._config ? this._config.model : null,
                        interval: this._interval,
                        rewriteMode: this._rewriteMode,
                        brushConfig: this._brushConfig,
                        answerConfig: this._answerConfig
                    });
                }

                const pageType = this._questionDetector.detectPageType();
                this._messageBus.sendLog(`页面类型: ${pageType}`, 'info', 'hidden');

                // 查找题目
                const questionElements = this._findQuestions();
                const total = questionElements.length;

                this._messageBus.sendLog(`检测到 ${total} 道题目`, 'info', 'hidden');

                if (total === 0) {
                    this._messageBus.sendLog('当前页面没有检测到可作答的题目', 'warning');
                    this._messageBus.sendLog('提示：请打开作业、考试或练习页面后再点「开始答题」；面板按钮已自动复位', 'info');
                    this._messageBus.sendFinished();
                    return;
                }

                this._messageBus.sendProgress(0, total);

                let answeredCount = 0;

                for (let i = 0; i < total; i++) {
                    if (!this._isRunning) {
                        this._messageBus.sendLog('答题已停止', 'warning');
                        return;
                    }

                    const element = questionElements[i];
                    // 按需字体解密：仅当题目命中 font-cxsecret 加密标记时
                    // 才临时调用解密模块处理其所属文档，随后重新提取明文题干
                    if (await this._fontDecryptor.ensureForElement(element)) {
                        this._messageBus.sendLog(`第${i + 1}题 检测到加密字体，已按需解密`, 'info', 'hidden');
                    }
                    const question = this._questionDetector.extractQuestion(element);
                    const typeName = XB.Utils.getTypeName(question.type);

                    // 记录题目详细日志
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.question(i + 1, question);
                    }

                    // 检查是否已作答
                    const existingAnswer = element.querySelector('.check_answer, .check_answer_dx');
                    if (existingAnswer && !this._rewriteMode) {
                        this._messageBus.sendLog(`第${i + 1}题 [${typeName}] 已作答，跳过`, 'success');
                        this._messageBus.sendProgress(i + 1, total);
                        continue;
                    }

                    // 获取答案
                    this._messageBus.sendLog(`第${i + 1}题 [${typeName}] 开始处理...`, 'info', 'hidden');

                    let answer = await this._aiClient.getAnswer(question);

                    // AI 失败时，尝试随机填充
                    if (!answer && this._answerConfig.randomFill) {
                        this._messageBus.sendLog(`第${i + 1}题 [${typeName}] AI失败，尝试随机填充...`, 'info');
                        answer = this._getRandomFillAnswer(question);
                    }

                    if (answer) {
                        const success = await this._answerFiller.fill(element, question, answer);
                        // 简洁层核心行：第N题 [题型] 答案: X
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.fill(i + 1, typeName, answer, success);
                        }
                        if (success) {
                            answeredCount++;
                        } else {
                            this._messageBus.sendLog(`第${i + 1}题 [${typeName}] 填入失败`, 'error');
                        }
                    } else {
                        this._messageBus.sendLog(`第${i + 1}题 [${typeName}] 获取答案失败`, 'error');
                    }

                    await XB.Utils.waitForQuestionConfirmed(element, question.type);
                    this._messageBus.sendProgress(i + 1, total);

                    if (i < total - 1 && this._isRunning) {
                        // 使用用户设置的答题间隔（毫秒），未设置时用默认值
                        await XB.Utils.sleep(this._interval || Config.QUESTION_INTERVAL);
                    }
                }

                // 提交或保存
                this._submitOrSave(answeredCount, total, this._answerConfig && this._answerConfig.autoSubmit === true);

                chrome.storage.local.set({ runningConfig: { isRunning: false } });
                this._messageBus.sendFinished();

            } catch (error) {
                this._messageBus.sendLog(`答题过程出错: ${error.message}`, 'error');
                chrome.storage.local.set({ runningConfig: { isRunning: false } });
                this._messageBus.sendFinished();
            } finally {
                // 必须完整复位运行状态：否则下次点击会被"已在运行中"分支吞掉，
                // 表现为面板按钮永远卡住、任务不再启动
                this._isRunning = false;
                this._coursePlayer.setRunning(false);
                this._isAnsweringActive = false;
            }
        }

        /**
         * 查找所有题目
         */
        _findQuestions() {
            const selectors = XB.Selectors.QUESTION;

            for (const selector of selectors) {
                const elements = XB.Utils.findInAllIframes(document, selector);
                if (elements.length > 0) {
                    // 记录命中情况：排查"找不到题目"类问题的关键线索
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('FIND', `题目容器命中`, { selector: selector, count: elements.length });
                    }
                    return this._questionDetector.deduplicateQuestions(elements);
                }
            }

            if (typeof XB !== 'undefined' && XB.Log) {
                XB.Log.detail('FIND', '所有题目选择器均未命中', { tried: selectors });
            }
            return [];
        }

        /**
         * 提交或保存（三步提交：保存 -> 提交 -> 确认）
         */
        async _submitOrSave(answeredCount, total, autoSubmit = false) {
            // 提交步骤的中间日志均为 hidden（简洁层只看结果行）
            const HIDDEN = 'hidden';
            const doSubmit = answeredCount === total && autoSubmit;

            // 按钮可能在嵌套 iframe 内，必须递归查找（仅查顶层文档会找不到）
            const findEl = (selector) => {
                try {
                    return XB.Utils.findInAllIframes(document, selector)[0] || null;
                } catch (e) {
                    return null;
                }
            };

            if (!doSubmit) {
                // 关闭了自动提交（或部分完成）：仅保存不交卷
                let saveBtn = null;
                try {
                    saveBtn = XB.Utils.findInAllIframes(document, XB.Selectors.SAVE_BTN)[0] || null;
                } catch (e) {}
                if (saveBtn) {
                    try {
                        XB.Utils.executeOnclick(saveBtn);
                        this._messageBus.sendLog('已保存', 'success', HIDDEN);
                    } catch (e) {}
                }
                if (answeredCount > 0) {
                    this._messageBus.sendLog(
                        autoSubmit
                            ? `部分题目未完成(${answeredCount}/${total})，已保存不提交`
                            : '未开启自动提交，答案已保存，请手动交卷',
                        'warning');
                }
                return;
            }

            if (answeredCount === total) {
                // 全部成功且开启自动提交 -> 三步提交
                this._messageBus.sendLog('答题完成，正在提交...', 'info', HIDDEN);

                // 步骤1：点击保存按钮
                const saveBtn = findEl(XB.Selectors.SAVE_BTN);
                if (saveBtn) {
                    try {
                        XB.Utils.executeOnclick(saveBtn);
                        this._messageBus.sendLog('已点击保存按钮', 'success', HIDDEN);
                        await XB.Utils.sleep(1000);
                    } catch (e) {
                        this._messageBus.sendLog(`点击保存按钮失败: ${e.message}`, 'warning');
                    }
                }

                // 步骤2：点击提交按钮
                const submitBtn = findEl(XB.Selectors.SUBMIT_BTN);
                if (submitBtn) {
                    try {
                        XB.Utils.executeOnclick(submitBtn);
                        this._messageBus.sendLog('已点击提交按钮', 'success', HIDDEN);
                        await XB.Utils.sleep(2000);
                    } catch (e) {
                        this._messageBus.sendLog(`点击提交按钮失败: ${e.message}`, 'warning');
                    }

                    // 步骤3：点击确认弹窗
                    const confirmBtn = findEl(XB.Selectors.CONFIRM_BTN);
                    if (confirmBtn) {
                        XB.Utils.executeOnclick(confirmBtn);
                        this._messageBus.sendLog('已确认提交', 'success', HIDDEN);
                    }

                    // 关闭弹窗
                    try {
                        const workpop = findEl(XB.Selectors.WORKPOP);
                        if (workpop) workpop.style.display = 'none';
                    } catch (e) {}

                    // 简洁层结果行
                    this._messageBus.sendLog(`已自动提交（${answeredCount}/${total}）`, 'success');
                } else {
                    this._messageBus.sendLog('未找到提交按钮，请手动提交', 'warning');
                }

            } else if (answeredCount > 0) {
                // 部分成功 -> 仅保存不提交
                this._messageBus.sendLog(`部分题目未完成(${answeredCount}/${total})，仅保存不提交`, 'warning');
                let saveBtn = null;
                try {
                    saveBtn = XB.Utils.findInAllIframes(document, XB.Selectors.SAVE_BTN)[0] || null;
                } catch (e) {}
                if (saveBtn) {
                    try {
                        XB.Utils.executeOnclick(saveBtn);
                        this._messageBus.sendLog('已保存', 'success');
                    } catch (e) {
                        this._messageBus.sendLog(`保存失败: ${e.message}`, 'warning');
                    }
                }
            } else {
                // 全部失败
                this._messageBus.sendLog('所有题目答题失败', 'error');
            }
        }

        /**
         * 随机填充答案（fallback）
         */
        _getRandomFillAnswer(question) {
            const type = question.type;
            const Types = XB.Types;

            if (type === Types.SINGLE || type === Types.JUDGE) {
                if (question.options.length > 0) {
                    const idx = Math.floor(Math.random() * question.options.length);
                    return question.options[idx].letter;
                }
            } else if (type === Types.MULTIPLE) {
                if (question.options.length > 0) {
                    const count = Math.floor(Math.random() * Math.min(4, question.options.length)) + 1;
                    const shuffled = [...question.options].sort(() => Math.random() - 0.5);
                    return shuffled.slice(0, count).map(o => o.letter).sort().join('');
                }
            } else if (type === Types.BLANK || type === Types.ESSAY) {
                const fillPool = ['不会', '不知道', '不确定', '不了解', '不清楚'];
                return fillPool[Math.floor(Math.random() * fillPool.length)];
            }

            return null;
        }

        /**
         * 检查并恢复运行
         */
        async _checkAndRestore() {
            if (this._isAnsweringActive || this._isRunning) return;

            if (!this._isCourseRelatedPage()) {
                chrome.storage.local.set({ runningConfig: { isRunning: false } });
                return;
            }

            try {
                const result = await chrome.storage.local.get(['runningConfig']);
                if (result.runningConfig && result.runningConfig.isRunning) {
                    const elapsed = Date.now() - result.runningConfig.startTime;
                    if (elapsed < Config.RESTORE_WINDOW) {
                        this._config = result.runningConfig.config;
                        this._interval = result.runningConfig.interval;
                        this._rewriteMode = result.runningConfig.rewriteMode;
                        this._brushConfig = result.runningConfig.brushConfig || this._brushConfig;
                        this._answerConfig = result.runningConfig.answerConfig || this._answerConfig;
                        this._isRunning = true;

                        this._aiClient.setConfig(this._config);
                        this._coursePlayer.setConfig(this._brushConfig);
                        this._coursePlayer.setAnswerConfig(this._answerConfig);

                        this._startAnswering();
                    } else {
                        chrome.storage.local.set({ runningConfig: { isRunning: false } });
                    }
                }
            } catch (e) {}
        }

        /**
         * 检测是否为课程相关页面
         */
        _isCourseRelatedPage() {
            const url = window.location.href;
            return url.includes('/mycourse/') ||
                   url.includes('/knowledge/cards') ||
                   url.includes('/mooc-ans/') ||
                   url.includes('/exam-ans/') ||
                   url.includes('/work/dowork');
        }
    }

    // 创建并初始化 Bot
    XB.bot = new BotController();
    XB.bot.init();
})();
