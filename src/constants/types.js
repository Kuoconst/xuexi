// constants/types.js - 题型枚举和常量

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    window.XuexitongBot.Types = {
        // 题型枚举
        SINGLE: 'single',
        MULTIPLE: 'multiple',
        JUDGE: 'judge',
        BLANK: 'blank',
        ESSAY: 'essay',
        UNKNOWN: 'unknown',

        // 题型中文名映射
        NAMES: {
            single: '单选',
            multiple: '多选',
            judge: '判断',
            blank: '填空',
            essay: '简答',
            unknown: '未知'
        },

        // 题型关键词映射（用于检测）
        KEYWORDS: {
            single: ['单选'],
            multiple: ['多选'],
            judge: ['判断'],
            essay: ['简答'],
            blank: ['填空']
        },

        // 页面类型
        PAGE_EXAM: 'exam',
        PAGE_WORK: 'work',
        PAGE_VIDEO: 'video',
        PAGE_UNKNOWN: 'unknown'
    };
})();
