// modules/CoursePlayer.js - 刷课功能模块

(function() {
    'use strict';

    window.XuexitongBot = window.XuexitongBot || {};
    const XB = window.XuexitongBot;
    const Types = XB.Types;
    const Selectors = XB.Selectors;
    const Utils = XB.Utils;
    const Config = XB.Config;

    class CoursePlayer {
        constructor(messageBus, aiClient) {
            this._messageBus = messageBus;
            this._aiClient = aiClient;
            this._isRunning = false;
            this._config = {
                ...Config.DEFAULT_BRUSH_CONFIG
            };
            this._decryptor = null;
        }

        /**
         * 设置配置
         */
        setConfig(config) {
            this._config = { ...this._config, ...config };
        }

        /**
         * 获取配置
         */
        getConfig() {
            return this._config;
        }

        /**
         * 设置运行状态
         */
        setRunning(running) {
            this._isRunning = running;
        }

        /**
         * 设置答题配置（当前仅用 autoSubmit 决定作业是否自动交卷）
         */
        setAnswerConfig(config) {
            this._answerConfig = config || {};
        }

        /**
         * 结束通知（去重）：start() 的多条退出路径与 main.js 的兜底
         * 都可能触发，保证一次任务只通知面板复位一次
         */
        notifyFinishedIfNeeded() {
            if (this._finishNotified) return;
            this._finishNotified = true;
            this._messageBus.sendFinished();
        }

        /**
         * 检测是否在课程页面
         */
        isCoursePage() {
            const url = window.location.href;
            return url.includes('/mycourse/stu') ||
                   url.includes('/mycourse/studentstudy') ||
                   url.includes('/knowledge/cards');
        }

        /**
         * 解析目录树
         */
        parseCourseTree() {
            const chapters = [];
            const tree = document.getElementById('coursetree');

            if (!tree) {
                this._messageBus.sendLog('未找到目录树', 'error');
                return chapters;
            }

            const sections = tree.querySelectorAll(Selectors.CHAPTER);

            sections.forEach((el, index) => {
                const nameEl = el.querySelector(Selectors.CHAPTER_NAME);
                if (!nameEl) return;

                const name = nameEl.getAttribute('title') || nameEl.textContent.trim();
                const id = el.id;
                const completed = !!el.querySelector(Selectors.COMPLETED_ICON);

                const taskCountEl = el.querySelector(Selectors.TASK_COUNT);
                const taskCount = taskCountEl ? parseInt(taskCountEl.textContent) || 0 : 0;
                const hasTask = taskCount > 0;

                const onclickAttr = nameEl.getAttribute('onclick') || '';
                const params = onclickAttr.match(/getTeacherAjax\('(\d+)','(\d+)','(\d+)'\)/);

                chapters.push({
                    index,
                    id,
                    name,
                    completed,
                    hasTask,
                    taskCount,
                    courseId: params ? params[1] : '',
                    classId: params ? params[2] : '',
                    chapterId: params ? params[3] : '',
                    element: el,
                    nameElement: nameEl
                });
            });

            return chapters;
        }

        /**
         * 跳转到指定章节
         */
        async navigateToChapter(chapter) {
            this._messageBus.sendLog(`跳转到: ${chapter.name}`, 'info');
            chapter.nameElement.click();
            await Utils.sleep(Config.CHAPTER_INTERVAL);
        }

        /**
         * 处理弹窗
         */
        async handlePopups() {
            // 关闭任务完成提示弹窗
            // 注意：绝不点击其中的「下一章」按钮 —— 章节推进由 start() 主循环统一调度，
            // 否则会与 navigateToChapter 叠加造成双重跳转（历史遗留 bug）
            const tipPop = document.querySelector(Selectors.JOB_FINISH_TIP);
            if (tipPop) {
                const closeBtn = tipPop.querySelector(Selectors.POPUP_CLOSE);
                if (closeBtn) {
                    Utils.executeOnclick(closeBtn);
                    await Utils.sleep(500);
                    this._messageBus.sendLog('已关闭任务完成提示弹窗', 'info', 'hidden');
                }
            }

            // 关闭其他弹窗
            const popups = document.querySelectorAll(Selectors.POPUP_MASK);
            for (const popup of popups) {
                const closeBtn = popup.querySelector(Selectors.POPUP_CLOSE);
                if (closeBtn) {
                    try { Utils.executeOnclick(closeBtn); } catch (e) {}
                    await Utils.sleep(300);
                }
            }
        }

        /**
         * 找下一个未完成的章节
         */
        findNextChapter(chapters, currentIndex) {
            for (let i = currentIndex + 1; i < chapters.length; i++) {
                if (!chapters[i].completed && chapters[i].hasTask) {
                    return { chapter: chapters[i], index: i };
                }
            }
            return null;
        }

        /**
         * 处理单个章节的所有任务点
         */
        async processChapter(chapter, completedTasks, totalTasks) {
            this._messageBus.sendLog(`处理章节: ${chapter.name}`, 'info');

            const mainIframe = await Utils.waitForIframeLoad(Selectors.IFRAME_MAIN);
            if (!mainIframe) {
                this._messageBus.sendLog('主iframe加载超时', 'warning');
                return { allCompleted: false, completedTasks, discoveredTasks: 0 };
            }

            await Utils.sleep(Config.IFRAME_WAIT);

            // 获取所有标签页
            const tabs = document.querySelectorAll(Selectors.TABS);
            const tabCount = tabs.length;

            if (tabCount === 0) {
                const result = await this._processCurrentTab(completedTasks, totalTasks);
                return { allCompleted: result.completed, completedTasks: result.completedTasks, discoveredTasks: result.discoveredTasks || 0 };
            }

            this._messageBus.sendLog(`找到 ${tabCount} 个标签页`, 'info', 'hidden');

            let hasAnyTask = false;
            let allCompleted = true;
            let discoveredTasks = 0;

            for (let i = 0; i < tabCount; i++) {
                if (!this._isRunning) break;

                const tab = tabs[i];
                const tabName = tab.getAttribute('title') || tab.textContent.trim();

                this._messageBus.sendLog(`切换到标签页: ${tabName}`, 'info', 'hidden');
                tab.click();
                await Utils.sleep(Config.TAB_INTERVAL);

                const result = await this._processCurrentTab(completedTasks, totalTasks);
                completedTasks = result.completedTasks;
                discoveredTasks += result.discoveredTasks || 0;

                if (result.hasTask) {
                    hasAnyTask = true;
                    if (!result.completed) allCompleted = false;
                }
            }

            return { allCompleted, completedTasks, discoveredTasks };
        }

        /**
         * 处理当前标签页（内部方法）
         */
        async _processCurrentTab(completedTasks, totalTasks) {
            const result = { hasTask: false, completed: false, completedTasks, discoveredTasks: 0 };

            const mainIframe = await Utils.waitForIframeLoad(Selectors.IFRAME_MAIN);
            if (!mainIframe) {
                this._messageBus.sendLog('主iframe加载超时', 'warning');
                return result;
            }

            let mainDoc;
            try {
                mainDoc = mainIframe.contentDocument || mainIframe.contentWindow?.document;
            } catch (e) {
                this._messageBus.sendLog('无法访问主iframe', 'warning');
                return result;
            }

            if (!mainDoc) {
                this._messageBus.sendLog('主iframe文档为空', 'warning');
                return result;
            }

            // 获取所有子iframe
            const subIframes = mainDoc.querySelectorAll('iframe');

            for (let i = 0; i < subIframes.length; i++) {
                if (!this._isRunning) break;

                const subIframe = subIframes[i];

                const iframeClass = String(subIframe.className || '');
                const iframeSrc = subIframe.getAttribute('src') || '';
                // 学习通任务点 iframe 的官方特征：module 属性 + attach-xxx 类 + attachment/{Type}.html
                // 类型值为驼峰（insertVideo），必须小写化后再匹配
                const moduleAttr = (subIframe.getAttribute('module') || '').toLowerCase();
                const classLc = iframeClass.toLowerCase();
                const srcLc = iframeSrc.toLowerCase();

                // 检查1：父节点 ans-job-finished 类（受 skipFinished 开关控制）
                if (this._isTaskFinished(subIframe)) {
                    this._messageBus.sendLog(`内容块 ${i + 1} 已完成，跳过`, 'success', 'hidden');
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('TASK', `内容块 ${i + 1} 跳过：父节点 ans-job-finished`, { class: iframeClass || '(无)', src: iframeSrc || '(无)' });
                    }
                    continue;
                }

                // 检查2：最近的任务点图标祖先的 aria-label（受 skipFinished 开关控制，与检查1一致）
                // 用 closest 而非索引对齐，避免装饰性 iframe 混入导致错位误判
                let jobIconEl = null;
                try { jobIconEl = subIframe.closest('.ans-job-icon'); } catch (e) {}
                if (this._config.skipFinished && jobIconEl &&
                    jobIconEl.getAttribute('aria-label') === '任务点已完成') {
                    this._messageBus.sendLog(`内容块 ${i + 1} 已完成，跳过`, 'success', 'hidden');
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('TASK', `内容块 ${i + 1} 跳过：任务点图标标记已完成`, { class: iframeClass || '(无)', src: iframeSrc || '(无)' });
                    }
                    continue;
                }

                const isVideo = classLc.includes('ans-insertvideo-online') ||
                                moduleAttr.includes('video') ||
                                srcLc.includes('video');
                const isDocument = this._isDocumentIframe(classLc, srcLc) ||
                                   moduleAttr.includes('doc');

                // 记录内容块分类结果（排查漏处理的关键线索）
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.detail('TASK', `内容块 ${i + 1} 分类`, {
                        class: iframeClass || '(无)',
                        src: iframeSrc || '(无)',
                        module: moduleAttr || '(无)',
                        kind: isVideo ? '视频' : (isDocument ? '文档' : '待预检')
                    });
                }

                if (isVideo) {
                    result.hasTask = true;
                    // 视频常在嵌套的内层播放器 iframe 里，必须递归查找
                    let videos = [];
                    try {
                        const subDoc = subIframe.contentDocument || subIframe.contentWindow?.document;
                        if (subDoc) videos = Utils.findInAllIframes(subDoc, Selectors.VIDEO);
                    } catch (e) {}
                    if (videos.length === 0) {
                        this._messageBus.sendLog(`内容块 ${i + 1} 标记为视频但未找到播放元素（可能尚未加载完成）`, 'warning');
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('TASK', `内容块 ${i + 1} 未找到 video 元素`, { class: iframeClass, src: iframeSrc });
                        }
                    }
                    // 目录任务数按任务点计；找不到播放元素时也按 1 个任务点计入分母，保持进度诚实
                    result.discoveredTasks += videos.length || 1;
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('TASK', `内容块 ${i + 1} 按视频处理`, { playersFound: videos.length, class: iframeClass || '(无)', src: iframeSrc || '(无)' });
                    }
                    await this._playBlockVideos(videos, i + 1, result, totalTasks);
                    continue;
                }

                if (isDocument) {
                    result.hasTask = true;
                    result.discoveredTasks++;
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('TASK', `内容块 ${i + 1} 按文档处理`, { class: iframeClass || '(无)', src: iframeSrc || '(无)' });
                    }
                    const completed = await this._processDocumentIframe(subIframe, iframeClass, iframeSrc, i + 1);
                    if (completed) {
                        result.completed = true;
                        result.completedTasks++;
                        this._messageBus.sendLog(`文档 ${i + 1} 处理完成`, 'success', 'hidden');
                        this._messageBus.sendProgress(result.completedTasks, totalTasks);
                    }
                    continue;
                }

                // 其他类型（作业、外层无视频特征的嵌套视频等）
                if (!isVideo && !isDocument) {
                    let looksLikeWork = false;
                    let innerVideos = [];

                    // 递归视频探测：wrapper iframe 外层可能不带 video 特征甚至为 about:blank，
                    // 而真正的 <video> 在内层 iframe —— 此处原先不探测视频，是任务点漏刷的主因
                    const probeVideos = () => {
                        try {
                            const pd = subIframe.contentDocument || subIframe.contentWindow?.document;
                            return pd ? Utils.findInAllIframes(pd, Selectors.VIDEO) : [];
                        } catch (e) { return []; }
                    };

                    // 特征1：官方任务点属性/路径（module='insertWork' 等、attachment 路径）
                    // 直接按作业处理：作业页内可能嵌视频题干，先探测视频会误分流
                    if (moduleAttr.includes('work') || srcLc.includes('/work/') || srcLc.includes('attachment/')) {
                        looksLikeWork = true;
                    } else {
                        // 特征A：内部已加载出可播放的视频 → 按视频处理
                        innerVideos = probeVideos();
                        // 特征2：有实际 src 的非视频非文档 iframe → 视为作业
                        if (innerVideos.length === 0 && iframeSrc && !srcLc.includes('about:blank')) {
                            looksLikeWork = true;
                        }
                        // 特征3：无 src / about:blank —— 内容常由脚本延迟填充，
                        // 探测作业/视频迹象，首次没有则等待后重试一次（复刻旧版"等待内容加载"时序）
                        else if (innerVideos.length === 0) {
                            const probeWork = () => {
                                try {
                                    const pd = subIframe.contentDocument || subIframe.contentWindow?.document;
                                    return !!(pd && pd.querySelector('.TiMu, .questionLi, .singleQuesId, .singlequesId, .ZyBottom'));
                                } catch (e) { return false; }
                            };
                            if (probeWork()) {
                                looksLikeWork = true;
                            } else {
                                await Utils.sleep(2000);
                                if (!this._isRunning) break;
                                innerVideos = probeVideos();
                                if (innerVideos.length === 0 && probeWork()) {
                                    looksLikeWork = true;
                                    this._messageBus.sendLog(`内容块 ${i + 1} 内容延迟加载完成，识别为作业`, 'info', 'hidden');
                                }
                            }
                        }
                    }

                    if (innerVideos.length > 0) {
                        // 视频处理（递归探测命中，与 isVideo 分支同一播放路径）
                        result.hasTask = true;
                        result.discoveredTasks += innerVideos.length;
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('TASK', `内容块 ${i + 1} 由递归探测识别为视频（外层无视频特征）`, {
                                playersFound: innerVideos.length, class: iframeClass || '(无)', src: iframeSrc || '(无)'
                            });
                        }
                        await this._playBlockVideos(innerVideos, i + 1, result, totalTasks);
                        continue;
                    }

                    if (looksLikeWork) {
                        result.hasTask = true;
                        result.discoveredTasks++;
                        // 传入/回传 result.completedTasks：保证作业完成数不被后续视频/文档块的
                        // sendProgress 覆盖丢失（原先只更新局部变量导致进度回退、计数偏低）
                        const workResult = await this._processWorkIframe(subIframe, i + 1, mainDoc, result.completedTasks, totalTasks);
                        result.completedTasks = workResult.completedTasks;
                        if (workResult.completed) result.completed = true;
                    } else if (jobIconEl) {
                        // 带任务点图标却无法自动识别类型：可见警告，提示用户手动处理
                        this._messageBus.sendLog(`内容块 ${i + 1} 疑似任务点但无法自动处理，请手动检查`, 'warning');
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('TASK', `内容块 ${i + 1} 预检失败（带任务点图标）`, { class: iframeClass || '(无)', src: iframeSrc || '(无)' });
                        }
                    } else if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('TASK', `内容块 ${i + 1} 预检非作业/非视频`, { class: iframeClass || '(无)', src: iframeSrc || '(无)' });
                    }
                }
            }

            return result;
        }

        /**
         * 播放一个内容块内找到的所有视频，统一更新完成进度
         * @param {Element[]} videos - 视频元素列表
         * @param {number} blockIndex - 内容块序号（日志用）
         * @param {Object} result - _processCurrentTab 的结果对象（就地更新 completed/completedTasks）
         * @param {number} totalTasks - 进度分母
         * @returns {number} 本次播放完成的视频数
         */
        async _playBlockVideos(videos, blockIndex, result, totalTasks) {
            let completedCount = 0;
            for (const video of videos) {
                if (!this._isRunning) break;
                const completed = await this._playVideo(video, blockIndex);
                if (completed) {
                    completedCount++;
                    result.completed = true;
                    result.completedTasks++;
                    this._messageBus.sendProgress(result.completedTasks, totalTasks);
                }
            }
            return completedCount;
        }

        /**
         * 判断是否是文档 iframe（入参应为已小写化的 class 与 src）
         */
        _isDocumentIframe(className, src) {
            const Selectors = XB.Selectors;
            if (className.includes('ans-attach-online')) return true;
            if (className.includes('insertdoc-online-pdf')) return true;

            for (const pattern of Selectors.DOC_SRC) {
                if (src.includes(pattern)) return true;
            }
            return false;
        }

        /**
         * 检查任务是否已完成
         */
        _isTaskFinished(iframe) {
            if (!this._config.skipFinished) return false;
            const parent = iframe.parentElement;
            return parent && parent.classList.contains('ans-job-finished');
        }

        /**
         * 尝试对"可拖拽"视频直接拉进度条完成（seekSkip 功能核心）
         * 原理：对 video 元素试探性 seek 到末尾前，随后读回 currentTime 验证是否被播放器重置。
         *   - seek 生效（读回接近目标位置）→ 该视频未开防拖拽，可直接拉满进度条结束播放
         *   - seek 被重置（读回接近原位置）→ 该视频有防拖拽，恢复原位并回退正常播放
         * 每个视频仅探测一次，防拖拽视频的探测动作会被学习通自身机制重置，相当于一次拖拽误触，风险可控
         * @param {HTMLVideoElement} video
         * @param {number} blockIndex
         * @returns {Promise<boolean>} true=已通过拖拽完成该视频
         */
        async _trySeekToEnd(video, blockIndex) {
            if (!video.duration || !isFinite(video.duration) || video.duration <= 0) return false;
            if (video.ended || video.currentTime >= video.duration - Config.VIDEO_END_THRESHOLD) return true;

            const originalTime = video.currentTime;
            const probeTarget = Math.max(0, video.duration - 1);

            // 第一步：试探性 seek 到末尾前 1 秒
            try { video.currentTime = probeTarget; } catch (e) { return false; }
            await Utils.sleep(600);

            // 第二步：读回校验，判断 seek 是否被播放器接受（偏差 < 2 秒视为允许拖拽）
            const probeAccepted = Math.abs(video.currentTime - probeTarget) < 2;
            if (!probeAccepted) {
                // 防拖拽视频：恢复原位并重新播放，回退正常流程
                try { video.currentTime = originalTime; } catch (e) {}
                await this._tryStartPlayback(video);
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.detail('VIDEO', `视频 ${blockIndex} 检测到防拖拽，按正常流程播放`, { currentTime: video.currentTime });
                }
                return false;
            }

            // 第三步：可拖拽。seek 到极接近末尾再播放，让视频自然播放完最后 0.1 秒触发
            // ended 事件——与用户手动拖到末尾的行为一致，学习通播放器必然走正常"播放完成"
            // 回调，任务点落盘最稳（直接 currentTime=duration 可能无 ended 事件导致不记录）
            if (typeof XB !== 'undefined' && XB.Log) {
                XB.Log.detail('VIDEO', `视频 ${blockIndex} 支持拖拽，直接快进到末尾`);
            }
            try { video.currentTime = Math.max(0, video.duration - 0.1); } catch (e) {}
            await this._tryStartPlayback(video);
            return true;
        }

        /**
         * 尝试启动播放：直接 play()，失败则点播放按钮
         */
        async _tryStartPlayback(video) {
            if (!video.paused) return;
            try {
                await video.play();
                return;
            } catch (e) {}
            try {
                const doc = video.ownerDocument;
                if (doc) {
                    const btn = doc.querySelector(Selectors.PLAY_BTN);
                    if (btn) btn.click();
                }
            } catch (e) {}
        }

        /**
         * 播放视频
         */
        async _playVideo(video, blockIndex) {
            try {
                const iframe = video.closest('iframe') || (video.ownerDocument && video.ownerDocument.defaultView ? video.ownerDocument.defaultView.frameElement : null);
                const parentFinished = iframe && iframe.parentElement &&
                    iframe.parentElement.classList.contains('ans-job-finished');

                if (parentFinished || video.ended ||
                    (video.duration && video.currentTime >= video.duration - Config.VIDEO_END_THRESHOLD)) {
                    this._messageBus.sendLog(`视频已播放完成，跳过`, 'info', 'hidden');
                    return true;
                }

                const shouldMute = this._config.muteVideo !== false;
                video.muted = shouldMute;
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.detail('VIDEO', `视频${blockIndex}静音状态: ${shouldMute ? '已静音' : '未静音'}`);
                }

                await this._tryStartPlayback(video);

                if (!video.duration) {
                    await this._waitForVideoMetadata(video);
                    if (!video.duration) {
                        this._messageBus.sendLog(`视频 ${blockIndex} 无法获取时长（播放器未就绪），跳过`, 'warning');
                        if (typeof XB !== 'undefined' && XB.Log) {
                            XB.Log.detail('VIDEO', `视频 ${blockIndex} 无时长`, { currentTime: video.currentTime });
                        }
                        return false;
                    }
                }

                const startPos = Math.round(video.currentTime || 0);
                const startPct = video.duration ? Math.round((video.currentTime / video.duration) * 100) : 0;
                const muteStatus = this._config.muteVideo !== false ? '静音' : '有声';
                this._messageBus.sendLog(`开始播放视频 ${blockIndex}（时长 ${Math.round(video.duration)}秒，起点 ${startPos}秒/约${startPct}% × ${this._config.videoSpeed || 1}倍速，${muteStatus}）`, 'info', null);

                // 可拖拽视频直接拉进度条完成，跳过完整播放等待（开关默认开启）
                if (this._config.seekSkip !== false) {
                    const fastForwarded = await this._trySeekToEnd(video, blockIndex);
                    if (fastForwarded) {
                        this._messageBus.sendLog(`视频 ${blockIndex} 已通过拖拽直接完成`, 'success', 'hidden');
                    }
                }

                const done = await this._waitForVideoComplete(video, blockIndex);
                return done;

            } catch (e) {
                this._messageBus.sendLog(`视频处理失败: ${e.message}`, 'warning');
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.error('VIDEO', `视频 ${blockIndex} 处理异常`, e);
                }
                return false;
            }
        }

        /**
         * 等待视频元数据加载
         */
        _waitForVideoMetadata(video, timeout = 30000) {
            return new Promise((resolve) => {
                if (video.duration) { resolve(); return; }

                let resolved = false;
                const onLoaded = () => {
                    if (!resolved) {
                        resolved = true;
                        video.removeEventListener('loadedmetadata', onLoaded);
                        resolve();
                    }
                };

                video.addEventListener('loadedmetadata', onLoaded);
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        video.removeEventListener('loadedmetadata', onLoaded);
                        resolve();
                    }
                }, timeout);
            });
        }

        /**
         * 等待视频播放完成（带活性监控）
         * - 每 3 秒检查进度
         * - 约 6 秒无进展：自动恢复播放并重设倍速
         * - 约 30 秒仍停滞（典型为弹出防刷验证窗）：记录警告并放弃，不再死等 30 分钟
         * - 每 60 秒输出一次进度心跳，让"卡住"肉眼可见
         */
        async _waitForVideoComplete(video, blockIndex) {
            const startTime = Date.now();
            let lastTime = -1;
            let stallCount = 0;
            let lastReport = Date.now();
            const speed = this._config.videoSpeed || 1;

            while (this._isRunning) {
                if (video.ended ||
                    (video.duration && video.currentTime >= video.duration - Config.VIDEO_END_THRESHOLD)) {
                    this._messageBus.sendLog(`视频 ${blockIndex} 播放完成`, 'success');
                    return true;
                }

                if (Date.now() - startTime > Config.VIDEO_TIMEOUT) {
                    this._messageBus.sendLog(`视频 ${blockIndex} 超过最大等待时间(${Math.round(Config.VIDEO_TIMEOUT / 60000)}分钟)，放弃`, 'warning');
                    return false;
                }

                // 进度心跳：每 60 秒报一次百分比
                if (Date.now() - lastReport > 60000) {
                    lastReport = Date.now();
                    const pct = video.duration ? Math.round((video.currentTime / video.duration) * 100) : 0;
                    this._messageBus.sendLog(`视频 ${blockIndex} 播放中 ${pct}%`, 'info', 'hidden');
                }

                // 活性检测
                if (Math.abs(video.currentTime - lastTime) < 0.01) {
                    stallCount++;
                    if (stallCount === 2) {
                        // ~6秒无进展：尝试恢复播放并重设倍速
                        this._messageBus.sendLog(`视频 ${blockIndex} 播放停滞，尝试自动恢复...`, 'warning', 'hidden');
                        await this._tryStartPlayback(video);
                        try { video.playbackRate = speed; } catch (e) {}
                    }
                    if (stallCount >= 10) {
                        // ~30秒仍停滞：典型场景是弹出了防刷验证窗，需要人工处理
                        this._messageBus.sendLog(`视频 ${blockIndex} 播放停滞超过30秒（可能弹出验证窗口，请手动处理后重刷），跳过`, 'warning');
                        return false;
                    }
                } else {
                    stallCount = 0;
                }

                lastTime = video.currentTime;
                await Utils.sleep(3000);
            }
            return false;
        }

        /**
         * 处理文档 iframe
         */
        async _processDocumentIframe(subIframe, className, src, blockIndex) {
            let subDoc;
            try {
                subDoc = subIframe.contentDocument || subIframe.contentWindow?.document;
            } catch (e) {
                return false;
            }

            if (!subDoc) return false;

            // 方式1：在内层查找文档查看器 iframe，其 window 上才有 finishJob 等完成函数（与旧版一致）
            const viewerSelector = '.ans-attach-online, .insertdoc-online-pdf, [src*="pdf/index"], [src*="ppt/index"], [src*="word/index"]';
            let viewer = null;
            try { viewer = subDoc.querySelector(viewerSelector); } catch (e) {}
            if (viewer && viewer !== subIframe) {
                try {
                    const vWin = viewer.contentWindow;
                    for (const funcName of ['finishJob', 'unMaskAndFinishJob', 'ed_complete']) {
                        if (vWin && typeof vWin[funcName] === 'function') {
                            this._messageBus.sendLog(`调用 ${funcName}() 完成文档任务...`, 'info', 'hidden');
                            vWin[funcName]();
                            await Utils.sleep(1000);
                            return true;
                        }
                    }
                } catch (e) {}
            }

            // 方式2：panView 是 PDF/PPT 实际内容的滚动容器，进入深滚
            if (await this._scrollPanView(subDoc)) {
                return true;
            }

            // 方式3：降级滚动外层文档
            await this._scrollDocument(subDoc, subDoc.body, blockIndex);
            return true;
        }

        /**
         * 滚动 panView 文档查看器（等待内层渲染完成后分步滚动到底）
         */
        async _scrollPanView(subDoc, maxRetries = 10) {
            for (let retry = 0; retry < maxRetries; retry++) {
                if (!this._isRunning) return false;

                let panView = null;
                try {
                    const found = Utils.findInAllIframes(subDoc, '#panView');
                    panView = found[0] || null;
                } catch (e) {}

                if (panView) {
                    let panDoc;
                    try {
                        panDoc = panView.contentDocument || panView.contentWindow?.document;
                    } catch (e) {}

                    if (panDoc) {
                        const panHtml = panDoc.documentElement;
                        if (panHtml && panHtml.scrollHeight > 0) {
                            this._messageBus.sendLog('找到文档可滚动容器，开始滚动...', 'info', 'hidden');

                            let lastScrollTop = -1;
                            let attempts = 0;

                            while (attempts < Config.SCROLL_MAX_ROUNDS && this._isRunning) {
                                try {
                                    panHtml.scrollTo({ top: panHtml.scrollHeight, behavior: 'smooth' });
                                } catch (e) {
                                    try { panHtml.scrollTop = panHtml.scrollHeight; } catch (e2) {}
                                }
                                await Utils.sleep(800);

                                // 位置不再变化说明已到底
                                if (panHtml.scrollTop === lastScrollTop) break;
                                lastScrollTop = panHtml.scrollTop;
                                attempts++;
                            }
                            return true;
                        }
                    }
                }
                await Utils.sleep(1000);
            }
            return false;
        }

        /**
         * 滚动文档到底部
         */
        async _scrollDocument(doc, element, blockIndex) {
            const win = doc.defaultView || doc.parentWindow || window;
            const docEl = doc.documentElement || doc.body;

            // 方式1：逐页滚动
            const pages = doc.querySelectorAll('.page, .textLayer > div, .slide, .slide-show-box > div, .viewer-page, .sheet');

            if (pages.length > 0) {
                for (let i = 0; i < pages.length; i++) {
                    if (!this._isRunning) break;
                    try {
                        pages[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } catch (e) {
                        pages[i].scrollIntoView();
                    }
                    await Utils.sleep(500);
                }
                return;
            }

            // 方式2：滚动触发懒加载
            let lastScrollHeight = docEl.scrollHeight || element.scrollHeight;
            let round = 0;

            while (round < Config.SCROLL_MAX_ROUNDS && this._isRunning) {
                round++;

                try { win.scrollTo(0, docEl.scrollHeight); } catch (e) {}
                try { docEl.scrollTop = docEl.scrollHeight; } catch (e) {}
                try { element.scrollTop = element.scrollHeight; } catch (e) {}

                await Utils.sleep(800);

                const newScrollHeight = docEl.scrollHeight || element.scrollHeight;
                if (newScrollHeight > lastScrollHeight) {
                    lastScrollHeight = newScrollHeight;
                } else {
                    break;
                }
            }
        }

        /**
         * 处理作业 iframe
         */
        async _processWorkIframe(subIframe, blockIndex, mainDoc, completedTasks, totalTasks) {
            const result = { completed: false, completedTasks };

            let workDoc;
            try {
                workDoc = subIframe.contentDocument || subIframe.contentWindow?.document;
            } catch (e) {
                this._messageBus.sendLog(`内容块 ${blockIndex} 无法访问内容（可能为跨域限制），请手动处理该任务点`, 'warning');
                return result;
            }

            if (!workDoc) {
                this._messageBus.sendLog(`内容块 ${blockIndex} 内容为空（可能未加载完成），请稍后手动检查`, 'warning');
                return result;
            }

            // 纯查找：字体加密只影响文字内容、不影响题目容器结构，
            // 因此查题阶段无需解密。作业任务点是双层结构（外层 wrapper +
            // 内层真实做题 iframe），必须用 findInAllIframes 递归穿透查找；
            // 未命中则等待内层渲染后重试（时序与旧版一致：3s + 2s）
            const QUESTION_SELECTOR = '.questionLi, .singleQuesId, .singlequesId, .TiMu';
            const collectQuestions = () =>
                new XB.QuestionDetector().deduplicateQuestions(
                    Utils.findInAllIframes(workDoc, QUESTION_SELECTOR)
                );

            let questions = collectQuestions();
            if (questions.length === 0) {
                await Utils.sleep(3000);
                questions = collectQuestions();
                if (questions.length === 0) {
                    await Utils.sleep(2000);
                    questions = collectQuestions();
                }
            }

            if (questions.length === 0) {
                // 可见警告而非静默返回：这是排查"作业被跳过"问题的关键线索
                this._messageBus.sendLog(`内容块 ${blockIndex} 识别为作业但未找到题目（可能加载超时）`, 'warning');
                return result;
            }

            // 解密模块惰性创建：只有真的遇到加密文本才会加载 table.json
            this._decryptor = this._decryptor || new XB.FontDecryptor();

            // 处理题目（复用传入的 aiClient）
            const answerFiller = new XB.AnswerFiller();

            let answeredCount = 0;
            for (let q = 0; q < questions.length; q++) {
                if (!this._isRunning) break;

                const element = questions[q];
                // 按需字体解密：仅当题目命中 font-cxsecret 加密标记时才解密
                // 其所属文档（内层 iframe），随后重新提取明文题干
                let question = new XB.QuestionDetector().extractQuestion(element);
                if (await this._decryptor.ensureForElement(element)) {
                    question = new XB.QuestionDetector().extractQuestion(element);
                }

                this._messageBus.sendLog(`第${q + 1}题 [${Utils.getTypeName(question.type)}] 开始处理...`, 'info', 'hidden');

                const answer = await this._aiClient.getAnswer(question);

                if (answer) {
                    const success = await answerFiller.fill(element, question, answer);
                    if (success) {
                        this._messageBus.sendLog(`第${q + 1}题 [${Utils.getTypeName(question.type)}] 答案: ${answer}`, 'success');
                        answeredCount++;
                    } else {
                        this._messageBus.sendLog(`第${q + 1}题 [${Utils.getTypeName(question.type)}] 填入失败`, 'error');
                    }
                } else {
                    this._messageBus.sendLog(`第${q + 1}题 [${Utils.getTypeName(question.type)}] 获取答案失败`, 'error');
                }

                await Utils.waitForQuestionConfirmed(element, question.type);

                if (q < questions.length - 1 && this._isRunning) {
                    await Utils.sleep(Config.QUESTION_INTERVAL);
                }
            }

            this._messageBus.sendLog(`作业处理完成，成功 ${answeredCount}/${questions.length} 题`, 'success', 'hidden');

            // 答完必须落盘：全对 -> 三步提交；部分 -> 仅保存（与旧版一致）
            await this._submitWork(answeredCount, questions.length, this._answerConfig && this._answerConfig.autoSubmit === true);

            // 防御：仅当确实存在题目且全部答完才标记完成。
            // 否则 0===0 会把空作业误判为已完成，进度虚涨、章节被错误跳过
            if (questions.length > 0 && answeredCount === questions.length) {
                result.completed = true;
                result.completedTasks++;
                this._messageBus.sendProgress(result.completedTasks, totalTasks);
            }

            return result;
        }

        /**
         * 作业提交/保存（在主文档及全部嵌套 iframe 中查找按钮）
         * @param {boolean} autoSubmit - 高级设置「自动提交」开关
         */
        async _submitWork(answeredCount, total, autoSubmit = false) {
            if (total === 0) return;

            const findEl = (selector) => {
                try {
                    return Utils.findInAllIframes(document, selector)[0] || null;
                } catch (e) {
                    return null;
                }
            };

            if (answeredCount === total && !autoSubmit) {
                // 全对但用户关闭了自动提交：仅保存，不交卷
                const saveOnlyBtn = findEl(Selectors.SAVE_BTN);
                if (saveOnlyBtn) {
                    // 用 executeOnclick 优先调用 onclick 函数，避免触发 javascript: href 被页面 CSP 拦截
                    try { Utils.executeOnclick(saveOnlyBtn); } catch (e) {}
                }
                this._messageBus.sendLog('未开启自动提交，答案已保存，请手动交卷', 'warning');
                return;
            }

            if (answeredCount === total) {
                // 全部成功 -> 三步提交：保存 -> 提交 -> 确认
                this._messageBus.sendLog('答题完成，正在提交...', 'info', 'hidden');

                const saveBtn = findEl(Selectors.SAVE_BTN);
                if (saveBtn) {
                    try {
                        Utils.executeOnclick(saveBtn);
                        this._messageBus.sendLog('已点击保存按钮', 'success', 'hidden');
                        await Utils.sleep(1000);
                    } catch (e) {}
                }

                const submitBtn = findEl(Selectors.SUBMIT_BTN);
                if (submitBtn) {
                    try {
                        Utils.executeOnclick(submitBtn);
                        this._messageBus.sendLog('已点击提交按钮', 'success', 'hidden');
                        await Utils.sleep(2000);
                    } catch (e) {}

                    const confirmBtn = findEl(Selectors.CONFIRM_BTN);
                    if (confirmBtn) {
                        Utils.executeOnclick(confirmBtn);
                        this._messageBus.sendLog('已确认提交', 'success', 'hidden');
                    }

                    // 简洁层结果行
                    this._messageBus.sendLog(`已自动提交（${answeredCount}/${total}）`, 'success');

                    // 关闭弹窗
                    try {
                        const workpop = findEl(Selectors.WORKPOP);
                        if (workpop) workpop.style.display = 'none';
                    } catch (e) {}
                } else {
                    this._messageBus.sendLog('未找到提交按钮，请手动提交', 'warning');
                }
            } else if (answeredCount > 0) {
                // 部分成功 -> 仅保存不提交
                this._messageBus.sendLog(`部分题目未完成(${answeredCount}/${total})，仅保存不提交`, 'warning');
                const saveBtn = findEl(Selectors.SAVE_BTN);
                if (saveBtn) {
                    try { Utils.executeOnclick(saveBtn); } catch (e) {}
                }
            }
        }

        /**
         * 刷课主函数
         */
        async start() {
            if (!this._config.enabled) return;

            this._finishNotified = false;
            this._messageBus.sendLog('开始刷课...', 'info');

            if (!this.isCoursePage()) {
                this._messageBus.sendLog('当前不是课程学习页面，请进入课程页面后再使用刷课', 'error');
                this.notifyFinishedIfNeeded();
                return;
            }

            const chapters = this.parseCourseTree();
            this._messageBus.sendLog(`解析到 ${chapters.length} 个章节`, 'info', 'hidden');

            if (chapters.length === 0) {
                this._messageBus.sendLog('未找到课程目录树，请确认已打开具体课程页面', 'error');
                this._messageBus.sendFinished();
                return;
            }

            // 目录读不到任务数时（类名变更/新版UI等），回退为逐章尝试，
            // 避免所有章节 hasTask=false 导致 0/0 秒跳、作业全部漏处理
            if (chapters.reduce((s, c) => s + c.taskCount, 0) === 0) {
                this._messageBus.sendLog('目录未提供任务数信息，回退为逐章尝试模式', 'warning');
                for (const c of chapters) {
                    if (!c.completed) c.hasTask = true;
                }
                if (typeof XB !== 'undefined' && XB.Log) {
                    XB.Log.detail('TASK', '任务数解析为0，已回退逐章尝试', { chapters: chapters.length });
                }
            }

            const unfinishedChapters = chapters.filter(c => !c.completed && c.hasTask);
            this._messageBus.sendLog(`未完成章节: ${unfinishedChapters.length} 个`, 'info', 'hidden');

            if (unfinishedChapters.length === 0) {
                this._messageBus.sendLog('所有章节已完成！', 'success');
                this.notifyFinishedIfNeeded();
                return;
            }

            // 从当前激活的章节开始
            let currentIndex = chapters.findIndex(c => c.element.classList.contains(Selectors.CHAPTER_ACTIVE));

            if (currentIndex === -1) {
                currentIndex = chapters.findIndex(c => !c.completed && c.hasTask);
            }

            if (currentIndex === -1) {
                this._messageBus.sendLog('未找到可处理的章节', 'success');
                this.notifyFinishedIfNeeded();
                return;
            }

            const totalEstimated = chapters.reduce((sum, c) => sum + c.taskCount, 0);
            let totalTasks = totalEstimated;
            let completedTasks = 0;
            let discoveredTotal = 0;     // 已处理章节实际发现的任务点累计
            let processedEstimated = 0;  // 已处理章节的目录预估累计

            this._messageBus.sendProgress(0, totalTasks);

            let round = 0;
            const maxRounds = chapters.length * 2;
            let consecutiveNoProgress = 0;

            while (this._isRunning && round < maxRounds) {
                round++;
                const chapter = chapters[currentIndex];

                if (chapter.completed || !chapter.hasTask) {
                    if (!this._config.autoNext) {
                        this._messageBus.sendLog('自动下一章已关闭，停止刷课', 'info');
                        break;
                    }

                    const next = this.findNextChapter(chapters, currentIndex);
                    if (next) {
                        currentIndex = next.index;
                    } else {
                        break;
                    }
                    continue;
                }

                await this.navigateToChapter(chapter);
                await this.handlePopups();

                const tasksBefore = completedTasks;
                const result = await this.processChapter(chapter, completedTasks, totalTasks);
                completedTasks = result.completedTasks;

                // 动态进度修正：分母 = 实际已发现 + 剩余章节目录预估，逐步逼近真实总数。
                // 仅影响显示（目录 .orangeNew 只统计未完成任务，初始预估必然偏低），
                // 不参与停止判断/章节推进等任何控制流
                discoveredTotal += result.discoveredTasks || 0;
                processedEstimated += chapter.taskCount || 0;
                const remainingEstimated = Math.max(totalEstimated - processedEstimated, 0);
                const correctedTotal = Math.max(discoveredTotal + remainingEstimated, completedTasks);
                if (correctedTotal !== totalTasks) {
                    totalTasks = correctedTotal;
                    if (typeof XB !== 'undefined' && XB.Log) {
                        XB.Log.detail('TASK', '进度分母动态修正', {
                            chapter: chapter.name,
                            discoveredTotal,
                            remainingEstimated,
                            newTotal: totalTasks
                        });
                    }
                    this._messageBus.sendProgress(completedTasks, totalTasks);
                }

                // 连续多章没有任何任务点完成：页面状态异常，提前中止防止无限打转
                if (completedTasks > tasksBefore || result.allCompleted) {
                    consecutiveNoProgress = 0;
                } else {
                    consecutiveNoProgress++;
                    if (consecutiveNoProgress >= 3) {
                        this._messageBus.sendLog('连续 3 个章节未完成任何任务点，已停止刷课（请检查页面是否正常加载）', 'error');
                        this.notifyFinishedIfNeeded();
                        return;
                    }
                }

                if (result.allCompleted) {
                    chapter.completed = true;
                }

                await Utils.sleep(2000);
                await this.handlePopups();

                if (!this._config.autoNext) {
                    this._messageBus.sendLog('自动下一章已关闭，停止刷课', 'info');
                    break;
                }

                const next = this.findNextChapter(chapters, currentIndex);
                if (next) {
                    currentIndex = next.index;
                    await Utils.sleep(1000);
                } else {
                    this._messageBus.sendLog('所有章节已处理完毕', 'success');
                    break;
                }
            }

            const remaining = chapters.filter(c => !c.completed && c.hasTask);
            if (remaining.length === 0) {
                this._messageBus.sendLog('刷课完成！所有任务点已完成', 'success');
            } else {
                this._messageBus.sendLog(`还有 ${remaining.length} 个章节未完成`, 'warning');
            }

            this.notifyFinishedIfNeeded();
        }
    }

    XB.CoursePlayer = CoursePlayer;
})();
