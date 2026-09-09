// modules/QuestionDetector.js - 题型检测与题目提取模块

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;
    const Types = XB.Types;
    const Selectors = XB.Selectors;
    const Utils = XB.Utils;

    class QuestionDetector {
        constructor() {
            this._currentPageType = null;
        }

        /**
         * 检测页面类型
         */
        detectPageType() {
            const url = window.location.href;

            if (url.includes('/exam-ans/') || url.includes('/mooc-ans/mooc2/work/dowork')) {
                return Types.PAGE_EXAM;
            }
            if (url.includes('/mooc-ans/') || url.includes('/mycourse/studentstudy')) {
                return Types.PAGE_WORK;
            }
            if (url.includes('/ananas/modules/video')) {
                return Types.PAGE_VIDEO;
            }

            return Types.PAGE_UNKNOWN;
        }

        /**
         * 检测题型（多种方式递进匹配）
         */
        detectQuestionType(element) {
            const pageType = this.detectPageType();
            const questionId = element.getAttribute('data');

            // 方式1：从 typeName 属性获取
            const typeNameAttr = element.getAttribute(Selectors.TYPE_NAME_ATTR);
            if (typeNameAttr) {
                const type = Utils.matchType(typeNameAttr);
                if (type) return type;
            }

            // 方式2：从隐藏 input 获取（考试页面）
            if (questionId) {
                const typeNameInput = element.querySelector(`input[name="typeName${questionId}"]`);
                if (typeNameInput) {
                    const type = Utils.matchType(typeNameInput.value);
                    if (type) return type;
                }

                // 方式3：从 type/answertype 属性获取
                const typeInput = element.querySelector(`input[name="type${questionId}"]`) ||
                                  element.querySelector(`input[name="answertype${questionId}"]`);
                if (typeInput) {
                    const value = typeInput.value;
                    if (value === '0') return Types.SINGLE;
                    if (value === '1') return Types.MULTIPLE;
                    if (value === '3') return Types.JUDGE;
                    if (value === '4') return Types.ESSAY;
                }
            }

            // 方式4：从大题标题获取
            const typeTitle = element.closest('.whiteDiv')?.querySelector(Selectors.TYPE_TIT)?.textContent;
            if (typeTitle) {
                const type = Utils.matchType(typeTitle);
                if (type) return type;
            }

            // 方式5：从 newZy_TItle 获取（刷课页面）
            const newZyTitle = element.querySelector(Selectors.NEW_ZY_TITLE) ||
                              element.closest('.singlequesId, .singleQuesId')?.querySelector(Selectors.NEW_ZY_TITLE);
            if (newZyTitle) {
                const type = Utils.matchType(newZyTitle.textContent);
                if (type) return type;
            }

            // 方式6：从 newTestType 大题标题获取
            const typeTitle2 = element.closest('.singlequesId, .singleQuesId')
                                     ?.querySelector(Selectors.NEW_TEST_TYPE)?.textContent;
            if (typeTitle2) {
                const type = Utils.matchType(typeTitle2);
                if (type) return type;
            }

            // 方式7：从 role 属性检测
            if (element.querySelector('[role="checkbox"]')) return Types.MULTIPLE;
            if (element.querySelector('[role="radio"]')) return Types.SINGLE;

            // 方式8：从输入框检测
            if (element.querySelector('.blankInpDiv') || element.querySelector('input[type="text"]')) {
                return Types.BLANK;
            }

            return Types.UNKNOWN;
        }

        /**
         * 题目元素去重
         */
        deduplicateQuestions(nodeList) {
            const questions = Array.from(nodeList);
            const toRemove = new Set();

            for (let i = 0; i < questions.length; i++) {
                for (let j = 0; j < questions.length; j++) {
                    if (i === j) continue;
                    if (questions[i].contains(questions[j])) {
                        toRemove.add(j);
                    }
                }
            }

            return questions.filter((_, index) => !toRemove.has(index));
        }

        /**
         * 提取题目信息
         */
        extractQuestion(element) {
            const type = this.detectQuestionType(element);
            const questionId = element.getAttribute('data');

            // 提取题干
            const title = this._extractTitle(element);

            // 提取选项
            const options = this._extractOptions(element, type);

            return { type, title, options, element, questionId };
        }

        /**
         * 提取题干（内部方法）
         */
        _extractTitle(element) {
            // 方式1：新版结构 .mark_name
            let titleElement = element.querySelector('.mark_name');
            if (titleElement) {
                const h3 = titleElement.querySelector('h3') || titleElement;
                const spans = h3.querySelectorAll('span.colorShallow');
                spans.forEach(s => s.style.display = 'none');
                const title = h3.textContent.replace(/^\d+\.\s*/, '').trim();
                spans.forEach(s => s.style.display = '');
                return title;
            }

            // 方式2：旧版结构 .Zy_TItle .fontLabel
            titleElement = element.querySelector('.Zy_TItle .fontLabel, .Zy_Title .fontLabel, .newZy_TItle .fontLabel, .newZy_Title .fontLabel');
            if (titleElement) {
                return titleElement.textContent.replace(/\s+/g, ' ').trim();
            }

            // 方式3：旧版结构 .Zy_TItle
            titleElement = element.querySelector('.Zy_TItle, .Zy_Title, .newZy_TItle, .newZy_Title');
            if (titleElement) {
                return titleElement.textContent.replace(/\s+/g, ' ').trim();
            }

            return '';
        }

        /**
         * 提取选项（内部方法）
         */
        _extractOptions(element, type) {
            const options = [];

            if (type !== Types.SINGLE && type !== Types.MULTIPLE && type !== Types.JUDGE) {
                return options;
            }

            // 方式1：新版结构 .stem_answer .answerBg
            let optionElements = element.querySelectorAll('.stem_answer .answerBg');

            // 方式2：旧版结构 ul.Zy_ulTop li
            if (optionElements.length === 0) {
                const ul = element.querySelector('ul.Zy_ulTop.w-top.fl, ul.Zy_ulTop');
                if (ul) {
                    const lis = ul.querySelectorAll(':scope > li');
                    lis.forEach((li, idx) => {
                        const p = li.querySelector('p') || li.querySelector('a') || li;
                        const text = p.textContent.replace(/\s+/g, ' ').trim();
                        const letter = String.fromCharCode(65 + idx);
                        options.push({ letter, data: '', text, qid: element.getAttribute('data'), element: li });
                    });
                    return options;
                }
            }

            // 方式3：普通 .answerBg
            if (optionElements.length === 0) {
                optionElements = element.querySelectorAll('.answerBg');
            }

            // 方式4：.num_option
            if (optionElements.length === 0) {
                optionElements = element.querySelectorAll('.num_option, .num_option_dx');
            }

            // 处理 answerBg 类型的选项
            if (options.length === 0 && optionElements.length > 0) {
                optionElements.forEach((opt, idx) => {
                    const span = opt.querySelector('span');
                    const letter = span ? span.textContent.trim() : String.fromCharCode(65 + idx);
                    const data = span ? span.getAttribute('data') : '';
                    const qid = span ? span.getAttribute('qid') : element.getAttribute('data');
                    const text = opt.querySelector('.answer_p')?.textContent.trim() ||
                                 opt.textContent.replace(/\s+/g, ' ').trim();
                    options.push({ letter, data, text, qid, element: opt });
                });
            }

            return options;
        }
    }

    XB.QuestionDetector = QuestionDetector;
})();
