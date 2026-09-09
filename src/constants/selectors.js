// constants/selectors.js - CSS 选择器集中管理
// 学习通更新时只需修改此文件

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    window.XuexitongBot.Selectors = {
        // 题目容器选择器
        QUESTION: ['.questionLi', '.singleQuesId', '.singlequesId', '.TiMu'],

        // 选项选择器
        OPTION: ['.stem_answer .answerBg', '.answerBg', '.num_option', '.num_option_dx'],

        // 题干选择器
        TITLE: ['.mark_name', '.Zy_TItle .fontLabel', '.newZy_TItle .fontLabel', '.Zy_TItle'],

        // 题型标识选择器
        TYPE_NAME_ATTR: 'typeName',
        TYPE_INPUT: (id) => `input[name="typeName${id}"]`,
        TYPE_NUM_INPUT: (id) => `input[name="type${id}"], input[name="answertype${id}"]`,
        TYPE_TIT: '.type_tit',
        NEW_ZY_TITLE: '.newZy_TItle',
        NEW_TEST_TYPE: '.newTestType',

        // 课程页面
        COURSE_TREE: '#coursetree',
        CHAPTER: '.posCatalog_select:not(.firstLayer)',
        CHAPTER_NAME: '.posCatalog_name',
        CHAPTER_ACTIVE: 'posCatalog_active',
        TASK_COUNT: '.orangeNew',
        COMPLETED_ICON: '.icon_Completed',

        // 提交按钮
        SAVE_BTN: '.btnSave, a[onclick*="saveWork"]',
        SUBMIT_BTN: 'a.btnSubmit.workBtnIndex',
        CONFIRM_BTN: '#popok, .popBottom .jb_btn',

        // 填空题
        BLANK_NUM: (id) => `input[name="blankNum${id}"]`,
        BLANK_TEXTAREA: (id, idx) => `textarea[name="answerEditor${id}${idx}"]`,

        // 简答题
        ESSAY_TEXTAREA: (id) => `textarea[name="answer${id}"]`,

        // 视频
        VIDEO: 'video, #video_html5_api, .vjs-tech',
        PLAY_BTN: '.vjs-big-play-button, .vjs-play-control, .play-btn, .playBtn, .prism-big-play-btn',

        // 弹窗
        POPUP_MASK: '.maskDiv[style*="display: block"], .maskDiv[style*="display:block"]',
        POPUP_CLOSE: '.popClose, .close',
        JOB_FINISH_TIP: '.jobFinishTip[style*="display: block"], .jobFinishTip[style*="display:block"]',
        NEXT_CHAPTER_BTN: '.nextChapter',
        WORKPOP: '#workpop',

        // 任务状态
        JOB_FINISHED: '.ans-job-finished',
        CHECK_ANSWER: '.check_answer, .check_answer_dx',

        // 文档/PDF
        DOC_IFRAME: '.ans-attach-online, .insertdoc-online-pdf',
        DOC_SRC: ['pdf/index', 'ppt/index', 'word/index'],

        // UEditor
        UEDITOR: '.edui-editor',
        UEDITOR_IFRAME: '.edui-editor-iframeholder iframe',

        // 标签页
        TABS: '#prev_tab li',
        IFRAME_MAIN: 'iframe'
    };
})();
