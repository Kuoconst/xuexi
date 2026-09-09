// modules/FontDecryptor.js - 字体解密模块

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;

    class FontDecryptor {
        constructor() {
            this._table = null;
            this._tableUrl = chrome.runtime.getURL('assets/table.json');
            // 已完成解密的文档集合：同一文档只解一次，避免重复构建映射表的开销
            this._decryptedDocs = new WeakSet();
        }

        /**
         * 按需解密入口（推荐使用，代替预先全量扫描）
         * 仅当元素内部仍带有 font-cxsecret 加密标记时，才对其所属文档执行解密；
         * 明文题目走零开销快速路径，不会加载 TyprMd5/table.json
         * @param {Element} element - 题目元素（可在任意嵌套 iframe 内）
         * @returns {Promise<boolean>} 本次调用是否发生了有效解密
         */
        async ensureForElement(element) {
            if (!element) return false;

            // 无加密标记 => 明文，直接跳过
            // （font-cxsecret 是学习通加密文本的官方标记类，比按字符区间猜测更准确）
            if (!element.querySelector('.font-cxsecret')) return false;

            const doc = element.ownerDocument;
            if (!doc) return false;

            // 该文档此前已解密过：标记仍在说明是残留，无需重复解密
            if (this._decryptedDocs.has(doc)) return false;

            const replaced = await this.decrypt(doc);
            if (replaced) {
                this._decryptedDocs.add(doc);
            }
            return replaced;
        }

        /**
         * 加载字体映射表
         */
        async loadTable() {
            if (this._table) return this._table;

            try {
                const response = await fetch(this._tableUrl);
                if (!response.ok) throw new Error('Failed to load table.json');
                this._table = await response.json();
                console.log('[FontDecryptor] 映射表加载成功');
                return this._table;
            } catch (error) {
                console.error('[FontDecryptor] 映射表加载失败:', error);
                return null;
            }
        }

        /**
         * 查找包含加密字体的 style 元素
         */
        findSecretStyle(doc = document) {
            return Array.from(doc.querySelectorAll('style')).find(
                s => s.textContent.includes('font-cxsecret')
            ) || null;
        }

        /**
         * 提取 base64 字体数据
         */
        extractFontBase64(styleElement) {
            const match = styleElement.textContent.match(/base64,([\w\W]+?)'/);
            return match ? match[1] : null;
        }

        /**
         * base64 转 Uint8Array
         */
        base64ToUint8Array(base64) {
            const data = window.atob(base64);
            return new Uint8Array([...data].map(char => char.charCodeAt(0)));
        }

        /**
         * 创建字符映射表
         */
        createCharMap(font, table) {
            const charMap = {};
            const startTime = Date.now();

            // 遍历所有汉字 (U+4E00 - U+9FA5)
            for (let i = 19968; i < 40870; i++) {
                const glyph = Typr.U.codeToGlyph(font, i);
                if (!glyph) continue;

                const path = Typr.U.glyphToPath(font, glyph);
                const pathHash = md5(JSON.stringify(path)).slice(24);

                if (table[pathHash]) {
                    charMap[String.fromCharCode(i)] = String.fromCharCode(table[pathHash]);
                }
            }

            const elapsed = Date.now() - startTime;
            console.log(`[FontDecryptor] 映射创建完成，${Object.keys(charMap).length} 个字符，耗时 ${elapsed}ms`);
            return charMap;
        }

        /**
         * 替换加密文本（带详细日志）
         */
        replaceEncryptedText(charMap, doc = document) {
            let count = 0;
            const decryptDetails = [];

            // 方式1：替换 .font-cxsecret 元素中的文本
            const elements = doc.querySelectorAll('.font-cxsecret');
            elements.forEach(element => {
                let html = element.innerHTML;
                let changed = false;

                for (const [enc, dec] of Object.entries(charMap)) {
                    if (html.includes(enc)) {
                        html = html.replaceAll(enc, dec);
                        changed = true;
                        decryptDetails.push({ char: enc, replacement: dec, method: '.font-cxsecret' });
                    }
                }

                if (changed) {
                    element.innerHTML = html;
                    element.classList.remove('font-cxsecret');
                    count++;
                }
            });

            // 方式2：遍历所有文本节点
            const walker = doc.createTreeWalker(
                doc.body || doc.documentElement,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node;
            while (node = walker.nextNode()) {
                let text = node.nodeValue;
                let changed = false;

                for (const [enc, dec] of Object.entries(charMap)) {
                    if (text.includes(enc)) {
                        text = text.replaceAll(enc, dec);
                        changed = true;
                        decryptDetails.push({ char: enc, replacement: dec, method: 'text-node' });
                    }
                }

                if (changed) {
                    node.nodeValue = text;
                    count++;
                }
            }

            // 记录详细日志
            if (typeof XB !== 'undefined' && XB.Log) {
                XB.Log.fontDecrypt(count, Object.keys(charMap).length, decryptDetails);
            }

            return count;
        }

        /**
         * 主解密函数
         */
        async decrypt(doc = document) {
            try {
                const styleElement = this.findSecretStyle(doc);
                if (!styleElement) {
                    return false;
                }

                const fontBase64 = this.extractFontBase64(styleElement);
                if (!fontBase64) return false;

                const table = await this.loadTable();
                if (!table) return false;

                const fontData = Typr.parse(this.base64ToUint8Array(fontBase64))[0];
                const charMap = this.createCharMap(fontData, table);

                if (Object.keys(charMap).length === 0) {
                    return false;
                }

                const replacedCount = this.replaceEncryptedText(charMap, doc);
                console.log(`[FontDecryptor] 完成，替换了 ${replacedCount} 个文本节点`);
                return true;

            } catch (error) {
                console.error('[FontDecryptor] 解密失败:', error);
                return false;
            }
        }
    }

    XB.FontDecryptor = FontDecryptor;
})();
