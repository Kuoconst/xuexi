// utils/iframe.js - iframe 操作工具函数

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;

    XB.Utils = XB.Utils || {};
    const Config = XB.Config;

    /**
     * 递归搜索所有 iframe 中的元素
     * 每次搜索会在详细日志中记录完整的递归轨迹：
     * 各层文档的命中数量与所经 iframe 的标识，便于排查"题目/视频找不到"类问题
     * @param {Document} doc - 起始文档
     * @param {string} selector - CSS 选择器
     * @param {number} maxDepth - 最大递归深度
     * @returns {Element[]} 找到的元素数组
     */
    function findInAllIframes(doc, selector, maxDepth = Config.MAX_DEPTH) {
        let results = [];
        let currentDepth = 0;
        const trail = []; // 递归轨迹：每层文档一行

        function describeDoc(currentDoc) {
            try {
                if (currentDoc === document) return '顶层document';
                const de = currentDoc.documentElement || currentDoc.body || {};
                const title = (currentDoc.title || de.tagName || '').toString().slice(0, 30);
                return `doc[${title}]`;
            } catch (e) {
                return 'doc[不可访问]';
            }
        }

        function search(currentDoc, depth, pathLabel) {
            if (depth > maxDepth) return;

            let hitCount = 0;
            let iframeDescs = [];
            try {
                const elements = currentDoc.querySelectorAll(selector);
                hitCount = elements.length;
                results.push(...Array.from(elements));

                const iframes = currentDoc.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    let iframeDoc = null;
                    try {
                        iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    } catch (e) {
                        iframeDescs.push(`<跨域阻断>`);
                        continue;
                    }
                    if (!iframeDoc) {
                        iframeDescs.push(`<未加载:${describeIframe(iframe)}>`);
                        continue;
                    }
                    // 标识当前 iframe：优先 id/class/module/src
                    iframeDescs.push(describeIframe(iframe));
                    search(iframeDoc, depth + 1, describeIframe(iframe));
                }
            } catch (e) {
                trail.push(`${pathLabel} [异常] ${e.message}`);
                return;
            }

            trail.push(`${pathLabel}: 命中${hitCount}个` +
                       (iframeDescs.length ? `; 下钻 ${iframeDescs.join(', ')}` : '; 无子iframe'));
        }

        function describeIframe(iframe) {
            try {
                const id = iframe.id ? `#${iframe.id}` : '';
                const cls = (iframe.className || '').toString().trim().split(/\s+/).slice(0, 2).join('.');
                const mod = iframe.getAttribute && iframe.getAttribute('module');
                const src = ((iframe.getAttribute && iframe.getAttribute('src')) || '').slice(0, 40);
                return `<${id}${cls ? '.' + cls : ''}${mod ? '[m:' + mod + ']' : ''} src=${src || '-'}>`;
            } catch (e) {
                return '<iframe>';
            }
        }

        search(doc, currentDepth, describeDoc(doc));

        // 递归轨迹写入详细日志（文件模式核心诉求：最易出 bug 的环节必须留痕）
        try {
            if (window.XuexitongBot && window.XuexitongBot.Log) {
                window.XuexitongBot.Log.detail('IFRAME',
                    `递归搜索 "${selector}" → 共命中 ${results.length} 个`,
                    { trail });
            }
        } catch (e) {}

        return results;
    }

    /**
     * 递归查找 iframe 中的单个元素（按钮等）
     * @param {Document} doc - 起始文档
     * @param {string} selector - CSS 选择器
     * @param {number} maxDepth - 最大递归深度
     * @returns {Element|null}
     */
    function findBtnInAllIframes(doc, selector, maxDepth = Config.MAX_DEPTH) {
        let currentDepth = 0;

        function search(currentDoc, depth) {
            if (depth > maxDepth) return null;

            try {
                const iframes = currentDoc.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const iframeDoc = iframe.contentDocument;
                        if (!iframeDoc) continue;

                        const btn = iframeDoc.querySelector(selector);
                        if (btn) return btn;

                        const result = search(iframeDoc, depth + 1);
                        if (result) return result;
                    } catch (e) {}
                }
            } catch (e) {}

            return null;
        }

        return search(doc, currentDepth);
    }

    /**
     * 等待 iframe 加载完成
     * @param {string} iframeId - iframe 的 ID
     * @param {number} timeout - 超时时间
     * @returns {Promise<Element|null>}
     */
    function waitForIframeLoad(iframeId, timeout = Config.IFRAME_LOAD_TIMEOUT) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            function check() {
                const iframe = document.getElementById(iframeId);
                if (!iframe) {
                    if (Date.now() - startTime < timeout) {
                        setTimeout(check, 500);
                    } else {
                        resolve(null);
                    }
                    return;
                }

                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc && doc.readyState === 'complete') {
                        resolve(iframe);
                        return;
                    }
                } catch (e) {}

                if (Date.now() - startTime < timeout) {
                    setTimeout(check, 500);
                } else {
                    resolve(iframe);
                }
            }

            check();
        });
    }

    /**
     * 轮询等待条件满足
     * @param {Function} checkFn - 检查函数
     * @param {number} timeout - 超时时间
     * @param {number} interval - 轮询间隔
     * @returns {Promise<boolean>}
     */
    function waitForCondition(checkFn, timeout = Config.DEFAULT_TIMEOUT, interval = 200) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            function check() {
                try {
                    if (checkFn()) {
                        resolve(true);
                        return;
                    }
                } catch (e) {
                    // 检查函数出错，继续等待
                }

                if (Date.now() - startTime >= timeout) {
                    resolve(false);
                    return;
                }

                setTimeout(check, interval);
            }

            check();
        });
    }

    /**
     * 等待题目确认完成
     * @param {Element} element - 题目元素
     * @param {string} type - 题型
     * @param {number} timeout - 超时时间
     * @returns {Promise<boolean>}
     */
    function waitForQuestionConfirmed(element, type, timeout = Config.DEFAULT_TIMEOUT) {
        return waitForCondition(() => {
            // 检查是否有选中的选项
            const selected = element.querySelector('.check_answer, .check_answer_dx');
            if (selected) return true;

            // 检查判断题的 aria-checked
            const ariaChecked = element.querySelector('[aria-checked="true"]');
            if (ariaChecked) return true;

            // 填空题检测
            if (type === 'blank') {
                const info = XB.Utils.getBlankInfo(element);
                let filledCount = 0;
                for (let i = 1; i <= info.blankCount; i++) {
                    const textarea = info.getTextarea(i);
                    if (textarea && textarea.value && textarea.value.trim().length > 0) {
                        filledCount++;
                    }
                }
                return filledCount > 0;
            }

            // 简答题检测
            if (type === 'essay') {
                const info = XB.Utils.getEssayTextarea(element);
                if (info.textarea && info.textarea.value && info.textarea.value.trim().length > 0) {
                    return true;
                }
                const body = XB.Utils.getUEditorBody(element);
                if (body && body.textContent.trim().length > 0) {
                    return true;
                }
            }

            return false;
        }, timeout);
    }

    // 导出
    XB.Utils.findInAllIframes = findInAllIframes;
    XB.Utils.findBtnInAllIframes = findBtnInAllIframes;
    XB.Utils.waitForIframeLoad = waitForIframeLoad;
    XB.Utils.waitForCondition = waitForCondition;
    XB.Utils.waitForQuestionConfirmed = waitForQuestionConfirmed;
})();
