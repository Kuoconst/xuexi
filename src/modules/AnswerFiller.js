// modules/AnswerFiller.js - 答案填入模块（策略模式）

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;
    const Types = XB.Types;
    const Utils = XB.Utils;
    const Config = XB.Config;

    class AnswerFiller {
        constructor() {
            // 策略映射：题型 -> 填入方法
            this._strategies = {
                [Types.SINGLE]: this._fillSingle.bind(this),
                [Types.MULTIPLE]: this._fillMultiple.bind(this),
                [Types.JUDGE]: this._fillJudge.bind(this),
                [Types.BLANK]: this._fillBlank.bind(this),
                [Types.ESSAY]: this._fillEssay.bind(this)
            };
        }

        /**
         * 根据题型选择策略填入答案
         */
        async fill(element, question, answer) {
            if (!answer) return false;

            const strategy = this._strategies[question.type];
            if (!strategy) {
                console.warn('[AnswerFiller] 未知题型:', question.type);
                return false;
            }

            try {
                return await strategy(element, answer, question.options);
            } catch (error) {
                console.error('[AnswerFiller] 填入失败:', error);
                return false;
            }
        }

        /**
         * 单选题填入
         */
        async _fillSingle(element, answer, options) {
            const letter = answer.toUpperCase().charAt(0);
            const targetOption = options.find(o => o.letter === letter) ||
                                options.find(o => o.data === letter);

            if (!targetOption) {
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.detail('FILL', `选项 ${letter} 未找到对应选项元素`);
                }
                return false;
            }

            if (Utils.isOptionSelected(targetOption.element)) {
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.detail('FILL', `选项 ${letter} 已选中，跳过`);
                }
                return true;
            }

            // 优先使用 onclick 调用
            Utils.executeOnclick(targetOption.element);
            if (typeof XB !== 'undefined' && XB.Log) {
                XB.Log.detail('FILL', `选项 ${letter} 点击选中`);
            }

            await Utils.waitForCondition(
                () => Utils.isOptionSelected(targetOption.element),
                Config.DEFAULT_TIMEOUT
            );

            return true;
        }

        /**
         * 多选题填入
         */
        async _fillMultiple(element, answer, options) {
            const letters = answer.toUpperCase().split('');
            let clickedCount = 0;

            for (const letter of letters) {
                const targetOption = options.find(o => o.letter === letter) ||
                                    options.find(o => o.data === letter);

                if (targetOption) {
                    if (Utils.isOptionSelected(targetOption.element)) {
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('FILL', `选项 ${letter} 已选中，跳过`);
                        }
                        clickedCount++;
                        continue;
                    }

                    Utils.executeOnclick(targetOption.element);
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('FILL', `选项 ${letter} 点击选中`);
                    }
                    clickedCount++;
                    await Utils.waitForCondition(
                        () => Utils.isOptionSelected(targetOption.element),
                        Config.DEFAULT_TIMEOUT
                    );
                } else {
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('FILL', `选项 ${letter} 未找到对应选项元素`);
                    }
                }
            }

            return clickedCount > 0;
        }

        /**
         * 判断题填入
         */
        async _fillJudge(element, answer, options) {
            const isTrueAnswer = answer.includes('对');

            // 方式1：匹配 data 属性
            for (const opt of options) {
                const data = opt.data;
                if ((isTrueAnswer && data === 'true') || (!isTrueAnswer && data === 'false')) {
                    if (Utils.isOptionSelected(opt.element)) {
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('FILL', `选项 ${opt.text.trim()} 已选中，跳过`);
                        }
                        return true;
                    }
                    Utils.executeOnclick(opt.element);
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('FILL', `选项 ${opt.text.trim()} 点击选中`);
                    }
                    await Utils.waitForCondition(() => Utils.isOptionSelected(opt.element), Config.DEFAULT_TIMEOUT);
                    return true;
                }
            }

            // 方式2：匹配文本
            for (const opt of options) {
                const text = opt.text.trim();
                if ((isTrueAnswer && text === '对') || (!isTrueAnswer && text === '错')) {
                    if (Utils.isOptionSelected(opt.element)) {
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('FILL', `选项 ${text} 已选中，跳过`);
                        }
                        return true;
                    }
                    Utils.executeOnclick(opt.element);
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('FILL', `选项 ${text} 点击选中`);
                    }
                    await Utils.waitForCondition(() => Utils.isOptionSelected(opt.element), Config.DEFAULT_TIMEOUT);
                    return true;
                }
            }

            return false;
        }

        /**
         * 填空题填入
         */
        async _fillBlank(element, answer) {
            const answers = answer.split('|');
            // 拿不到 blankNum 输入框时，用答案数量作为兜底空数（与旧版一致）
            const info = Utils.getBlankInfo(element, answers.length);
            let filledCount = 0;

            for (let i = 1; i <= info.blankCount && i <= answers.length; i++) {
                const textarea = info.getTextarea(i);
                if (!textarea) continue;

                if (textarea.value && textarea.value.trim()) {
                    filledCount++;
                    continue;
                }

                const blankAnswer = answers[i - 1].trim();
                const escaped = this._escapeHtml(blankAnswer);

                // 尝试通过 UEditor 设置（传入当前 textarea 就近定位对应的编辑器）
                if (Utils.setUEditorContent(element, escaped, textarea)) {
                    textarea.value = blankAnswer;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    filledCount++;
                    continue;
                }

                // 降级：直接设置 textarea
                textarea.value = blankAnswer;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
            }

            return filledCount > 0;
        }

        /**
         * 简答题填入
         */
        async _fillEssay(element, answer) {
            const info = Utils.getEssayTextarea(element);

            if (info.textarea && info.textarea.value && info.textarea.value.trim()) {
                return true;
            }

            const escapedAnswer = this._escapeHtml(answer);

            // 方式1：通过 UEditor 设置
            if (Utils.setUEditorContent(element, escapedAnswer)) {
                if (info.textarea) {
                    info.textarea.value = answer;
                    info.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
                this._clickSaveButton(element);
                return true;
            }

            // 方式2：直接设置 textarea
            if (info.textarea) {
                info.textarea.value = answer;
                info.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                info.textarea.dispatchEvent(new Event('change', { bubbles: true }));
                this._clickSaveButton(element);
                return true;
            }

            return false;
        }

        /**
         * HTML 转义
         */
        _escapeHtml(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * 点击保存按钮
         */
        _clickSaveButton(element) {
            const saveBtn = element.querySelector('.saveButtonClass');
            if (saveBtn) {
                saveBtn.style.display = 'block';
                Utils.executeOnclick(saveBtn);
            }
        }
    }

    XB.AnswerFiller = AnswerFiller;
})();
