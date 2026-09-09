// utils/dom.js - DOM 操作工具函数

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;

    XB.Utils = XB.Utils || {};

    /**
     * 检查选项是否已选中
     */
    function isOptionSelected(optionElement) {
        if (!optionElement) return false;
        const span = optionElement.querySelector('span');
        if (span) {
            return span.classList.contains('check_answer') ||
                   span.classList.contains('check_answer_dx') ||
                   optionElement.getAttribute('aria-checked') === 'true';
        }
        return false;
    }

    /**
     * 执行元素的 onclick 属性（统一处理函数调用和直接执行）
     */
    function executeOnclick(element) {
        if (!element) return false;

        const onclickAttr = element.getAttribute('onclick');
        if (!onclickAttr) {
            element.click();
            return true;
        }

        const funcMatch = onclickAttr.match(/^(\w+)\(this,?\s*['"]?([^'")\s]*)['"]?\s*\)/);
        if (funcMatch) {
            const funcName = funcMatch[1];
            const funcParam = funcMatch[2];

            if (typeof window[funcName] === 'function') {
                window[funcName](element, funcParam);
                return true;
            }
        }

        try {
            new Function(onclickAttr).call(element);
            return true;
        } catch (e) {
            element.click();
            return true;
        }
    }

    /**
     * 获取填空题信息
     * @param {Element} element - 题目元素
     * @param {number} [fallbackCount] - 拿不到 blankNum 输入框时的兜底空数（如答案按 | 拆分后的数量）
     */
    function getBlankInfo(element, fallbackCount) {
        const questionId = element.getAttribute('data');
        const blankNumEl = element.querySelector(`input[name="blankNum${questionId}"]`);
        const blankCount = blankNumEl ? parseInt(blankNumEl.value) : (fallbackCount || 1);

        const getTextarea = (idx) => {
            const name = `answerEditor${questionId}${idx}`;
            return element.querySelector(`textarea[name="${name}"]`);
        };

        return { questionId, blankCount, getTextarea };
    }

    /**
     * 获取简答题 textarea
     */
    function getEssayTextarea(element) {
        const questionId = element.getAttribute('data');
        return {
            questionId,
            textarea: element.querySelector(`textarea[name="answer${questionId}"]`)
        };
    }

    /**
     * 获取 UEditor iframe body
     * @param {Element} element - 题目元素
     * @param {Element} [refEl] - 可选参照元素（如当前空的 textarea），按其就近定位编辑器，
     *                            多空填空题每个空有独立编辑器时必须传入，否则会写错位置
     */
    function getUEditorBody(element, refEl) {
        let editorContainer = null;

        if (refEl && refEl.parentElement) {
            editorContainer = refEl.parentElement.querySelector('.edui-editor');
        }
        if (!editorContainer) {
            editorContainer = element.querySelector('.edui-editor');
        }
        if (!editorContainer) return null;

        const iframe = editorContainer.querySelector('iframe');
        if (!iframe || !iframe.contentDocument) return null;

        return iframe.contentDocument.body;
    }

    /**
     * 设置 UEditor 内容
     */
    function setUEditorContent(element, html, refEl) {
        const body = getUEditorBody(element, refEl);
        if (!body) return false;

        body.innerHTML = `<p>${html}</p>`;
        return true;
    }

    /**
     * 匹配题型（根据文本内容）
     */
    function matchType(text) {
        if (!text) return null;

        const Types = XB.Types;
        const keywords = Types.KEYWORDS;

        for (const [type, words] of Object.entries(keywords)) {
            if (words.some(w => text.includes(w))) {
                return type;
            }
        }
        return null;
    }

    /**
     * 题型枚举转中文名
     */
    function getTypeName(type) {
        return XB.Types.NAMES[type] || '未知';
    }

    // 导出
    XB.Utils.isOptionSelected = isOptionSelected;
    XB.Utils.executeOnclick = executeOnclick;
    XB.Utils.getBlankInfo = getBlankInfo;
    XB.Utils.getEssayTextarea = getEssayTextarea;
    XB.Utils.getUEditorBody = getUEditorBody;
    XB.Utils.setUEditorContent = setUEditorContent;
    XB.Utils.matchType = matchType;
    XB.Utils.getTypeName = getTypeName;
})();
