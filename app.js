const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  tab: "starter",
  mode: "repeat",
  currentRepeat: QUESTION_BANK.repeat[0],
  currentInterview: QUESTION_BANK.interview[0],
  showSentence: false,
  transcript: "",
  feedback: null,
  isRecording: false,
  status: "准备开始",
  elapsed: 0,
  duration: 0,
  audioUrl: "",
  audioBlob: null,
  isScoring: false,
  audioStats: null,
  audioAnalysisPending: false,
  recordingTarget: "main",
  recognitionStats: {
    confidenceSamples: [],
    finalSegments: 0,
    interimSegments: 0
  },
  mediaRecorder: null,
  stream: null,
  recognition: null,
  timerId: null,
  lastSavedSignature: "",
  setup: loadSetupConfig(),
  ladder: loadLadderProfile(),
  coach: getDefaultCoachState(),
  starter: getDefaultStarterState(),
  wordDrill: getDefaultWordDrillState(),
  mistakeReview: getDefaultMistakeReviewState(),
  bankType: "all",
  bankDifficulty: "all",
  mistakeBookMode: "sounds",
  toast: "",
  full: {
    active: false,
    complete: false,
    examMode: true,
    sequence: [],
    index: 0,
    results: []
  }
};

const app = document.querySelector("#app");

function init() {
  state.currentRepeat = randomItem(QUESTION_BANK.repeat);
  state.currentInterview = randomItem(QUESTION_BANK.interview);
  render();
}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar()}
      ${renderNav()}
      <main class="content">
        ${renderActiveTab()}
      </main>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
  bindEvents();
  updateTimerDom();
}

function renderTopbar() {
  const history = loadHistory();
  const average = averageScore(history);
  const todayCount = history.filter((item) => isToday(item.createdAt)).length;
  const ladderLabel = state.ladder && state.ladder.diagnosed ? (LADDER_LEVELS[state.ladder.level] || LADDER_LEVELS[1]).name : "未诊断";
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">TS</div>
        <div>
          <h1 class="brand-title">VoxPilot Speaking Lab</h1>
          <p class="brand-subtitle">2026 口语练习台 · 本地保存 · 无需登录</p>
        </div>
      </div>
      <div class="top-actions">
        <span class="stat-pill"><strong>${todayCount}</strong> 今日练习</span>
        <span class="stat-pill"><strong>${average || "-"}</strong> 近况均分</span>
        <span class="stat-pill"><strong>${history.length}</strong> 本地记录</span>
        <span class="stat-pill"><strong>${escapeHtml(ladderLabel)}</strong> Ladder</span>
        <span class="stat-pill"><strong>${QUESTION_BANK.repeat.length + QUESTION_BANK.interview.length}</strong> 仿真题</span>
      </div>
    </header>
  `;
}

function renderNav() {
  const tabs = [
    ["starter", "起步训练"],
    ["ladder", "Ladder"],
    ["practice", "练习台"],
    ["full", "完整练习"],
    ["bank", "题库"],
    ["mistakes", "错题本"],
    ["history", "历史"],
    ["setup", "Setup"]
  ];
  return `
    <nav class="main-nav" aria-label="Primary navigation">
      ${tabs
        .map(
          ([id, label]) => `
            <button class="nav-button ${state.tab === id ? "active" : ""}" data-tab="${id}">
              ${label}
            </button>
          `
        )
        .join("")}
    </nav>
  `;
}

function renderActiveTab() {
  if (state.tab === "starter") return renderStarterView();
  if (state.tab === "ladder") return renderLadderView();
  if (state.tab === "full") return renderFullRunView();
  if (state.tab === "bank") return renderBankView();
  if (state.tab === "mistakes") return renderMistakeBookView();
  if (state.tab === "history") return renderHistoryView();
  if (state.tab === "setup") return renderSetupView();
  return renderPracticeView();
}

function renderPracticeView() {
  return `
    <section class="workspace">
      <aside class="panel">
        <h2>今日训练</h2>
        <p class="compact-copy">先听准，再说稳。每题完成后立刻看反馈，然后重录一次。</p>
        <div class="segmented" role="group" aria-label="Practice mode">
          <button class="${state.mode === "repeat" ? "active" : ""}" data-mode="repeat">Listen & Repeat</button>
          <button class="${state.mode === "interview" ? "active" : ""}" data-mode="interview">Interview</button>
        </div>
        ${renderMiniStats()}
      </aside>
      <div>
        ${renderPracticeCard(false)}
        ${renderFeedback()}
      </div>
    </section>
  `;
}

function renderStarterView() {
  const starter = state.starter;
  const question = getStarterQuestion();
  const steps = getStarterSteps(question);
  const step = steps[starter.step - 1] || steps[0];
  const completedToday = getTodayStarterCompletions();
  const isRepeat = question.type === "repeat";
  return `
    <section class="workspace starter-workspace">
      <aside class="panel starter-panel">
        <span class="badge blue">Start Easy</span>
        <h2>起步训练</h2>
        <p class="compact-copy">先不追求高分，把一道题拆成 4 个小台阶。Step 1-3 只看本步目标，Step 4 再回到完整题。</p>
        <div class="segmented" role="group" aria-label="Starter mode">
          <button class="${starter.mode === "interview" ? "active" : ""}" data-starter-mode="interview">Interview 起步</button>
          <button class="${starter.mode === "repeat" ? "active" : ""}" data-starter-mode="repeat">Repeat 起步</button>
        </div>
        <div class="starter-step-list">
          ${steps.map((item, index) => `
            <div class="starter-step ${starter.step === index + 1 ? "active" : ""} ${starter.step > index + 1 ? "done" : ""}">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(item.microGoal)}</small>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="mini-stats">
          <div class="mini-stat">
            <span>今日完成</span>
            <strong>${completedToday}</strong>
          </div>
          <div class="mini-stat">
            <span>当前台阶</span>
            <strong>${starter.step}/4</strong>
          </div>
        </div>
      </aside>
      <div>
        <section class="practice-board starter-board">
          <div class="practice-header">
            <div>
              <div class="badge-row">
                <span class="badge">Start Easy</span>
                <span class="badge ${isRepeat ? "violet" : "blue"}">${isRepeat ? "Listen & Repeat" : "Take an Interview"}</span>
                <span class="badge orange">Step ${starter.step}/4</span>
                <span class="badge">${escapeHtml(step.interactionLabel)}</span>
                <span class="badge blue">${escapeHtml(question.category)}</span>
              </div>
              <h2 class="question-text starter-question">${escapeHtml(step.displayText)}</h2>
              <p class="prompt-note">${escapeHtml(step.promptNote)}</p>
            </div>
            <div class="question-actions">
              ${isRepeat && starter.step === 4 ? `<button class="ghost-button" data-starter-show-sentence="true"><span class="button-icon">Aa</span>${state.showSentence ? "隐藏原句" : "显示原句"}</button>` : ""}
              <button class="ghost-button" data-play-prompt="true"><span class="button-icon">▶</span>${isRepeat ? "播放句子" : "朗读题目"}</button>
              <button class="ghost-button" data-starter-new-question="true"><span class="button-icon">↻</span>换一题</button>
            </div>
          </div>

          <div class="starter-mission">
            <div>
              <span class="badge">本步目标</span>
              <h3>${escapeHtml(step.title)}</h3>
              <p>${escapeHtml(step.mission)}</p>
            </div>
            <div class="starter-template">
              <span>${escapeHtml(step.templateLabel)}</span>
              <strong>${escapeHtml(step.template)}</strong>
            </div>
          </div>

          ${renderStarterScaffold(step)}

          <div class="control-band">
            <div class="record-control">
              <button class="record-button ${state.isRecording && state.recordingTarget === "starter" ? "recording" : ""}" data-starter-record-toggle="true" aria-label="${state.isRecording ? "停止录音" : "开始录音"}">
                <span class="record-dot"></span>
              </button>
              <span class="timer" id="timer">${formatTime(state.elapsed)}</span>
            </div>
            <div>
              <div class="control-actions">
                <button class="primary-button" data-starter-record-toggle="true">
                  <span class="button-icon">${state.isRecording && state.recordingTarget === "starter" ? "■" : "●"}</span>
                  ${state.isRecording && state.recordingTarget === "starter" ? "停止录音" : "开始录音"}
                </button>
                <button class="tool-button" data-analyze-starter="true"><span class="button-icon">✓</span>分析这一步</button>
                <button class="tool-button" data-clear-starter="true"><span class="button-icon">×</span>清空本步</button>
                ${starter.feedback && starter.step < 4 ? `<button class="tool-button" data-starter-next-step="true"><span class="button-icon">→</span>下一步</button>` : ""}
                ${starter.feedback && starter.step === 4 ? `<button class="tool-button" data-starter-to-practice="true"><span class="button-icon">→</span>去练习台完整练</button>` : ""}
              </div>
              <div class="status-line">
                <span class="status-dot ${state.isRecording && state.recordingTarget === "starter" ? "recording" : starter.feedback ? "done" : "ready"}"></span>
                <span>${escapeHtml(state.status)}</span>
              </div>
              ${state.audioUrl ? `<audio class="audio-player" controls src="${state.audioUrl}"></audio>` : ""}
            </div>
          </div>

          <div class="transcript-area">
            <label for="starterTranscriptInput">你的回答</label>
            <textarea id="starterTranscriptInput" placeholder="${SpeechRecognitionApi ? "录音时会自动生成，也可以手动修改。" : "当前浏览器不支持自动识别，请手动输入你刚才说的内容。"}">${escapeHtml(state.transcript)}</textarea>
          </div>
        </section>
        ${renderStarterFeedback()}
      </div>
    </section>
  `;
}

function renderStarterScaffold(step) {
  const items = step.scaffold || [];
  if (!items.length) return "";
  return `
    <section class="starter-scaffold ${step.scaffoldType || ""}">
      <div class="section-title-row">
        <h3>${escapeHtml(step.scaffoldTitle || "本步扶手")}</h3>
        <span class="badge">${escapeHtml(step.interactionLabel)}</span>
      </div>
      <div class="starter-scaffold-grid">
        ${items.map((item, index) => `
          <div class="starter-scaffold-item">
            <span>${index + 1}</span>
            <strong>${escapeHtml(item.label || item)}</strong>
            ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderStarterFeedback() {
  const feedback = state.starter.feedback;
  if (!feedback) {
    return `
      <section class="feedback-board starter-feedback">
        <div class="empty-feedback">完成本步录音或输入后，系统只检查当前小目标，不会调用 AI。</div>
      </section>
    `;
  }
  const resultClass = feedback.result === "pass" ? "pass" : feedback.result === "almost" ? "almost" : "retry";
  return `
    <section class="feedback-board starter-feedback">
      <div class="starter-result ${resultClass}">
        <div>
          <span class="badge">${escapeHtml(feedback.label)}</span>
          <h2>${escapeHtml(feedback.summary)}</h2>
          <p class="compact-copy">${escapeHtml(feedback.nextAction)}</p>
        </div>
        ${feedback.score ? `<div class="starter-score"><strong>${feedback.score}</strong><span>/ 6</span></div>` : ""}
      </div>
      <div class="starter-check-grid">
        ${feedback.checks.map((item) => `
          <div class="starter-check ${item.passed ? "passed" : ""}">
            <span>${item.passed ? "✓" : "•"}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </div>
          </div>
        `).join("")}
      </div>
      ${feedback.fullFeedback ? `
        <section class="feedback-section wide-section">
          <h3>完整题本地评分</h3>
          <p class="compact-copy">${escapeHtml(feedback.fullFeedback.summary)}</p>
          ${feedback.fullFeedback.confidence ? renderScoringConfidence(feedback.fullFeedback.confidence) : ""}
          ${feedback.fullFeedback.detailScores ? renderScoreBreakdown(feedback.fullFeedback.detailScores) : ""}
        </section>
      ` : ""}
    </section>
  `;
}

function renderMiniStats() {
  const history = loadHistory();
  const repeatItems = history.filter((item) => item.type === "repeat");
  const interviewItems = history.filter((item) => item.type === "interview");
  return `
    <div class="mini-stats">
      <div class="mini-stat">
        <span>复述均分</span>
        <strong>${averageScore(repeatItems) || "-"}</strong>
      </div>
      <div class="mini-stat">
        <span>问答均分</span>
        <strong>${averageScore(interviewItems) || "-"}</strong>
      </div>
      <div class="mini-stat">
        <span>最近题数</span>
        <strong>${history.slice(0, 10).length}</strong>
      </div>
      <div class="mini-stat">
        <span>连续目标</span>
        <strong>${history.length ? "再练" : "开始"}</strong>
      </div>
    </div>
  `;
}

function renderLadderView() {
  const profile = state.ladder;
  if (!profile.diagnosed) return renderLadderDiagnostic(profile);

  const level = LADDER_LEVELS[profile.level] || LADDER_LEVELS[1];
  const step = getCurrentLadderStep(profile);
  const plan = getTodayLadderPlan(profile);
  const recentAverage = averageScore((profile.recent || []).slice(0, 8));
  const progress = getStepProgress(profile, step.id);
  const recommendation = DRILL_LIBRARY[profile.recommendedDrill] || DRILL_LIBRARY["example-builder"];
  const coachProfile = loadCoachProfile();

  return `
    <section class="ladder-board">
      <div class="ladder-hero">
        <div>
          <div class="badge-row">
            <span class="badge violet">VoxPilot Ladder</span>
            <span class="badge blue">${escapeHtml(level.name)}</span>
            <span class="badge orange">Step ${profile.step}/5</span>
          </div>
          <h2>${escapeHtml(step.title)}</h2>
          <p>${escapeHtml(level.target)}</p>
        </div>
        <div class="ladder-score">
          <span>Recent Avg</span>
          <strong>${recentAverage || "-"}</strong>
        </div>
      </div>

      <div class="ladder-grid">
        <section class="feedback-section">
          <h3>Current Step</h3>
          <p class="upgrade-answer">${escapeHtml(step.goal)}</p>
          <div class="ladder-progress">
            <div class="progress-track">
              <div class="progress-fill" style="width: ${Math.min(100, progress.points * 33.34)}%"></div>
            </div>
            <span>${progress.points}/3 stable passes to level up this step</span>
          </div>
          <div class="item-meta">
            <span class="badge">${escapeHtml(DRILL_LIBRARY[step.drill].label)}</span>
            <span class="badge blue">${escapeHtml(step.difficulty)}</span>
          </div>
        </section>

        <section class="feedback-section">
          <h3>Recommended Fix</h3>
          <p class="upgrade-answer">${escapeHtml(recommendation.tip)}</p>
          <div class="item-meta">
            <span class="badge orange">${escapeHtml(recommendation.label)}</span>
            ${(profile.weaknesses || []).slice(0, 3).map((item) => `<span class="badge blue">${escapeHtml(item)}</span>`).join("")}
          </div>
          ${state.setup.coach?.enabled ? `
            <div class="coach-inline-actions">
              <button class="primary-button" data-start-coach-ladder="true"><span class="button-icon">◎</span>用 Coach 练这个 Fix</button>
            </div>
          ` : ""}
        </section>
      </div>

      ${renderCoachProfileSummary(coachProfile)}
      ${state.coach.active ? renderCoachCapsule() : ""}

      <section class="feedback-section wide-section">
        <div class="history-top">
          <div>
            <h3>Today's Ladder</h3>
            <p class="compact-copy">按顺序练：热身、核心任务、补弱、检查点。每题评分后会自动更新阶梯。</p>
          </div>
          <button class="ghost-button" data-reset-ladder-plan="true"><span class="button-icon">↻</span>换一组</button>
        </div>
        <div class="ladder-plan">
          ${plan.tasks
            .map((task, index) => renderLadderTask(task, index))
            .join("")}
        </div>
      </section>

      <section class="feedback-section wide-section">
        <div class="history-top">
          <div>
            <h3>Level Control</h3>
            <p class="compact-copy">想重新定位水平，可以重做 6 题诊断。</p>
          </div>
          <button class="danger-button" data-reset-ladder="true"><span class="button-icon">×</span>重置 Ladder</button>
        </div>
      </section>
    </section>
  `;
}

function renderLadderDiagnostic(profile) {
  const diagnostic = profile.diagnostic || null;
  const active = diagnostic && diagnostic.active;
  const total = active ? diagnostic.sequence.length : 6;
  const done = active ? diagnostic.results.length : 0;
  const currentQuestion = active ? getQuestionById(diagnostic.sequence[Math.min(diagnostic.index, diagnostic.sequence.length - 1)]) : null;

  return `
    <section class="ladder-board">
      <div class="ladder-hero">
        <div>
          <div class="badge-row">
            <span class="badge violet">VoxPilot Ladder</span>
            <span class="badge blue">Diagnostic</span>
          </div>
          <h2>Start From Your Real Level</h2>
          <p>先做 6 题短诊断：3 道复述 + 3 道问答。系统会根据稳定表现分配等级和第一阶段训练。</p>
        </div>
        <div class="ladder-score">
          <span>Progress</span>
          <strong>${done}/${total}</strong>
        </div>
      </div>

      <section class="feedback-section wide-section">
        <h3>${active ? "Continue Diagnostic" : "Diagnostic Set"}</h3>
        <p class="compact-copy">
          ${active && currentQuestion ? `下一题：${escapeHtml(currentQuestion.text)}` : "诊断会从简单题开始，逐步覆盖中等和高难题。"}
        </p>
        <div class="summary-grid">
          <div class="summary-tile"><span>Repeat</span><strong>3</strong></div>
          <div class="summary-tile"><span>Interview</span><strong>3</strong></div>
          <div class="summary-tile"><span>Time</span><strong>8m</strong></div>
          <div class="summary-tile"><span>Result</span><strong>Level</strong></div>
        </div>
        <div class="control-actions" style="margin-top: 16px">
          <button class="primary-button" data-ladder-diagnostic-next="true">
            <span class="button-icon">▶</span>${active ? "继续诊断" : "开始诊断"}
          </button>
          ${active ? `<button class="ghost-button" data-reset-ladder="true"><span class="button-icon">×</span>重新开始</button>` : ""}
        </div>
      </section>
    </section>
  `;
}

function renderLadderTask(task, index) {
  const question = getQuestionById(task.questionId);
  const completed = task.completed ? "done" : "";
  return `
    <article class="ladder-task ${completed}">
      <div>
        <div class="item-meta">
          <span class="badge">${escapeHtml(task.label)}</span>
          <span class="badge blue">${question ? (question.type === "repeat" ? "Repeat" : "Interview") : "Mixed"}</span>
          <span class="badge orange">${escapeHtml(task.drillLabel)}</span>
        </div>
        <p class="item-title">${escapeHtml(task.goal)}</p>
        <p class="compact-copy">${question ? escapeHtml(question.text) : "Question will be selected when you start."}</p>
      </div>
      <button class="${task.completed ? "ghost-button" : "small-button"}" data-ladder-plan-index="${index}">
        ${task.completed ? "再练" : "开始"}
      </button>
    </article>
  `;
}

function renderPracticeCard(isFullRun) {
  const question = getActiveQuestion(isFullRun);
  const isRepeat = question.type === "repeat";
  const examLocked = isFullRun && state.full.examMode;
  const text = isRepeat && !state.showSentence ? "播放句子后复述，完成后再显示原句。" : question.text;
  const difficultyClass = question.difficulty === "Hard" ? "orange" : question.difficulty === "Medium" ? "blue" : "";
  const fullProgress = isFullRun ? renderFullProgress() : "";

  return `
    <section class="practice-board">
      ${fullProgress}
      <div class="practice-header">
        <div>
          <div class="badge-row">
            <span class="badge">${isRepeat ? "Listen and Repeat" : "Take an Interview"}</span>
            <span class="badge blue">${escapeHtml(question.category)}</span>
            <span class="badge ${difficultyClass}">${escapeHtml(question.difficulty)}</span>
          </div>
          <h2 class="question-text ${isRepeat ? "sentence-text" : ""} ${isRepeat && !state.showSentence ? "blurred" : ""}">
            ${escapeHtml(text)}
          </h2>
          <p class="prompt-note">
            ${isRepeat ? escapeHtml(question.focus) : "建议 35-60 秒：直接回答、给理由、给例子、收束观点。"}
          </p>
        </div>
        <div class="question-actions">
          ${isRepeat && !examLocked ? `<button class="ghost-button" data-show-sentence="true"><span class="button-icon">Aa</span>${state.showSentence ? "隐藏原句" : "显示原句"}</button>` : ""}
          <button class="ghost-button" data-play-prompt="true"><span class="button-icon">▶</span>${isRepeat ? "播放" : "朗读题目"}</button>
          ${!examLocked ? `<button class="ghost-button" data-next-question="true"><span class="button-icon">↻</span>${isFullRun ? "换本题" : "下一题"}</button>` : ""}
        </div>
      </div>

      <div class="control-band">
        <div class="record-control">
          <button class="record-button ${state.isRecording ? "recording" : ""}" data-record-toggle="true" aria-label="${state.isRecording ? "停止录音" : "开始录音"}">
            <span class="record-dot"></span>
          </button>
          <span class="timer" id="timer">${formatTime(state.elapsed)}</span>
        </div>
        <div>
          <div class="control-actions">
            <button class="primary-button" data-record-toggle="true">
              <span class="button-icon">${state.isRecording ? "■" : "●"}</span>
              ${state.isRecording ? "停止录音" : "开始录音"}
            </button>
            <button class="tool-button" data-analyze="true"><span class="button-icon">✓</span>分析</button>
            <button class="tool-button" data-clear-current="true"><span class="button-icon">×</span>清空</button>
            ${isFullRun && state.feedback ? `<button class="tool-button" data-full-next="true"><span class="button-icon">→</span>${state.full.index === state.full.sequence.length - 1 ? "完成" : "下一题"}</button>` : ""}
          </div>
          <div class="status-line">
            <span class="status-dot ${state.isRecording ? "recording" : state.feedback ? "done" : "ready"}"></span>
            <span>${escapeHtml(state.status)}</span>
          </div>
          ${state.audioUrl ? `<audio class="audio-player" controls src="${state.audioUrl}"></audio>` : ""}
        </div>
      </div>

      <div class="transcript-area">
        <label for="transcriptInput">转写文本</label>
        <textarea id="transcriptInput" placeholder="${SpeechRecognitionApi ? "录音时会自动生成，也可以手动修改。" : "当前浏览器不支持自动识别，请在这里输入你刚才说的内容。"}">${escapeHtml(state.transcript)}</textarea>
      </div>
    </section>
  `;
}

function renderFullProgress() {
  const total = state.full.sequence.length || 11;
  const current = Math.min(state.full.index + 1, total);
  const percent = total ? Math.round((state.full.index / total) * 100) : 0;
  return `
    <div class="badge-row">
      <span class="badge violet">完整练习 ${current}/${total}</span>
      <span class="badge blue">约 8 分钟</span>
    </div>
    <div class="progress-track" aria-label="Full practice progress">
      <div class="progress-fill" style="width: ${percent}%"></div>
    </div>
    <div style="height: 18px"></div>
  `;
}

function renderFeedback() {
  if (!state.feedback) {
    return `
      <section class="feedback-board">
        <div class="empty-feedback">${state.isScoring ? "正在生成评分报告，外部 API 可能需要几秒。" : "完成录音后，这里会显示分数、问题诊断和复练建议。"}</div>
      </section>
    `;
  }

  const feedback = state.feedback;
  const meterWidth = Math.max(0, Math.min(100, Math.round((feedback.score / 6) * 100)));
  return `
    <section class="feedback-board">
      <h2>本次反馈</h2>
      <p class="compact-copy">${escapeHtml(feedback.summary)}</p>
      ${feedback.confidence ? renderScoringConfidence(feedback.confidence) : ""}
      <div class="feedback-grid">
        <aside class="score-box">
          <div class="score-number">${feedback.score}<span>/ 6</span></div>
          <div class="meter"><div class="meter-fill" style="width: ${meterWidth}%"></div></div>
          <div class="metric-list">
            ${feedback.metrics
              .map(
                (metric) => `
                  <div class="metric-row">
                    <span>${escapeHtml(metric.label)}</span>
                    <strong>${escapeHtml(metric.value)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </aside>
        <div class="feedback-columns">
          <section class="feedback-section">
            <h3>做得好的地方</h3>
            <ul>${feedback.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
          <section class="feedback-section">
            <h3>优先修正</h3>
            <ul>${feedback.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
          ${feedback.detailScores ? renderScoreBreakdown(feedback.detailScores) : ""}
          ${feedback.rubricProfile ? renderRubricProfile(feedback.rubricProfile) : ""}
          ${feedback.comparison ? renderAttemptComparison(feedback.comparison) : ""}
          ${feedback.externalAi ? renderExternalAiSection(feedback.externalAi) : ""}
          ${feedback.pronunciation ? renderPronunciationSection(feedback.pronunciation) : ""}
          ${feedback.alignment ? renderDiffSection(feedback.alignment) : ""}
          <section class="feedback-section wide-section">
            <h3>${feedback.type === "repeat" ? "下一遍怎么练" : "示范升级答案"}</h3>
            <p class="upgrade-answer">${escapeHtml(feedback.improvedAnswer)}</p>
          </section>
        </div>
      </div>
      ${renderCoachEntryFromFeedback()}
      ${state.coach.active ? renderCoachCapsule() : ""}
    </section>
  `;
}

function renderCoachEntryFromFeedback() {
  if (!state.setup.coach?.enabled || !state.feedback || !cleanupSpacing(state.transcript) || state.coach.active) return "";
  const aiReady = canUseCoachAi();
  return `
    <section class="coach-entry">
      <div>
        <div class="badge-row">
          <span class="badge violet">Coach Capsule</span>
          <span class="badge">${aiReady ? "AI 深度复练可用" : "Basic 本地复练"}</span>
        </div>
        <h3>想知道下一遍具体怎么改？</h3>
        <p class="compact-copy">Coach 会把这次回答拆成一个小练习，并让你重答一次看变化。没配置 API 时走 Basic 本地规则；开启 AI 后会用你的 Setup 配置生成更细诊断。</p>
      </div>
      <button class="primary-button" data-start-coach-current="true"><span class="button-icon">◎</span>让 Coach 拆解这题</button>
    </section>
  `;
}

function renderCoachCapsule() {
  const coach = state.coach;
  if (!coach.active) return "";
  const modeLabel = coach.usedAi ? "AI Coach" : "Basic Local Coach";
  return `
    <section class="coach-capsule">
      <div class="history-top">
        <div>
          <div class="badge-row">
            <span class="badge violet">Coach Deep Retake</span>
            <span class="badge blue">${escapeHtml(modeLabel)}</span>
            <span class="badge">${escapeHtml(coach.source || "practice")}</span>
          </div>
          <h2>从反馈到行动</h2>
          <p class="compact-copy">一次只抓一个主要问题：诊断 → 小练习 → 重答 → 对比。</p>
        </div>
        <button class="ghost-button" data-coach-reset="true"><span class="button-icon">×</span>收起 Coach</button>
      </div>
      ${renderCoachStepper(coach.phase)}
      ${coach.error ? `<div class="coach-alert">${escapeHtml(coach.error)}</div>` : ""}
      ${renderCoachDiagnosis()}
      ${renderCoachDrill()}
      ${renderCoachRetake()}
      ${renderCoachReflection()}
    </section>
  `;
}

function renderCoachStepper(phase) {
  const order = [
    ["diagnosing", "Diagnosis"],
    ["drill-ready", "Micro-Drill"],
    ["retaking", "Retake"],
    ["complete", "Reflection"]
  ];
  const activeIndex = Math.max(0, order.findIndex(([key]) => key === phase));
  const safeIndex = phase === "reflecting" ? 3 : activeIndex;
  return `
    <div class="coach-stepper">
      ${order.map(([key, label], index) => {
        const className = index < safeIndex ? "done" : index === safeIndex ? "active" : "";
        return `<div class="coach-step ${className}"><span>${index + 1}</span>${escapeHtml(label)}</div>`;
      }).join("")}
    </div>
  `;
}

function renderCoachDiagnosis() {
  const coach = state.coach;
  if (coach.phase === "diagnosing") {
    return `
      <section class="coach-card coach-diagnosis">
        <h3>Step 1 · Diagnosis</h3>
        <p class="upgrade-answer">Coach 正在读取题目、转写、本地评分、音频指标和最近弱项。</p>
      </section>
    `;
  }
  if (!coach.diagnosis) return "";
  const weaknessLabel = getWeaknessLabel(coach.diagnosis.primaryWeakness, coach.original.taskType);
  return `
    <section class="coach-card coach-diagnosis">
      <div class="section-title-row">
        <h3>Step 1 · Diagnosis</h3>
        <span class="badge orange">${escapeHtml(weaknessLabel)}</span>
      </div>
      <p class="upgrade-answer">${escapeHtml(coach.diagnosis.mainDiagnosis)}</p>
      <h4>为什么这么判断</h4>
      <ul class="coach-evidence">
        ${(coach.diagnosis.evidence || []).slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderCoachDrill() {
  const coach = state.coach;
  if (!coach.drill || !["drill-ready", "retaking", "reflecting", "complete"].includes(coach.phase)) return "";
  return `
    <section class="coach-card coach-drill">
      <div class="section-title-row">
        <h3>Step 2 · Micro-Drill</h3>
        <span class="badge violet">${escapeHtml(coach.drill.title)}</span>
      </div>
      <p class="upgrade-answer">${escapeHtml(coach.drill.instruction)}</p>
      <div class="coach-mission">
        <strong>Retake Mission</strong>
        <p>${escapeHtml(coach.drill.retakeMission)}</p>
        <ul>
          ${(coach.drill.successCriteria || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
      ${coach.phase === "drill-ready" ? `
        <div class="control-actions">
          <button class="primary-button" data-start-coach-retake="true"><span class="button-icon">●</span>开始 Coach 重答</button>
        </div>
      ` : ""}
    </section>
  `;
}

function renderCoachRetake() {
  const coach = state.coach;
  if (!["retaking", "reflecting", "complete"].includes(coach.phase)) return "";
  const isCoachRecording = state.isRecording && state.recordingTarget === "coach";
  const recordingBlocked = state.isRecording && state.recordingTarget !== "coach";
  const retakeText = cleanupSpacing(coach.retake.transcript);
  return `
    <section class="coach-card">
      <div class="section-title-row">
        <h3>Step 3 · Retake</h3>
        <span class="badge">${retakeText ? `${normalizeWords(retakeText).length} words` : "等待重答"}</span>
      </div>
      <div class="recorder-row compact-recorder">
        <div class="timer">${formatTime(isCoachRecording ? state.elapsed : coach.retake.duration || 0)}</div>
        <button class="record-button ${isCoachRecording ? "recording" : ""}" data-coach-record-toggle="true" ${recordingBlocked ? "disabled" : ""} aria-label="Coach retake record">
          <span class="record-dot"></span>
          <span>${isCoachRecording ? "停止录音" : "录 Coach 重答"}</span>
        </button>
        <div class="control-actions">
          <button class="primary-button" data-analyze-coach-retake="true" ${coach.phase === "reflecting" ? "disabled" : ""}><span class="button-icon">✓</span>分析重答</button>
          <button class="ghost-button" data-start-coach-retake="true"><span class="button-icon">↻</span>重新重答</button>
        </div>
      </div>
      ${coach.retake.audioUrl ? `<audio class="audio-player" controls src="${coach.retake.audioUrl}"></audio>` : ""}
      <label class="transcript-box">
        <span>Coach 重答转写</span>
        <textarea id="coachTranscriptInput" placeholder="${SpeechRecognitionApi ? "录音时会自动生成，也可以手动修改。" : "当前浏览器不支持自动识别，请在这里输入 Coach 重答内容。"}">${escapeHtml(coach.retake.transcript)}</textarea>
      </label>
      ${coach.phase === "reflecting" ? `<p class="compact-copy">Coach 正在比较第一遍和第二遍。</p>` : ""}
    </section>
  `;
}

function renderCoachReflection() {
  const coach = state.coach;
  if (coach.phase !== "complete" || !coach.reflection) return "";
  return `
    <section class="coach-card coach-reflection">
      <div class="section-title-row">
        <h3>Step 4 · Reflection</h3>
        <span class="badge ${coach.reflection.improved ? "blue" : "orange"}">${coach.reflection.improved ? "有明显改进" : "还需要一遍"}</span>
      </div>
      <div class="coach-before-after">
        <div>
          <h4>Before</h4>
          <p>${escapeHtml(coach.original.transcript || "暂无第一遍文本")}</p>
        </div>
        <div>
          <h4>After</h4>
          <p>${escapeHtml(coach.retake.transcript || "暂无重答文本")}</p>
        </div>
      </div>
      <p class="upgrade-answer">${escapeHtml(coach.reflection.improvementSummary)}</p>
      <ul class="coach-evidence">
        ${(coach.reflection.visibleChanges || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <div class="coach-mission">
        <strong>Next Action</strong>
        <p>${escapeHtml(coach.reflection.nextAction)}</p>
      </div>
    </section>
  `;
}

function renderCoachProfileSummary(profile = loadCoachProfile()) {
  const weakness = profile.primaryWeakness
    ? getWeaknessLabel(profile.primaryWeakness, profile.primaryWeakness in REPEAT_WEAKNESSES ? "repeat" : "interview")
    : "还没有稳定弱项";
  const drill = DRILL_LIBRARY[profile.currentDrill] || DRILL_LIBRARY["example-builder"];
  return `
    <section class="feedback-section wide-section coach-profile-summary">
      <div class="history-top">
        <div>
          <h3>Coach Profile</h3>
          <p class="compact-copy">长期记忆只存在当前浏览器。Basic 会记录弱项和复练结果；AI 只在你开启 Setup 后用于生成更细诊断。</p>
        </div>
        <div class="coach-profile-chip">
          <span>${escapeHtml(weakness)}</span>
          <strong>${profile.stablePasses || 0}/3 stable</strong>
        </div>
      </div>
      <div class="item-meta">
        <span class="badge violet">${escapeHtml(profile.levelHint || "L?")}</span>
        <span class="badge blue">${escapeHtml(drill.label)}</span>
        <span class="badge orange">${escapeHtml(profile.currentCoachGoal || "完成一次 Coach 重答后生成目标")}</span>
      </div>
    </section>
  `;
}

function renderScoringConfidence(confidence) {
  const signals = confidence.signals || [];
  return `
    <section class="feedback-section wide-section confidence-section">
      <div class="section-title-row">
        <h3>评分可信度</h3>
        <span class="badge ${confidence.level === "high" ? "blue" : confidence.level === "medium" ? "orange" : ""}">${escapeHtml(confidence.label)}</span>
      </div>
      <div class="confidence-meter" aria-label="评分可信度">
        <div style="width: ${Math.round((confidence.score || 0) * 100)}%"></div>
      </div>
      <p class="compact-copy">${escapeHtml(confidence.note || "本地评分是模拟训练反馈，不等同 ETS 官方评分。")}</p>
      <div class="item-meta">
        ${signals.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}
      </div>
      ${confidence.reasons && confidence.reasons.length ? `
        <ul class="confidence-reasons">
          ${confidence.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      ` : ""}
    </section>
  `;
}

function renderDiffSection(alignment) {
  return `
    <section class="feedback-section wide-section">
      <h3>原句对比</h3>
      <div class="diff-line">
        ${alignment
          .map((token) => {
            if (token.type === "match") return `<span class="word-token match">${escapeHtml(token.ref)}</span>`;
            if (token.type === "substitute") return `<span class="word-token substitute">${escapeHtml(token.ref)} → ${escapeHtml(token.hyp)}</span>`;
            if (token.type === "missing") return `<span class="word-token missing">${escapeHtml(token.ref)}</span>`;
            return `<span class="word-token extra">+ ${escapeHtml(token.hyp)}</span>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderScoreBreakdown(detailScores) {
  return `
    <section class="feedback-section wide-section">
      <h3>评分细目</h3>
      <div class="score-breakdown">
        ${detailScores
          .map(
            (item) => `
              <div class="breakdown-row">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${escapeHtml(item.detail)}</span>
                </div>
                <div class="breakdown-meter" aria-label="${escapeHtml(item.label)}">
                  <div style="width: ${Math.round(item.score * 100)}%"></div>
                </div>
                <b>${Math.round(item.score * 100)}%</b>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRubricProfile(rubricProfile) {
  return `
    <section class="feedback-section wide-section">
      <h3>考试权重</h3>
      <div class="rubric-grid">
        ${rubricProfile
          .map(
            (item) => `
              <div class="rubric-tile">
                <span>${escapeHtml(item.label)}</span>
                <strong>${Math.round(item.weight * 100)}%</strong>
                <p>${escapeHtml(item.note)}</p>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAttemptComparison(comparison) {
  return `
    <section class="feedback-section wide-section">
      <h3>复练对比</h3>
      <div class="comparison-grid">
        <div class="comparison-score ${comparison.delta >= 0 ? "up" : "down"}">
          <span>相对上次</span>
          <strong>${comparison.delta >= 0 ? "+" : ""}${comparison.delta}</strong>
        </div>
        <div>
          <p class="upgrade-answer">${escapeHtml(comparison.summary)}</p>
          <ul class="pron-notes">
            ${comparison.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
    </section>
  `;
}

function renderExternalAiSection(externalAi) {
  const dimensions = Object.entries(externalAi.dimensionScores || {}).slice(0, 8);
  return `
    <section class="feedback-section wide-section">
      <h3>AI 评分增强</h3>
      <div class="external-grid">
        <div class="pron-tile">
          <span>AI 分数</span>
          <strong>${externalAi.score ? `${externalAi.score}/6` : "-"}</strong>
        </div>
        <div class="external-copy">
          <p class="upgrade-answer">${escapeHtml(externalAi.summary || "AI 已返回评分补充。")}</p>
          ${externalAi.grammarNotes && externalAi.grammarNotes.length ? `
            <ul class="pron-notes">
              ${externalAi.grammarNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          ` : ""}
        </div>
      </div>
      ${dimensions.length ? `
        <div class="item-meta">
          ${dimensions.map(([key, value]) => `<span class="badge blue">${escapeHtml(key)} ${escapeHtml(String(value))}</span>`).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderPronunciationSection(pronunciation) {
  const stats = pronunciation.audioStats || {};
  const statsItems = [
    ["本地可理解度代理", `${Math.round(pronunciation.score * 100)}%`],
    ["识别置信", `${Math.round(pronunciation.confidence * 100)}%`],
    ["录音质量", `${Math.round(pronunciation.audioQuality * 100)}%`],
    ["停顿控制", `${Math.round(pronunciation.pauseControl * 100)}%`],
    ["发声语速", pronunciation.articulationRate ? `${pronunciation.articulationRate} WPM` : "-"],
    ["最长停顿", stats.available ? `${stats.longestSilence.toFixed(1)}s` : "-"],
    ["静音占比", stats.available ? `${Math.round(stats.silenceRatio * 100)}%` : "-"],
    ["估算 SNR", stats.available ? `${Math.round(stats.snrDb)} dB` : "-"]
  ];

  return `
    <section class="feedback-section wide-section">
      <h3>本地可理解度与音频诊断</h3>
      <div class="pron-grid">
        ${statsItems
          .map(
            ([label, value]) => `
              <div class="pron-tile">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <ul class="pron-notes">
        ${pronunciation.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      ${pronunciation.external ? renderExternalPronunciation(pronunciation.external) : ""}
      ${pronunciation.phonemeFocus && pronunciation.phonemeFocus.length ? `
        <h4 class="subsection-title">疑似音素训练点</h4>
        <p class="compact-copy">Basic 本地模式只给出练习靶点，不等同真正逐音素评分；外部 API 返回的 phoneme score 会优先显示在这里。</p>
        <div class="phoneme-list">
          ${pronunciation.phonemeFocus
            .map(
              (item) => `
                <div class="phoneme-card">
                  <strong>${escapeHtml(item.sound)}</strong>
                  <span>${escapeHtml(item.label)}</span>
                  <p>${escapeHtml(item.tip)}</p>
                  <small>${escapeHtml(item.words.join(", "))}</small>
                </div>
              `
            )
            .join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderExternalPronunciation(external) {
  const stats = [
    ["Provider", external.provider || "-"],
    ["Pron", external.score !== null ? `${Math.round(external.score * 100)}%` : "-"],
    ["Accuracy", external.accuracy !== null ? `${Math.round(external.accuracy * 100)}%` : "-"],
    ["Fluency", external.fluency !== null ? `${Math.round(external.fluency * 100)}%` : "-"],
    ["Completeness", external.completeness !== null ? `${Math.round(external.completeness * 100)}%` : "-"]
  ];
  return `
    <div class="external-pron">
      <h4 class="subsection-title">外部发音 / 逐音素评分</h4>
      <div class="pron-grid">
        ${stats
          .map(
            ([label, value]) => `
              <div class="pron-tile">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      ${external.phonemes && external.phonemes.length ? `
        <div class="item-meta">
          ${external.phonemes.slice(0, 8).map((item) => `<span class="badge orange">${escapeHtml(item.word || "")} ${escapeHtml(item.sound || item.phoneme || "")} ${Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) : ""}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderFullRunView() {
  if (state.full.complete) {
    return renderFullSummary();
  }

  if (!state.full.active) {
    return `
      <section class="full-run-board">
        <div class="full-setup">
          <div>
            <h2>完整练习</h2>
            <p class="compact-copy">一次完成 11 题：6 道复述，5 道面试问答。考试模式会自动朗读题目，锁定换题和显示原句。</p>
          </div>
          <button class="primary-button" data-start-full="true"><span class="button-icon">▶</span>开始完整练习</button>
        </div>
        ${renderFullTips()}
      </section>
    `;
  }

  return `
    <div>
      ${renderPracticeCard(true)}
      ${renderFeedback()}
    </div>
  `;
}

function renderFullTips() {
  return `
    <div class="summary-grid">
      <div class="summary-tile">
        <span>题量</span>
        <strong>11</strong>
      </div>
      <div class="summary-tile">
        <span>复述</span>
        <strong>6</strong>
      </div>
      <div class="summary-tile">
        <span>问答</span>
        <strong>5</strong>
      </div>
      <div class="summary-tile">
        <span>保存</span>
        <strong>本地</strong>
      </div>
    </div>
  `;
}

function renderFullSummary() {
  const results = state.full.results;
  const avg = averageScore(results.map((item) => ({ score: item.feedback.score })));
  const repeatAvg = averageScore(results.filter((item) => item.question.type === "repeat").map((item) => ({ score: item.feedback.score })));
  const interviewAvg = averageScore(results.filter((item) => item.question.type === "interview").map((item) => ({ score: item.feedback.score })));
  const commonIssues = results.flatMap((item) => item.feedback.issues).slice(0, 5);

  return `
    <section class="full-run-board">
      <div class="history-top">
        <div>
          <h2>本轮总结</h2>
          <p class="compact-copy">平均分 ${avg || "-"}。下一轮建议优先重练分数最低的两题。</p>
        </div>
        <button class="primary-button" data-start-full="true"><span class="button-icon">↻</span>再来一轮</button>
      </div>
      <div class="summary-grid">
        <div class="summary-tile"><span>总均分</span><strong>${avg || "-"}</strong></div>
        <div class="summary-tile"><span>复述均分</span><strong>${repeatAvg || "-"}</strong></div>
        <div class="summary-tile"><span>问答均分</span><strong>${interviewAvg || "-"}</strong></div>
        <div class="summary-tile"><span>完成题数</span><strong>${results.length}</strong></div>
      </div>
      <section class="feedback-section" style="margin-top: 16px">
        <h3>下次优先修正</h3>
        <ul>${(commonIssues.length ? commonIssues : ["继续保持完整回答，并在每题结束后立刻复练一次。"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </section>
  `;
}

function renderBankView() {
  const items = getFilteredQuestions();
  return `
    <section>
      <div class="history-top">
        <div>
          <h2>题库</h2>
          <p class="compact-copy">现在共有 ${QUESTION_BANK.repeat.length + QUESTION_BANK.interview.length} 道仿真题。题目基于 ETS 公开题型说明原创编写，不包含泄露考场题。</p>
        </div>
        <button class="primary-button" data-random-bank="true"><span class="button-icon">↻</span>随机练一题</button>
      </div>
      <div class="filters">
        <select id="bankType">
          <option value="all" ${state.bankType === "all" ? "selected" : ""}>全部题型</option>
          <option value="repeat" ${state.bankType === "repeat" ? "selected" : ""}>Listen and Repeat</option>
          <option value="interview" ${state.bankType === "interview" ? "selected" : ""}>Take an Interview</option>
        </select>
        <select id="bankDifficulty">
          <option value="all" ${state.bankDifficulty === "all" ? "selected" : ""}>全部难度</option>
          <option value="Easy" ${state.bankDifficulty === "Easy" ? "selected" : ""}>Easy</option>
          <option value="Medium" ${state.bankDifficulty === "Medium" ? "selected" : ""}>Medium</option>
          <option value="Hard" ${state.bankDifficulty === "Hard" ? "selected" : ""}>Hard</option>
        </select>
      </div>
      <div class="bank-list">
        ${items
          .map(
            (item) => `
              <article class="bank-item">
                <div>
                  <p class="item-title">${escapeHtml(item.text)}</p>
                  <div class="item-meta">
                    <span class="badge">${item.type === "repeat" ? "Repeat" : "Interview"}</span>
                    <span class="badge blue">${escapeHtml(item.category)}</span>
                    <span class="badge orange">${escapeHtml(item.difficulty)}</span>
                  </div>
                </div>
                <button class="small-button" data-practice-question="${item.id}">练这题</button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderHistoryView() {
  const history = loadHistory();
  return `
    <section>
      <div class="history-top">
        <div>
          <h2>本地历史</h2>
          <p class="compact-copy">记录保存在当前浏览器，不会上传到服务器。</p>
        </div>
        <div class="control-actions">
          <button class="ghost-button" data-export-history="true"><span class="button-icon">↓</span>导出历史</button>
          <button class="ghost-button" data-export-local-data="true"><span class="button-icon">⇩</span>导出全部本地数据</button>
          <button class="danger-button" data-clear-history="true"><span class="button-icon">×</span>清空本地记录</button>
        </div>
      </div>
      ${renderLocalDataPanel(history)}
      ${renderWeaknessPanel(history)}
      <div class="history-list">
        ${
          history.length
            ? history
                .map(
                  (item) => `
                    <article class="history-item">
                      <div>
                        <p class="item-title">${escapeHtml(item.prompt)}</p>
                        <p class="compact-copy">${escapeHtml(item.summary)}</p>
                        <div class="item-meta">
                          <span class="badge">${item.trainingMode === "starter" ? "Start Easy" : item.type === "repeat" ? "Repeat" : "Interview"}</span>
                          <span class="badge blue">${formatDate(item.createdAt)}</span>
                          <span class="badge orange">${item.trainingMode === "starter" ? `Step ${item.starterStep} ${item.starterResult || ""}` : `Score ${item.score}/6`}</span>
                        </div>
                      </div>
                      <div class="history-actions">
                        <button class="small-button" data-review-history="${item.id}">查看</button>
                        ${item.trainingMode === "starter" ? "" : `<button class="small-button" data-start-coach-history="${item.id}">Coach 复盘</button>`}
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<div class="empty-feedback">还没有练习记录。</div>`
        }
      </div>
    </section>
  `;
}

function renderMistakeBookView() {
  const history = loadHistory();
  const soundNotebook = buildPronunciationNotebook(history);
  const wordNotebook = buildWordPronunciationNotebook(history);
  const activeMode = state.mistakeBookMode === "words" ? "words" : "sounds";
  const isWordMode = activeMode === "words";
  const activeNotebook = isWordMode ? wordNotebook : soundNotebook;
  const totalWords = soundNotebook.reduce((sum, item) => sum + item.words.length, 0);
  const totalWordHits = wordNotebook.reduce((sum, item) => sum + item.count, 0);
  const activeSourceCount = countNotebookSources(activeNotebook);
  return `
    <section class="mistake-book">
      <div class="history-top">
        <div>
          <h2>发音错题本</h2>
          <p class="compact-copy">根据本地历史里的发音诊断、Repeat 词对齐和外部逐词结果自动整理。这里只记录当前浏览器的数据，不会上传。</p>
        </div>
        <div class="control-actions">
          <button class="ghost-button" data-tab="history"><span class="button-icon">↗</span>查看来源历史</button>
          <button class="ghost-button" data-export-local-data="true"><span class="button-icon">⇩</span>导出本地数据</button>
        </div>
      </div>

      <div class="segmented mistake-mode-toggle" role="group" aria-label="Mistake book mode">
        <button class="${activeMode === "sounds" ? "active" : ""}" data-mistake-book-mode="sounds">音素错题</button>
        <button class="${activeMode === "words" ? "active" : ""}" data-mistake-book-mode="words">单词错题</button>
      </div>

      <section class="feedback-section wide-section notebook-summary">
        <div class="summary-grid">
          <div class="summary-tile"><span>高频音素</span><strong>${soundNotebook.length}</strong></div>
          <div class="summary-tile"><span>单词错题</span><strong>${wordNotebook.length}</strong></div>
          <div class="summary-tile"><span>${isWordMode ? "错词次数" : "关联单词"}</span><strong>${isWordMode ? totalWordHits : totalWords}</strong></div>
          <div class="summary-tile"><span>来源记录</span><strong>${activeSourceCount}</strong></div>
        </div>
        <p class="compact-copy">${isWordMode
          ? "单词错题优先来自 Repeat 里的漏词/替换词，以及外部发音 API 的低分单词；音素弱项里的关联词会作为辅助线索。"
          : "音素错题展示系统推断的疑似训练点；如果你接了 Azure 或自定义发音 API，外部返回的 phoneme score 也会被放进这里。"}</p>
      </section>

      ${isWordMode ? renderMistakeReviewEntry(wordNotebook) : ""}

      ${isWordMode && state.mistakeReview.active ? renderMistakeReviewDeck() : ""}

      ${isWordMode && !state.mistakeReview.active && state.wordDrill.active ? renderWordEchoDrill() : ""}

      ${
        state.mistakeReview.active
          ? ""
          : activeNotebook.length
          ? `<div class="mistake-grid">
              ${isWordMode
                ? wordNotebook.map((item) => renderWordPronunciationNotebookCard(item)).join("")
                : soundNotebook.map((item) => renderPronunciationNotebookCard(item)).join("")}
            </div>`
          : `<div class="empty-feedback">${isWordMode
            ? "还没有可整理的单词错题。先做几次 Listen & Repeat，系统会从漏词、替换词和外部逐词评分里自动收集。"
            : "还没有可整理的发音错题。先完成几次练习，系统会从反馈里的“疑似音素训练点”自动收集。"}</div>`
      }
    </section>
  `;
}

function renderMistakeReviewEntry(wordNotebook) {
  const highFrequencyCount = wordNotebook.filter((item) => item.count >= 2).length;
  const recentCount = wordNotebook.filter((item) => isWithinDays(item.lastSeen, 7)).length;
  return `
    <section class="mistake-review-entry">
      <div>
        <span class="badge blue">Mistake Deck</span>
        <h3>刷错词</h3>
        <p class="compact-copy">一次只练一个词：先复述单词，再复述句子。练完划过，没稳的词会回到队尾。</p>
      </div>
      <div class="control-actions">
        <button class="primary-button" data-start-mistake-review="weakest" ${wordNotebook.length ? "" : "disabled"}>
          <span class="button-icon">▶</span>开始刷错词
        </button>
        <button class="ghost-button" data-start-mistake-review="frequent" ${highFrequencyCount ? "" : "disabled"}>
          <span class="button-icon">↺</span>高频 ${highFrequencyCount}
        </button>
        <button class="ghost-button" data-start-mistake-review="recent" ${recentCount ? "" : "disabled"}>
          <span class="button-icon">⏱</span>最近 ${recentCount}
        </button>
      </div>
    </section>
  `;
}

function renderPronunciationNotebookCard(item) {
  return `
    <article class="mistake-card">
      <div class="mistake-card-head">
        <div>
          <span class="badge ${item.hasExternal ? "blue" : ""}">${item.hasExternal ? "含外部评分" : "Basic 训练点"}</span>
          <h3>${escapeHtml(item.sound)}</h3>
        </div>
        <strong>${item.count}x</strong>
      </div>
      <p class="compact-copy">${escapeHtml(item.tip)}</p>
      <div class="word-chip-list">
        ${item.words.map((word) => `<span>${escapeHtml(word.word)} <small>${word.count}</small></span>`).join("")}
      </div>
      <div class="notebook-drill">
        <span>回顾句</span>
        <p>${escapeHtml(item.reviewSentence)}</p>
      </div>
      <div class="recent-source-list">
        ${item.sources.slice(0, 3).map((source) => `
          <button class="source-pill" data-review-history="${source.id}" title="${escapeHtml(source.prompt)}">
            ${escapeHtml(source.type === "repeat" ? "Repeat" : "Interview")} · ${formatDate(source.createdAt)}
          </button>
        `).join("")}
      </div>
      <div class="control-actions">
        <button class="primary-button" data-review-pronunciation="${escapeHtml(item.key)}"><span class="button-icon">▶</span>回顾这个音</button>
      </div>
    </article>
  `;
}

function renderWordPronunciationNotebookCard(item) {
  const reasonBadges = item.reasons.map((reason) => `<span>${escapeHtml(getWordMistakeReasonLabel(reason))}</span>`).join("");
  const heardAs = item.heardAs.slice(0, 4);
  const scoreLabel = Number.isFinite(item.lowestScore) ? `${Math.round(item.lowestScore * 100)}%` : "";
  return `
    <article class="mistake-card word-mistake-card">
      <div class="mistake-card-head">
        <div>
          <span class="badge ${item.hasExternal ? "blue" : ""}">${item.hasExternal ? "含逐词评分" : "Basic 错词"}</span>
          <h3>${escapeHtml(item.word)}</h3>
        </div>
        <strong>${item.count}x</strong>
      </div>
      <div class="word-breakdown">
        <span>拆读辅助</span>
        <div class="breakdown-parts">
          ${item.breakdown.map((part) => `<b>${escapeHtml(part)}</b>`).join("")}
        </div>
        <small>${escapeHtml(item.stressHint)}</small>
      </div>
      <div class="word-mistake-tags">
        ${reasonBadges}
        ${scoreLabel ? `<span>最低逐词分 ${scoreLabel}</span>` : ""}
        ${item.phonemeSounds.map((sound) => `<span>${escapeHtml(sound)}</span>`).join("")}
      </div>
      ${
        heardAs.length
          ? `<div class="heard-as-list">
              <span>常被听成</span>
              ${heardAs.map((entry) => `<strong>${escapeHtml(entry.word)} <small>${entry.count}</small></strong>`).join("")}
            </div>`
          : ""
      }
      <div class="notebook-drill">
        <span>三段练习</span>
        <p>${escapeHtml(item.word)} → the ${escapeHtml(item.word)} → ${escapeHtml(item.practiceLine)}</p>
      </div>
      <div class="recent-source-list">
        ${item.sources.slice(0, 3).map((source) => `
          <button class="source-pill" data-review-history="${source.id}" title="${escapeHtml(source.prompt)}">
            ${escapeHtml(source.type === "repeat" ? "Repeat" : "Interview")} · ${formatDate(source.createdAt)}
          </button>
        `).join("")}
      </div>
      <div class="control-actions word-action-row">
        <button class="ghost-button" data-speak-word-slow="${escapeHtml(item.key)}"><span class="button-icon">◌</span>慢速听</button>
        <button class="ghost-button" data-speak-word="${escapeHtml(item.key)}"><span class="button-icon">▶</span>正常听</button>
        <button class="tool-button" data-start-word-drill="${escapeHtml(item.key)}"><span class="button-icon">◎</span>词句精练</button>
        <button class="primary-button" data-review-word-pronunciation="${escapeHtml(item.key)}"><span class="button-icon">↻</span>放进 Repeat</button>
      </div>
    </article>
  `;
}

function renderWordEchoDrill(options = {}) {
  const drill = state.wordDrill;
  const wordRecording = state.isRecording && state.recordingTarget === "wordDrill" && drill.target === "word";
  const sentenceRecording = state.isRecording && state.recordingTarget === "wordDrill" && drill.target === "sentence";
  const blocked = state.isRecording && state.recordingTarget !== "wordDrill";
  const inDeck = Boolean(options.inDeck);
  return `
    <section class="word-drill-capsule">
      <div class="section-title-row">
        <div>
          <span class="badge blue">${inDeck ? "Deck Card" : "词句精练"}</span>
          <h3>${escapeHtml(drill.word)}</h3>
          <p class="compact-copy">先把单词读到能被识别，再放进完整句子。这个检查只用本地转写和 Basic 规则，不调用 AI。</p>
        </div>
        ${inDeck ? "" : `<button class="ghost-button" data-reset-word-drill="true"><span class="button-icon">×</span>关闭</button>`}
      </div>

      <div class="word-drill-grid">
        <article class="word-drill-step ${drill.wordCheck ? `result-${drill.wordCheck.result}` : ""}">
          <div class="word-drill-step-head">
            <span>Step 1</span>
            <strong>复述单词</strong>
          </div>
          <div class="word-drill-target">
            <b>${escapeHtml(drill.word)}</b>
            <small>${escapeHtml(drill.breakdown.join(" / "))}</small>
          </div>
          <p class="compact-copy">${escapeHtml(drill.stressHint)}</p>
          <div class="control-actions">
            <button class="ghost-button" data-word-drill-speak="word" data-word-drill-slow="true"><span class="button-icon">◌</span>慢速听</button>
            <button class="ghost-button" data-word-drill-speak="word"><span class="button-icon">▶</span>正常听</button>
            <button class="primary-button" data-word-drill-record="word" ${blocked ? "disabled" : ""}>
              <span class="button-icon">${wordRecording ? "■" : "●"}</span>${wordRecording ? "停止" : "录单词"}
            </button>
            <button class="tool-button" data-check-word-drill="word"><span class="button-icon">✓</span>检查</button>
          </div>
          <label class="transcript-box">
            <span>单词转写</span>
            <textarea id="wordDrillWordInput" placeholder="${SpeechRecognitionApi ? "录音后会自动出现，也可以手动输入。" : "当前浏览器不支持自动识别，请手动输入。"}">${escapeHtml(drill.wordTranscript)}</textarea>
          </label>
          ${renderWordDrillCheck(drill.wordCheck)}
        </article>

        <article class="word-drill-step ${drill.sentenceCheck ? `result-${drill.sentenceCheck.result}` : ""}">
          <div class="word-drill-step-head">
            <span>Step 2</span>
            <strong>复述句子</strong>
          </div>
          <div class="notebook-drill sentence-target">
            <span>目标句</span>
            <p>${escapeHtml(drill.sentence)}</p>
          </div>
          <div class="control-actions">
            <button class="ghost-button" data-word-drill-speak="sentence" data-word-drill-slow="true"><span class="button-icon">◌</span>慢速听</button>
            <button class="ghost-button" data-word-drill-speak="sentence"><span class="button-icon">▶</span>正常听</button>
            <button class="primary-button" data-word-drill-record="sentence" ${blocked ? "disabled" : ""}>
              <span class="button-icon">${sentenceRecording ? "■" : "●"}</span>${sentenceRecording ? "停止" : "录句子"}
            </button>
            <button class="tool-button" data-check-word-drill="sentence"><span class="button-icon">✓</span>检查</button>
          </div>
          <label class="transcript-box">
            <span>句子转写</span>
            <textarea id="wordDrillSentenceInput" placeholder="${SpeechRecognitionApi ? "录音后会自动出现，也可以手动输入。" : "当前浏览器不支持自动识别，请手动输入。"}">${escapeHtml(drill.sentenceTranscript)}</textarea>
          </label>
          ${renderWordDrillCheck(drill.sentenceCheck)}
        </article>
      </div>
    </section>
  `;
}

function renderWordDrillCheck(check) {
  if (!check) {
    return `<div class="word-drill-feedback muted">等待检查。你可以先听、再录，也可以直接输入自己说出的内容。</div>`;
  }
  const labelMap = {
    pass: "通过",
    almost: "接近",
    retry: "再练一次"
  };
  return `
    <div class="word-drill-feedback result-${check.result}">
      <strong>${labelMap[check.result] || "结果"}${Number.isFinite(check.score) ? ` · ${Math.round(check.score * 100)}%` : ""}</strong>
      <p>${escapeHtml(check.message)}</p>
      ${check.nextAction ? `<span>${escapeHtml(check.nextAction)}</span>` : ""}
    </div>
  `;
}

function renderMistakeReviewDeck() {
  const review = state.mistakeReview;
  if (review.complete) return renderMistakeReviewSummary();
  const current = review.deck[review.index];
  if (!current) return renderMistakeReviewSummary();
  const progress = `${Math.min(review.index + 1, review.deck.length)} / ${review.deck.length}`;
  const outcome = getMistakeReviewOutcome();
  const marked = review.starredKeys.includes(current.key);
  return `
    <section class="mistake-review-deck">
      <div class="deck-topline">
        <div>
          <span class="badge blue">${escapeHtml(getMistakeReviewFilterLabel(review.filter))}</span>
          <h3>错词刷题</h3>
          <p class="compact-copy">当前第 ${progress} 题。完成单词和句子后，划过进入下一题；不稳的词会回到队尾。</p>
        </div>
        <div class="deck-progress">
          <strong>${progress}</strong>
          <span>${review.results.length} 已完成</span>
        </div>
      </div>

      <div class="deck-card-shell" data-mistake-review-card="true">
        <div class="deck-card-meta">
          <span>错误 ${current.count}x</span>
          ${current.heardAs?.length ? `<span>常被听成 ${escapeHtml(current.heardAs[0].word)}</span>` : ""}
          ${Number.isFinite(current.lowestScore) ? `<span>最低逐词分 ${Math.round(current.lowestScore * 100)}%</span>` : ""}
          ${marked ? `<span>重点</span>` : ""}
        </div>
        ${renderWordEchoDrill({ inDeck: true })}
      </div>

      <div class="deck-action-bar">
        <button class="ghost-button" data-mistake-review-action="retry"><span class="button-icon">↺</span>再练一次</button>
        <button class="primary-button" data-mistake-review-action="pass">
          <span class="button-icon">→</span>${outcome === "pass" ? "划过" : "先划过"}
        </button>
        <button class="tool-button ${marked ? "active" : ""}" data-mistake-review-star="true"><span class="button-icon">★</span>${marked ? "已重点" : "加入重点"}</button>
        <button class="ghost-button" data-end-mistake-review="true"><span class="button-icon">×</span>结束</button>
      </div>
    </section>
  `;
}

function renderMistakeReviewSummary() {
  const review = state.mistakeReview;
  const counts = review.results.reduce(
    (acc, item) => {
      acc[item.outcome] = (acc[item.outcome] || 0) + 1;
      return acc;
    },
    { pass: 0, almost: 0, retry: 0 }
  );
  const weakItems = review.results
    .filter((item) => item.outcome !== "pass")
    .slice(-5)
    .reverse();
  return `
    <section class="mistake-review-deck summary">
      <div class="deck-topline">
        <div>
          <span class="badge blue">本轮完成</span>
          <h3>错词刷题总结</h3>
          <p class="compact-copy">这一轮结果只保存在当前页面状态里；回到错题本后仍可重新生成新一轮。</p>
        </div>
        <div class="deck-progress">
          <strong>${review.results.length}</strong>
          <span>本轮题数</span>
        </div>
      </div>
      <div class="summary-grid">
        <div class="summary-tile"><span>掌握</span><strong>${counts.pass || 0}</strong></div>
        <div class="summary-tile"><span>接近</span><strong>${counts.almost || 0}</strong></div>
        <div class="summary-tile"><span>待复练</span><strong>${counts.retry || 0}</strong></div>
        <div class="summary-tile"><span>重点</span><strong>${review.starredKeys.length}</strong></div>
      </div>
      ${
        weakItems.length
          ? `<div class="deck-weak-list">
              ${weakItems.map((item) => `<span>${escapeHtml(item.word)} · ${escapeHtml(getMistakeReviewOutcomeLabel(item.outcome))}</span>`).join("")}
            </div>`
          : ""
      }
      <div class="control-actions">
        <button class="primary-button" data-start-mistake-review="retry"><span class="button-icon">↺</span>再刷未掌握</button>
        <button class="ghost-button" data-end-mistake-review="true"><span class="button-icon">←</span>回到错题本</button>
      </div>
    </section>
  `;
}

function buildPronunciationNotebook(history = loadHistory()) {
  const buckets = new Map();
  history.forEach((entry) => {
    const focusItems = entry.pronunciation?.phonemeFocus || [];
    const seenInEntry = new Set();
    focusItems.forEach((focus) => {
      const normalized = normalizePronunciationFocusItem(focus);
      if (!normalized.key || seenInEntry.has(normalized.key)) return;
      seenInEntry.add(normalized.key);
      if (!buckets.has(normalized.key)) {
        buckets.set(normalized.key, {
          ...normalized,
          count: 0,
          wordCounts: new Map(),
          sources: [],
          hasExternal: false,
          lastSeen: ""
        });
      }
      const bucket = buckets.get(normalized.key);
      bucket.count += 1;
      bucket.hasExternal = bucket.hasExternal || Boolean(entry.pronunciation?.external) || normalized.hasExternal;
      bucket.lastSeen = !bucket.lastSeen || new Date(entry.createdAt) > new Date(bucket.lastSeen) ? entry.createdAt : bucket.lastSeen;
      normalized.words.forEach((word) => {
        if (!word) return;
        bucket.wordCounts.set(word, (bucket.wordCounts.get(word) || 0) + 1);
      });
      bucket.sources.push({
        id: entry.id,
        type: entry.type,
        prompt: entry.prompt,
        createdAt: entry.createdAt,
        score: entry.score
      });
    });
  });

  return [...buckets.values()]
    .map((item) => ({
      ...item,
      words: [...item.wordCounts.entries()]
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
        .slice(0, 8),
      reviewSentence: buildPronunciationReviewSentence(item)
    }))
    .sort((a, b) => b.count - a.count || new Date(b.lastSeen) - new Date(a.lastSeen))
    .slice(0, 12);
}

function buildWordPronunciationNotebook(history = loadHistory()) {
  const buckets = new Map();
  history.forEach((entry) => {
    const seenWordsInEntry = new Set();
    collectWordMistakeCandidates(entry).forEach((candidate) => {
      const normalized = normalizeWordMistakeCandidate(candidate);
      if (!normalized) return;
      if (!buckets.has(normalized.key)) {
        buckets.set(normalized.key, {
          key: normalized.key,
          word: normalized.word,
          count: 0,
          reasons: new Set(),
          heardAsCounts: new Map(),
          phonemeSounds: new Set(),
          sources: [],
          hasExternal: false,
          lowestScore: null,
          lastSeen: ""
        });
      }
      const bucket = buckets.get(normalized.key);
      if (!seenWordsInEntry.has(normalized.key)) {
        bucket.count += 1;
        seenWordsInEntry.add(normalized.key);
      }
      bucket.reasons.add(normalized.reason);
      bucket.hasExternal = bucket.hasExternal || normalized.hasExternal;
      if (normalized.heardAs) {
        bucket.heardAsCounts.set(normalized.heardAs, (bucket.heardAsCounts.get(normalized.heardAs) || 0) + 1);
      }
      if (normalized.sound) bucket.phonemeSounds.add(normalized.sound);
      if (Number.isFinite(normalized.score)) {
        bucket.lowestScore = bucket.lowestScore === null ? normalized.score : Math.min(bucket.lowestScore, normalized.score);
      }
      bucket.lastSeen = !bucket.lastSeen || new Date(entry.createdAt) > new Date(bucket.lastSeen) ? entry.createdAt : bucket.lastSeen;
      if (!bucket.sources.some((source) => source.id === entry.id)) {
        bucket.sources.push({
          id: entry.id,
          type: entry.type,
          prompt: entry.prompt,
          createdAt: entry.createdAt,
          score: entry.score
        });
      }
    });
  });

  return [...buckets.values()]
    .map((item) => ({
      ...item,
      reasons: [...item.reasons],
      heardAs: [...item.heardAsCounts.entries()]
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)),
      phonemeSounds: [...item.phonemeSounds].slice(0, 4),
      sources: item.sources.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      breakdown: splitWordForPractice(item.word),
      stressHint: getWordStressHint(item.word),
      practiceLine: buildWordReviewSentence(item.word)
    }))
    .sort((a, b) => {
      const scoreA = Number.isFinite(a.lowestScore) ? a.lowestScore : 1;
      const scoreB = Number.isFinite(b.lowestScore) ? b.lowestScore : 1;
      return b.count - a.count || scoreA - scoreB || new Date(b.lastSeen) - new Date(a.lastSeen);
    })
    .slice(0, 20);
}

function collectWordMistakeCandidates(entry) {
  const candidates = [];
  if (entry.type === "repeat" && Array.isArray(entry.alignment)) {
    entry.alignment.forEach((item) => {
      if (item.type === "missing" || item.type === "substitute") {
        candidates.push({
          word: item.ref,
          heardAs: item.hyp,
          reason: "repeat-mismatch",
          hasExternal: false
        });
      }
    });
  }

  const external = entry.pronunciation?.external || entry.externalPronunciation || {};
  const externalWords = Array.isArray(external.words) ? external.words : [];
  externalWords.forEach((wordItem) => {
    const score = normalizeNotebookScore(
      wordItem.score ?? wordItem.accuracyScore ?? wordItem.AccuracyScore ?? wordItem.pronunciationScore ?? wordItem.PronScore
    );
    const errorType = cleanupSpacing(wordItem.errorType || wordItem.ErrorType || wordItem.error || "");
    const hasExplicitError = Boolean(errorType && !/none|correct|accurate/i.test(errorType));
    if ((Number.isFinite(score) && score < 0.78) || hasExplicitError) {
      candidates.push({
        word: wordItem.word || wordItem.Word || wordItem.text || wordItem.Text,
        reason: "low-word-score",
        score,
        hasExternal: true
      });
    }
  });

  (entry.pronunciation?.phonemeFocus || []).forEach((focus) => {
    const normalized = normalizePronunciationFocusItem(focus);
    normalized.words.forEach((word) => {
      candidates.push({
        word,
        reason: "phoneme-focus",
        sound: normalized.sound,
        hasExternal: normalized.hasExternal
      });
    });
  });

  return candidates;
}

function normalizeWordMistakeCandidate(candidate) {
  const word = normalizeNotebookWord(candidate.word);
  if (!isUsefulNotebookWord(word)) return null;
  const heardAs = normalizeNotebookWord(candidate.heardAs);
  const score = normalizeNotebookScore(candidate.score);
  return {
    key: word,
    word,
    heardAs: heardAs && heardAs !== word ? heardAs : "",
    reason: candidate.reason || "repeat-mismatch",
    sound: cleanupSpacing(candidate.sound || ""),
    score,
    hasExternal: Boolean(candidate.hasExternal || candidate.reason === "low-word-score")
  };
}

function normalizeNotebookWord(value) {
  return cleanupSpacing(value || "")
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/[^a-z'-]/g, "");
}

function normalizeNotebookScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return score > 1 ? Math.max(0, Math.min(1, score / 100)) : Math.max(0, Math.min(1, score));
}

function isUsefulNotebookWord(word) {
  const stopwords = new Set([
    "a", "an", "the", "to", "of", "in", "on", "at", "by", "for", "and", "or", "but",
    "is", "am", "are", "was", "were", "be", "been", "being", "i", "me", "my", "you",
    "your", "he", "she", "we", "they", "it", "its", "his", "her", "our", "their",
    "do", "does", "did", "can", "will", "would", "should", "could"
  ]);
  return Boolean(word && word.length > 2 && !stopwords.has(word));
}

function splitWordForPractice(word) {
  const overrides = {
    academic: ["a", "ca", "DE", "mic"],
    assignment: ["a", "SSIGN", "ment"],
    available: ["a", "VAI", "la", "ble"],
    because: ["be", "CAUSE"],
    classmate: ["CLASS", "mate"],
    comfortable: ["COMF", "ta", "ble"],
    communication: ["co", "mmu", "ni", "CA", "tion"],
    convenient: ["con", "VE", "nient"],
    development: ["de", "VE", "lop", "ment"],
    different: ["DI", "ffe", "rent"],
    education: ["e", "du", "CA", "tion"],
    environment: ["en", "VI", "ron", "ment"],
    experience: ["ex", "PE", "ri", "ence"],
    important: ["im", "POR", "tant"],
    information: ["in", "for", "MA", "tion"],
    interesting: ["IN", "ter", "est", "ing"],
    library: ["LI", "bra", "ry"],
    opportunity: ["o", "ppor", "TU", "ni", "ty"],
    presentation: ["pre", "sen", "TA", "tion"],
    professor: ["pro", "FE", "ssor"],
    responsibility: ["re", "spon", "si", "BI", "li", "ty"],
    technology: ["tech", "NO", "lo", "gy"],
    university: ["u", "ni", "VER", "si", "ty"]
  };
  const clean = normalizeNotebookWord(word);
  if (overrides[clean]) return overrides[clean];
  if (clean.length <= 5) return [clean];

  const chunks = [];
  let current = "";
  const vowels = "aeiouy";
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    const next = clean[index + 1] || "";
    current += char;
    if (vowels.includes(char) && !vowels.includes(next) && current.length >= 2 && chunks.length < 4) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [clean];
}

function getWordStressHint(word) {
  const clean = normalizeNotebookWord(word);
  if (/(tion|sion|cian)$/.test(clean)) return "常见规律：-tion/-sion 前一拍更明显；最终请用词典音标确认。";
  if (/(ic|ical|ity|ety)$/.test(clean)) return "常见规律：-ic/-ity 附近常有重音；先慢速跟读再连成整词。";
  if (clean.length <= 5) return "短词先把元音和词尾说完整，再放回短语里。";
  return "拆读只是练习辅助，不等于官方音标；不确定时用词典确认重音。";
}

function buildWordReviewSentence(word) {
  const clean = normalizeNotebookWord(word);
  const examples = {
    academic: "The academic schedule is busy this semester.",
    assignment: "I finished the assignment before dinner.",
    available: "The study room is available this afternoon.",
    because: "I chose this class because it is useful.",
    classmate: "My classmate helped me review the notes.",
    comfortable: "The library is quiet and comfortable.",
    communication: "Clear communication helps the group work better.",
    convenient: "Online registration is convenient for students.",
    development: "This activity supports my language development.",
    different: "I tried a different method this time.",
    education: "Education gives people more choices.",
    environment: "A quiet environment helps me focus.",
    experience: "This experience taught me to plan earlier.",
    important: "Time management is important for students.",
    information: "The professor gave us useful information.",
    interesting: "The lecture was interesting and practical.",
    library: "The library will extend its hours this week.",
    opportunity: "This project gave me a good opportunity.",
    presentation: "I gave a presentation in class today.",
    professor: "The professor explained the problem clearly.",
    responsibility: "Teamwork requires responsibility and patience.",
    technology: "Technology makes online learning easier.",
    university: "The university offers many student clubs."
  };
  return examples[clean] || `I will practice the word ${clean} slowly and clearly.`;
}

function getWordMistakeReasonLabel(reason) {
  const labels = {
    "repeat-mismatch": "Repeat 错词",
    "low-word-score": "逐词低分",
    "phoneme-focus": "关联音素"
  };
  return labels[reason] || reason;
}

function countNotebookSources(notebook) {
  return new Set(notebook.flatMap((item) => item.sources.map((source) => source.id))).size;
}

function normalizePronunciationFocusItem(focus) {
  const sound = cleanupSpacing(focus?.sound || focus?.phoneme || focus?.label || "pronunciation focus");
  const key = sound.toLowerCase().replace(/[^a-z0-9θð/ -]+/gi, "").replace(/\s+/g, "-");
  const words = Array.isArray(focus?.words)
    ? focus.words
    : String(focus?.word || focus?.label || "").split(/[,\s/]+/);
  return {
    key,
    sound,
    label: cleanupSpacing(focus?.label || ""),
    tip: cleanupSpacing(focus?.tip || focus?.errorType || "慢速读清楚这个音，再放回完整句里。"),
    words: [...new Set(words.map((word) => cleanupSpacing(String(word).toLowerCase())).filter((word) => word && word.length > 1))].slice(0, 8),
    hasExternal: /外部|azure|phoneme|score/i.test(`${focus?.tip || ""} ${focus?.errorType || ""}`)
  };
}

function buildPronunciationReviewSentence(item) {
  const words = [...item.wordCounts.keys()].slice(0, 5);
  if (!words.length) return `Today I will practice the sound ${item.sound}.`;
  const list = words.length === 1
    ? words[0]
    : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
  return `Today I will practice the words ${list}.`;
}

function startPronunciationReview(key) {
  const item = buildPronunciationNotebook().find((entry) => entry.key === key);
  if (!item) {
    showToast("没有找到这个发音错题。");
    return;
  }
  stopIfRecording();
  resetCoachSession(false);
  state.currentRepeat = {
    id: `pron-review-${item.key}`,
    type: "repeat",
    category: "Pronunciation Notebook",
    difficulty: "Review",
    text: item.reviewSentence,
    focus: `${item.sound}: ${item.tip}`
  };
  state.mode = "repeat";
  state.tab = "practice";
  state.full.active = false;
  state.full.complete = false;
  clearCurrentWork(true);
  state.showSentence = true;
  state.status = `正在回顾 ${item.sound}`;
  render();
}

function startWordPronunciationReview(key) {
  const item = buildWordPronunciationNotebook().find((entry) => entry.key === key);
  if (!item) {
    showToast("没有找到这个单词错题。");
    return;
  }
  stopIfRecording();
  resetCoachSession(false);
  state.currentRepeat = {
    id: `word-review-${item.key}`,
    type: "repeat",
    category: "Word Notebook",
    difficulty: "Review",
    text: item.practiceLine,
    focus: `${item.word}: ${item.breakdown.join(" / ")} · ${item.stressHint}`
  };
  state.mode = "repeat";
  state.tab = "practice";
  state.full.active = false;
  state.full.complete = false;
  clearCurrentWork(true);
  state.showSentence = true;
  state.status = `正在回顾 ${item.word}`;
  render();
}

function speakNotebookWord(key, slow = false) {
  const item = buildWordPronunciationNotebook().find((entry) => entry.key === key);
  if (!item) {
    showToast("没有找到这个单词错题。");
    return;
  }
  const text = slow
    ? `${item.word}. ${item.breakdown.join(" ")}. ${item.word}. the ${item.word}.`
    : item.practiceLine;
  speakText(text, slow ? 0.68 : 0.9, slow ? `正在慢速播放 ${item.word}` : `正在播放 ${item.word}`);
}

function speakText(text, rate = 0.9, statusMessage = "正在播放示范") {
  if (!window.speechSynthesis) {
    showToast("当前浏览器不支持语音播放。");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  state.status = statusMessage;
  render();
}

function createWordDrillStateFromNotebookItem(item) {
  return {
    ...getDefaultWordDrillState(),
    active: true,
    key: item.key,
    word: item.word,
    sentence: item.practiceLine,
    breakdown: item.breakdown,
    stressHint: item.stressHint,
    sourceCount: item.count
  };
}

function startWordEchoDrill(key) {
  const item = buildWordPronunciationNotebook().find((entry) => entry.key === key);
  if (!item) {
    showToast("没有找到这个单词错题。");
    return;
  }
  stopIfRecording();
  resetCoachSession(false);
  state.mistakeReview = getDefaultMistakeReviewState();
  state.mistakeBookMode = "words";
  state.wordDrill = createWordDrillStateFromNotebookItem(item);
  state.status = `开始词句精练：${item.word}`;
  render();
}

function resetWordEchoDrill(renderNow = true) {
  if (state.wordDrill?.wordAudioUrl) URL.revokeObjectURL(state.wordDrill.wordAudioUrl);
  if (state.wordDrill?.sentenceAudioUrl) URL.revokeObjectURL(state.wordDrill.sentenceAudioUrl);
  state.wordDrill = getDefaultWordDrillState();
  if (state.recordingTarget === "wordDrill") state.recordingTarget = "main";
  if (renderNow) render();
}

function startMistakeReview(filter = "weakest") {
  const deck = buildMistakeReviewDeck(filter);
  if (!deck.length) {
    showToast("当前没有符合条件的单词错题。");
    return;
  }
  stopIfRecording();
  resetCoachSession(false);
  resetWordEchoDrill(false);
  state.mistakeBookMode = "words";
  state.mistakeReview = {
    ...getDefaultMistakeReviewState(),
    active: true,
    filter,
    deck,
    startedAt: new Date().toISOString()
  };
  loadMistakeReviewCard(0);
  state.status = "开始刷错词";
  render();
}

function buildMistakeReviewDeck(filter = "weakest") {
  let items = buildWordPronunciationNotebook();
  if (filter === "frequent") items = items.filter((item) => item.count >= 2);
  if (filter === "recent") items = items.filter((item) => isWithinDays(item.lastSeen, 7));
  if (filter === "retry" && state.mistakeReview.results.length) {
    const retryKeys = new Set(state.mistakeReview.results.filter((item) => item.outcome !== "pass").map((item) => item.key));
    items = items.filter((item) => retryKeys.has(item.key));
  }
  return items
    .map((item) => ({
      ...item,
      priority: getMistakeReviewPriority(item),
      reviewLoops: 0
    }))
    .sort((a, b) => b.priority - a.priority || b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 24);
}

function getMistakeReviewPriority(item) {
  const scorePenalty = Number.isFinite(item.lowestScore) ? 1 - item.lowestScore : 0;
  const recentBoost = isWithinDays(item.lastSeen, 7) ? 1.2 : 0;
  const externalBoost = item.hasExternal ? 0.8 : 0;
  return item.count * 1.7 + item.heardAs.length * 0.7 + item.reasons.length * 0.35 + scorePenalty * 2 + recentBoost + externalBoost;
}

function loadMistakeReviewCard(index) {
  const item = state.mistakeReview.deck[index];
  if (!item) {
    completeMistakeReview();
    return;
  }
  state.mistakeReview.index = index;
  state.wordDrill = createWordDrillStateFromNotebookItem(item);
}

function finishMistakeReviewCard(action = "pass") {
  if (!state.mistakeReview.active || state.mistakeReview.complete) return;
  const current = state.mistakeReview.deck[state.mistakeReview.index];
  if (!current) {
    completeMistakeReview();
    render();
    return;
  }
  const outcome = action === "retry" ? "retry" : getMistakeReviewOutcome();
  state.mistakeReview.results.push({
    key: current.key,
    word: current.word,
    action,
    outcome,
    wordResult: state.wordDrill.wordCheck?.result || "none",
    sentenceResult: state.wordDrill.sentenceCheck?.result || "none",
    createdAt: new Date().toISOString()
  });
  if (action === "retry" && current.reviewLoops < 2) {
    state.mistakeReview.deck.push({
      ...current,
      reviewLoops: current.reviewLoops + 1
    });
  }
  const nextIndex = state.mistakeReview.index + 1;
  if (nextIndex >= state.mistakeReview.deck.length) completeMistakeReview();
  else loadMistakeReviewCard(nextIndex);
  state.status = action === "retry" ? "已放回队尾" : "已划过，进入下一题";
  render();
}

function toggleMistakeReviewStar() {
  const current = state.mistakeReview.deck[state.mistakeReview.index];
  if (!current) return;
  if (state.mistakeReview.starredKeys.includes(current.key)) {
    state.mistakeReview.starredKeys = state.mistakeReview.starredKeys.filter((key) => key !== current.key);
  } else {
    state.mistakeReview.starredKeys.push(current.key);
  }
  render();
}

function completeMistakeReview() {
  state.mistakeReview.complete = true;
  resetWordEchoDrill(false);
  state.status = "本轮错词刷题完成";
}

function endMistakeReview() {
  stopIfRecording();
  state.mistakeReview = getDefaultMistakeReviewState();
  resetWordEchoDrill(false);
  state.status = "已回到错题本";
  render();
}

function getMistakeReviewOutcome() {
  const wordResult = state.wordDrill.wordCheck?.result || "none";
  const sentenceResult = state.wordDrill.sentenceCheck?.result || "none";
  if (wordResult === "pass" && sentenceResult === "pass") return "pass";
  if (wordResult === "retry" || sentenceResult === "retry" || wordResult === "none" || sentenceResult === "none") return "retry";
  return "almost";
}

function getMistakeReviewOutcomeLabel(outcome) {
  const labels = {
    pass: "掌握",
    almost: "接近",
    retry: "待复练"
  };
  return labels[outcome] || outcome;
}

function getMistakeReviewFilterLabel(filter) {
  const labels = {
    weakest: "优先级队列",
    frequent: "高频错词",
    recent: "最近 7 天",
    retry: "未掌握复刷"
  };
  return labels[filter] || "错词队列";
}

function toggleWordDrillRecording(target = "word") {
  if (!state.wordDrill.active) {
    showToast("先从单词错题卡片开始词句精练。");
    return;
  }
  if (state.isRecording && state.recordingTarget === "wordDrill" && state.wordDrill.target === target) {
    stopRecording();
    return;
  }
  if (state.isRecording) {
    showToast("请先停止当前录音。");
    return;
  }
  state.wordDrill.target = target === "sentence" ? "sentence" : "word";
  state.recordingTarget = "wordDrill";
  startRecording();
}

function speakWordDrillPart(part = "word", slow = false) {
  if (!state.wordDrill.active) {
    showToast("先开始一个词句精练。");
    return;
  }
  const isSentence = part === "sentence";
  const text = isSentence
    ? state.wordDrill.sentence
    : slow
      ? `${state.wordDrill.word}. ${state.wordDrill.breakdown.join(" ")}. ${state.wordDrill.word}.`
      : state.wordDrill.word;
  speakText(
    text,
    slow ? 0.68 : isSentence ? 0.88 : 0.92,
    isSentence ? "正在播放目标句" : `正在播放 ${state.wordDrill.word}`
  );
}

function analyzeWordDrillPart(part = "word") {
  if (!state.wordDrill.active) return;
  const target = part === "sentence" ? "sentence" : "word";
  const check = target === "sentence" ? checkWordDrillSentence() : checkWordDrillWord();
  if (target === "sentence") state.wordDrill.sentenceCheck = check;
  else state.wordDrill.wordCheck = check;
  state.status = check.result === "pass" ? "词句精练通过" : "词句精练已检查";
  render();
}

function checkWordDrillWord() {
  const transcript = cleanupSpacing(state.wordDrill.wordTranscript);
  state.wordDrill.wordTranscript = transcript;
  if (!transcript) {
    return {
      result: "retry",
      score: 0,
      message: "还没有单词转写。请先录音，或者手动输入你刚才说出的词。",
      nextAction: "先听慢速示范，再只说这个单词一次。"
    };
  }
  const targetWord = normalizeNotebookWord(state.wordDrill.word);
  const spokenWords = normalizeWords(transcript);
  const best = getBestWordMatch(targetWord, spokenWords);
  if (best.score >= 0.92) {
    return {
      result: "pass",
      score: best.score,
      message: `系统识别到了 ${state.wordDrill.word}。下一步把它放进完整句子里。`,
      nextAction: "进入 Step 2，听一句、复述一句。"
    };
  }
  if (best.score >= 0.72) {
    return {
      result: "almost",
      score: best.score,
      message: `很接近，但本地识别更像 ${best.word || "另一个词"}。这通常说明元音、重音或词尾还不够稳。`,
      nextAction: "再慢速听一次，先夸张一点读出重音和词尾。"
    };
  }
  return {
    result: "retry",
    score: best.score,
    message: `这次还没有稳定识别到 ${state.wordDrill.word}。`,
    nextAction: "先拆成小块读，再连成完整单词。"
  };
}

function checkWordDrillSentence() {
  const transcript = cleanupSpacing(state.wordDrill.sentenceTranscript);
  state.wordDrill.sentenceTranscript = transcript;
  if (!transcript) {
    return {
      result: "retry",
      score: 0,
      message: "还没有句子转写。请先录一句完整目标句。",
      nextAction: "先听目标句，再尽量完整复述。"
    };
  }
  const question = {
    id: `word-drill-${state.wordDrill.key}`,
    type: "repeat",
    text: state.wordDrill.sentence
  };
  const duration = state.wordDrill.sentenceDuration || state.duration || 0;
  const feedback = createRepeatFeedback(question, transcript, duration, {
    audioStats: state.wordDrill.sentenceAudioStats || null,
    recognitionStats: state.recognitionStats
  });
  const targetWord = normalizeNotebookWord(state.wordDrill.word);
  const includesWord = normalizeWords(transcript).includes(targetWord);
  const recallScore = getDetailScoreValue(feedback.detailScores, "完整复述") ?? ((feedback.score - 1) / 5);
  const score = Math.max(0, Math.min(1, recallScore));
  const result = includesWord && score >= 0.72 ? "pass" : score >= 0.52 ? "almost" : "retry";
  return {
    result,
    score,
    message: includesWord
      ? `目标词已经放进句子里了。句子完整度约 ${Math.round(score * 100)}%。`
      : `句子里还没有稳定出现 ${state.wordDrill.word}，先把目标词说清楚再接后半句。`,
    nextAction: result === "pass" ? "可以回到错题本继续下一个词。" : "再听一次目标句，注意不要漏掉目标词。",
    feedback
  };
}

function getBestWordMatch(targetWord, spokenWords) {
  if (!targetWord || !spokenWords.length) return { word: "", score: 0 };
  return spokenWords.reduce(
    (best, word) => {
      const score = getWordSimilarity(targetWord, word);
      return score > best.score ? { word, score } : best;
    },
    { word: "", score: 0 }
  );
}

function getWordSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = getEditDistance(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

function getEditDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }
  return rows[a.length][b.length];
}

function getDetailScoreValue(detailScores, label) {
  const match = (detailScores || []).find((item) => item.label === label);
  const value = Number(match?.score);
  if (!Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
}

function renderLocalDataPanel(history = loadHistory()) {
  const coachSessions = loadCoachSessions();
  const hasCoachProfile = Boolean(localStorage.getItem(COACH_PROFILE_STORAGE_KEY));
  const hasLadder = Boolean(localStorage.getItem(LADDER_STORAGE_KEY));
  const hasSetup = Boolean(localStorage.getItem(SETUP_STORAGE_KEY));
  return `
    <section class="feedback-section wide-section data-panel">
      <div class="section-title-row">
        <h3>本地数据管理</h3>
        <span class="badge">只影响当前浏览器</span>
      </div>
      <div class="summary-grid compact-summary">
        <div class="summary-tile"><span>练习历史</span><strong>${history.length}</strong></div>
        <div class="summary-tile"><span>Coach 复练</span><strong>${coachSessions.length}</strong></div>
        <div class="summary-tile"><span>Coach Profile</span><strong>${hasCoachProfile ? "有" : "无"}</strong></div>
        <div class="summary-tile"><span>Ladder</span><strong>${hasLadder ? "有" : "无"}</strong></div>
      </div>
      <p class="compact-copy">“导出全部本地数据”会导出练习、Ladder 和 Coach 记录，但会自动隐藏 API key。</p>
      <div class="control-actions">
        <button class="ghost-button" data-export-local-data="true"><span class="button-icon">⇩</span>导出全部本地数据</button>
        <button class="ghost-button" data-clear-coach-data="true"><span class="button-icon">×</span>只清空 Coach 数据</button>
        <button class="danger-button" data-clear-history="true"><span class="button-icon">×</span>清空历史和 Coach</button>
      </div>
      <div class="item-meta">
        <span class="badge ${hasSetup ? "blue" : ""}">Setup ${hasSetup ? "已保存" : "未保存"}</span>
        <span class="badge ${state.setup.ai?.apiKey ? "orange" : ""}">API key ${state.setup.ai?.apiKey || state.setup.pronunciation?.apiKey ? "仅本地保存，不会导出明文" : "未填写"}</span>
      </div>
    </section>
  `;
}

function renderSetupView() {
  const setup = state.setup;
  return `
    <section class="setup-board">
      <div class="history-top">
        <div>
          <h2>API Setup</h2>
          <p class="compact-copy">API key、endpoint 和 model 只保存在当前浏览器 localStorage，不会写入 GitHub 仓库。</p>
        </div>
        <div class="control-actions">
          <button class="primary-button" data-save-setup="true"><span class="button-icon">✓</span>保存设置</button>
          <button class="ghost-button" data-clear-setup="true"><span class="button-icon">×</span>清空设置</button>
        </div>
      </div>

      <div class="setup-grid">
        <section class="feedback-section setup-basic">
          <h3>Basic 本地功能</h3>
          <ul>
            <li>本地 1-6 分模拟评分、rubric 细目、发音代理诊断和弱项追踪默认开启。</li>
            <li>Ladder 和 Coach Capsule 的基础版本不需要 API，不会把录音或文本发到外部服务。</li>
            <li>历史、Ladder profile 和 Coach profile 都只保存在当前浏览器 localStorage。</li>
          </ul>
        </section>

        <section class="feedback-section">
          <h3>AI 内容评分</h3>
          <label class="check-row">
            <input id="aiEnabled" type="checkbox" ${setup.ai.enabled ? "checked" : ""}>
            <span>启用外部 AI 评分增强</span>
          </label>
          <label class="setup-field">
            <span>API 类型</span>
            <select id="aiMode">
              <option value="responses" ${setup.ai.mode === "responses" ? "selected" : ""}>OpenAI Responses API</option>
              <option value="chat" ${setup.ai.mode === "chat" ? "selected" : ""}>OpenAI-compatible Chat Completions</option>
            </select>
          </label>
          <label class="setup-field">
            <span>Endpoint URL</span>
            <input id="aiEndpoint" value="${escapeHtml(setup.ai.endpoint)}" placeholder="https://api.openai.com/v1/responses">
          </label>
          <label class="setup-field">
            <span>API Key</span>
            <input id="aiKey" type="password" value="${escapeHtml(setup.ai.apiKey)}" placeholder="sk-...">
          </label>
          <label class="setup-field">
            <span>Model</span>
            <input id="aiModel" value="${escapeHtml(setup.ai.model)}" placeholder="gpt-4.1-mini">
          </label>
          <label class="setup-field">
            <span>Temperature</span>
            <input id="aiTemperature" type="number" step="0.1" min="0" max="1" value="${escapeHtml(String(setup.ai.temperature))}">
          </label>
          <p class="compact-copy">AI 会按 TOEFL 口语维度补充内容、语法、结构和示范改写。没有配置时自动使用本地评分。</p>
        </section>

        <section class="feedback-section">
          <h3>逐音素/发音评分</h3>
          <label class="check-row">
            <input id="pronEnabled" type="checkbox" ${setup.pronunciation.enabled ? "checked" : ""}>
            <span>启用外部发音评分增强</span>
          </label>
          <label class="setup-field">
            <span>Provider</span>
            <select id="pronProvider">
              <option value="azure" ${setup.pronunciation.provider === "azure" ? "selected" : ""}>Azure Speech Pronunciation Assessment</option>
              <option value="custom" ${setup.pronunciation.provider === "custom" ? "selected" : ""}>Custom JSON endpoint</option>
            </select>
          </label>
          <label class="setup-field">
            <span>Azure Region</span>
            <input id="azureRegion" value="${escapeHtml(setup.pronunciation.azureRegion)}" placeholder="eastus">
          </label>
          <label class="setup-field">
            <span>Endpoint Override</span>
            <input id="pronEndpoint" value="${escapeHtml(setup.pronunciation.endpoint)}" placeholder="留空则按 Azure region 自动生成">
          </label>
          <label class="setup-field">
            <span>API Key</span>
            <input id="pronKey" type="password" value="${escapeHtml(setup.pronunciation.apiKey)}" placeholder="Azure Speech key 或自定义 key">
          </label>
          <p class="compact-copy">Azure 模式会把录音转成 16kHz WAV 后请求 Pronunciation Assessment。Custom 模式会向你的 endpoint 发送 JSON。</p>
        </section>

        <section class="feedback-section">
          <h3>Agentic Coach</h3>
          <label class="check-row">
            <input id="coachEnabled" type="checkbox" ${setup.coach.enabled ? "checked" : ""}>
            <span>启用 Coach Capsule 深度复练入口</span>
          </label>
          <label class="check-row">
            <input id="coachUseAi" type="checkbox" ${setup.coach.useAi ? "checked" : ""}>
            <span>使用 AI 生成 Coach 诊断和 micro-drill</span>
          </label>
          <label class="setup-field">
            <span>Coach 输出风格</span>
            <select id="coachTone">
              <option value="strict" ${setup.coach.tone === "strict" ? "selected" : ""}>严格</option>
              <option value="balanced" ${setup.coach.tone === "balanced" ? "selected" : ""}>平衡</option>
              <option value="encouraging" ${setup.coach.tone === "encouraging" ? "selected" : ""}>鼓励</option>
            </select>
          </label>
          <label class="check-row">
            <input id="coachSingleWeaknessOnly" type="checkbox" ${setup.coach.singleWeaknessOnly ? "checked" : ""}>
            <span>每次只显示一个主要问题</span>
          </label>
          <p class="compact-copy">Coach AI 复用上面的 AI 内容评分 endpoint、API key 和 model。未配置或调用失败时，会自动回到 Basic 本地规则。</p>
        </section>
      </div>

      <section class="feedback-section setup-note">
        <h3>安全说明</h3>
        <ul>
          <li>源码里没有任何个人 API key，提交到 GitHub 不会泄露你的密钥。</li>
          <li>密钥只存在当前浏览器 localStorage；换浏览器或清缓存后需要重新填写。</li>
          <li>如果部署成公开网站，用户填写的 key 仍会在自己的浏览器里发起请求，适合个人工具，不适合多人 SaaS 后台。</li>
        </ul>
      </section>
    </section>
  `;
}

function renderWeaknessPanel(history) {
  if (!history.length) return "";
  const recent = history.slice(0, 20);
  const buckets = {};
  recent.forEach((item) => {
    (item.detailScores || []).forEach((detail) => {
      if (!buckets[detail.label]) buckets[detail.label] = [];
      buckets[detail.label].push(Number(detail.score));
    });
  });
  const weakScores = Object.entries(buckets)
    .map(([label, values]) => ({
      label,
      score: values.reduce((sum, value) => sum + value, 0) / values.length
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  const issueCounts = {};
  recent.flatMap((item) => item.issues || []).forEach((issue) => {
    const key = classifyIssue(issue);
    issueCounts[key] = (issueCounts[key] || 0) + 1;
  });
  const topIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return `
    <section class="feedback-section wide-section weakness-panel">
      <h3>弱项追踪</h3>
      <div class="weakness-grid">
        ${weakScores
          .map(
            (item) => `
              <div class="weakness-tile">
                <span>${escapeHtml(item.label)}</span>
                <strong>${Math.round(item.score * 100)}%</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="item-meta">
        ${topIssues.map(([label, count]) => `<span class="badge orange">${escapeHtml(label)} x${count}</span>`).join("")}
      </div>
    </section>
  `;
}

function classifyIssue(issue) {
  if (/漏|完整|复述/.test(issue)) return "复述完整度";
  if (/理由|例子|结果|展开/.test(issue)) return "内容展开";
  if (/组织|顺序|结构/.test(issue)) return "组织逻辑";
  if (/发音|词尾|可识别/.test(issue)) return "发音清晰度";
  if (/语速|停顿|流利/.test(issue)) return "流利度";
  if (/录音|噪音|音量/.test(issue)) return "录音质量";
  if (/词汇|重复|语言/.test(issue)) return "语言使用";
  return "综合问题";
}

function continueLadderDiagnostic() {
  if (!state.ladder.diagnostic || !state.ladder.diagnostic.active) {
    state.ladder = {
      ...getDefaultLadderProfile(),
      diagnostic: createDiagnosticSession()
    };
    saveLadderProfile();
  }

  const diagnostic = state.ladder.diagnostic;
  if (diagnostic.index >= diagnostic.sequence.length) {
    finalizeLadderDiagnostic();
    state.tab = "ladder";
    render();
    return;
  }

  const questionId = diagnostic.sequence[diagnostic.index];
  state.ladder.currentTask = {
    source: "diagnostic",
    questionId,
    diagnosticIndex: diagnostic.index,
    startedAt: new Date().toISOString()
  };
  saveLadderProfile();
  practiceQuestion(questionId);
}

function resetLadderWithConfirm() {
  const ok = window.confirm("确定重置 Ladder 诊断和训练进度吗？历史记录不会删除。");
  if (!ok) return;
  state.ladder = getDefaultLadderProfile();
  saveLadderProfile();
  state.tab = "ladder";
  render();
}

function resetLadderPlan() {
  state.ladder.dailyPlan = null;
  saveLadderProfile();
  render();
}

function startLadderPlanTask(index) {
  const plan = getTodayLadderPlan(state.ladder);
  const task = plan.tasks[index];
  if (!task) return;
  const questionId = task.questionId || selectQuestionForLadderTask(task).id;
  task.questionId = questionId;
  state.ladder.currentTask = {
    source: "plan",
    planDate: plan.date,
    planIndex: index,
    stepId: task.stepId,
    drill: task.drill,
    questionId,
    startedAt: new Date().toISOString()
  };
  saveLadderProfile();
  practiceQuestion(questionId);
}

function updateLadderAfterFeedback(question, feedback, transcript) {
  const profile = state.ladder || getDefaultLadderProfile();
  const task = profile.currentTask || null;
  const entry = {
    createdAt: new Date().toISOString(),
    questionId: question.id,
    type: question.type,
    score: feedback.score,
    detailScores: feedback.detailScores || [],
    issues: feedback.issues || [],
    pronunciation: feedback.pronunciation || null,
    source: task ? task.source : "free",
    stepId: task ? task.stepId : null,
    drill: task ? task.drill : null,
    transcriptFingerprint: fingerprintText(transcript)
  };

  profile.recent = [entry, ...(profile.recent || [])].slice(0, 40);
  profile.weaknesses = inferLadderWeaknesses(profile.recent);
  profile.recommendedDrill = recommendDrillFromFeedback(feedback);

  if (task && task.source === "diagnostic" && profile.diagnostic && profile.diagnostic.active) {
    const alreadyRecorded = profile.diagnostic.results.some((item) => item.diagnosticIndex === task.diagnosticIndex);
    if (!alreadyRecorded) {
      profile.diagnostic.results.push({ ...entry, diagnosticIndex: task.diagnosticIndex });
      profile.diagnostic.index += 1;
    }
    profile.currentTask = null;
    if (profile.diagnostic.index >= profile.diagnostic.sequence.length) {
      applyDiagnosticResult(profile);
    }
    state.ladder = profile;
    saveLadderProfile();
    return;
  }

  if (profile.diagnosed && task && task.source === "plan") {
    markLadderPlanTaskComplete(profile, task.planIndex);
    updateLadderStepProgress(profile, feedback, task.stepId);
    profile.currentTask = null;
  }

  state.ladder = profile;
  saveLadderProfile();
}

function createDiagnosticSession() {
  const sequence = [
    selectQuestion({ type: "repeat", difficulty: "Easy" }).id,
    selectQuestion({ type: "repeat", difficulty: "Medium" }).id,
    selectQuestion({ type: "repeat", difficulty: "Hard" }).id,
    selectQuestion({ type: "interview", difficulty: "Easy" }).id,
    selectQuestion({ type: "interview", difficulty: "Medium" }).id,
    selectQuestion({ type: "interview", difficulty: "Hard" }).id
  ];
  return {
    active: true,
    sequence,
    index: 0,
    results: [],
    startedAt: new Date().toISOString()
  };
}

function finalizeLadderDiagnostic() {
  applyDiagnosticResult(state.ladder);
  saveLadderProfile();
}

function applyDiagnosticResult(profile) {
  const results = profile.diagnostic ? profile.diagnostic.results : [];
  const avg = averageNumeric(results.map((item) => item.score));
  const repeatAvg = averageNumeric(results.filter((item) => item.type === "repeat").map((item) => item.score));
  const interviewAvg = averageNumeric(results.filter((item) => item.type === "interview").map((item) => item.score));
  const pronAvg = averageNumeric(results.map((item) => item.pronunciation ? item.pronunciation.score * 6 : item.score));
  const adjusted = avg * 0.72 + repeatAvg * 0.1 + interviewAvg * 0.1 + pronAvg * 0.08;
  let level = 1;
  if (adjusted >= 5.25) level = 5;
  else if (adjusted >= 4.75) level = 4;
  else if (adjusted >= 4.05) level = 3;
  else if (adjusted >= 3.25) level = 2;

  profile.diagnosed = true;
  profile.level = level;
  profile.step = 1;
  profile.recommendedDrill = recommendDrillFromEntries(results);
  profile.weaknesses = inferLadderWeaknesses(results);
  profile.diagnostic = { ...profile.diagnostic, active: false, completedAt: new Date().toISOString(), level };
  profile.dailyPlan = null;
  profile.stepProgress = {};
  profile.currentTask = null;
}

function getTodayLadderPlan(profile) {
  const today = getDateKey();
  if (profile.dailyPlan && profile.dailyPlan.date === today && profile.dailyPlan.tasks && profile.dailyPlan.tasks.length) {
    return profile.dailyPlan;
  }
  profile.dailyPlan = buildLadderPlan(profile, today);
  saveLadderProfile();
  return profile.dailyPlan;
}

function buildLadderPlan(profile, date) {
  const step = getCurrentLadderStep(profile);
  const level = profile.level || 1;
  const warmDifficulty = level <= 1 ? "Easy" : level <= 3 ? "Medium" : "Hard";
  const fixDrill = profile.recommendedDrill || step.drill;
  const fixType = drillPrefersRepeat(fixDrill) ? "repeat" : "interview";
  const checkpointType = step.type === "repeat" ? "repeat" : step.type === "interview" ? "interview" : "mixed";
  const tasks = [
    createLadderTask("Warm-up", "chunk-repeat", "repeat", warmDifficulty, "先用一题复述热身，目标是清楚和完整。", step.id),
    createLadderTask("Core Step", step.drill, step.type, step.difficulty, step.goal, step.id),
    createLadderTask("Fix Drill", fixDrill, fixType, step.difficulty, DRILL_LIBRARY[fixDrill].tip, step.id),
    createLadderTask("Checkpoint", "checkpoint", checkpointType, step.difficulty, "像小测一样完成一题，检查今天的稳定度。", step.id)
  ];
  return { date, tasks };
}

function createLadderTask(label, drill, type, difficulty, goal, stepId) {
  const question = selectQuestionForLadderTask({ type, difficulty, drill });
  return {
    label,
    drill,
    drillLabel: DRILL_LIBRARY[drill].label,
    type,
    difficulty,
    goal,
    stepId,
    questionId: question.id,
    completed: false
  };
}

function selectQuestionForLadderTask(task) {
  if (task.type === "mixed") {
    const type = Math.random() > 0.45 ? "interview" : "repeat";
    return selectQuestion({ type, difficulty: task.difficulty });
  }
  return selectQuestion({ type: task.type, difficulty: task.difficulty });
}

function selectQuestion({ type, difficulty }) {
  const pool = type === "repeat" ? QUESTION_BANK.repeat : QUESTION_BANK.interview;
  const filtered = pool.filter((item) => !difficulty || item.difficulty === difficulty);
  return randomItem(filtered.length ? filtered : pool);
}

function getQuestionById(id) {
  return [...QUESTION_BANK.repeat, ...QUESTION_BANK.interview].find((item) => item.id === id) || null;
}

function getCurrentLadderStep(profile) {
  const levelSteps = LADDER_STEPS[profile.level] || LADDER_STEPS[1];
  return levelSteps[Math.max(0, Math.min(levelSteps.length - 1, (profile.step || 1) - 1))];
}

function getStepProgress(profile, stepId) {
  return (profile.stepProgress && profile.stepProgress[stepId]) || { points: 0, attempts: 0 };
}

function markLadderPlanTaskComplete(profile, planIndex) {
  if (!profile.dailyPlan || !profile.dailyPlan.tasks || !profile.dailyPlan.tasks[planIndex]) return;
  profile.dailyPlan.tasks[planIndex].completed = true;
}

function updateLadderStepProgress(profile, feedback, stepId) {
  if (!profile.stepProgress) profile.stepProgress = {};
  const current = profile.stepProgress[stepId] || { points: 0, attempts: 0 };
  const threshold = (LADDER_LEVELS[profile.level] || LADDER_LEVELS[1]).threshold;
  const weakDimension = getWeakestDetailScore(feedback.detailScores || []);
  current.attempts += 1;
  if (feedback.score >= threshold && (!weakDimension || weakDimension.score >= 0.62)) current.points += 1;
  else current.points = Math.max(0, current.points - 1);
  profile.stepProgress[stepId] = current;

  if (current.points >= 3) advanceLadderStep(profile);
}

function advanceLadderStep(profile) {
  const maxStep = (LADDER_STEPS[profile.level] || LADDER_STEPS[1]).length;
  if (profile.step < maxStep) {
    profile.step += 1;
  } else if (profile.level < 5) {
    profile.level += 1;
    profile.step = 1;
  }
  profile.dailyPlan = null;
}

function recommendDrillFromFeedback(feedback) {
  const weakest = getWeakestDetailScore(feedback.detailScores || []);
  if (!weakest) return "example-builder";
  return drillForWeakness(weakest.label);
}

function recommendDrillFromEntries(entries) {
  const labels = {};
  entries.forEach((entry) => {
    const weakest = getWeakestDetailScore(entry.detailScores || []);
    if (weakest) labels[weakest.label] = (labels[weakest.label] || 0) + 1;
  });
  const top = Object.entries(labels).sort((a, b) => b[1] - a[1])[0];
  return top ? drillForWeakness(top[0]) : "example-builder";
}

function getWeakestDetailScore(detailScores) {
  const numeric = detailScores.filter((item) => Number.isFinite(Number(item.score)));
  if (!numeric.length) return null;
  return numeric.sort((a, b) => Number(a.score) - Number(b.score))[0];
}

function drillForWeakness(label) {
  if (/听辨|完整|语序|复述|Completeness|Listening/.test(label)) return "chunk-repeat";
  if (/发音|清晰|Pronunciation|pacing|节奏/.test(label)) return "pronunciation-focus";
  if (/流利|Fluency|语速|停顿/.test(label)) return "speed-control";
  if (/任务|回应|Task/.test(label)) return "answer-skeleton";
  if (/展开|Development|例子/.test(label)) return "example-builder";
  if (/组织|Organization|逻辑/.test(label)) return "result-builder";
  if (/语言|Language|词汇/.test(label)) return "language-upgrade";
  return "example-builder";
}

function inferLadderWeaknesses(entries) {
  const counts = {};
  entries.forEach((entry) => {
    const weakest = getWeakestDetailScore(entry.detailScores || []);
    if (weakest) counts[weakest.label] = (counts[weakest.label] || 0) + 1;
    (entry.issues || []).forEach((issue) => {
      const key = classifyIssue(issue);
      counts[key] = (counts[key] || 0) + 0.5;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label]) => label);
}

function drillPrefersRepeat(drill) {
  return ["chunk-repeat", "shadow-sprint", "pronunciation-focus"].includes(drill);
}

function getDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function averageNumeric(values) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      render();
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      clearCurrentWork(true);
      render();
    });
  });

  document.querySelectorAll("[data-record-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.isRecording) stopRecording();
      else {
        state.recordingTarget = "main";
        startRecording();
      }
    });
  });

  const transcriptInput = document.querySelector("#transcriptInput");
  if (transcriptInput) {
    transcriptInput.addEventListener("input", (event) => {
      state.transcript = event.target.value;
    });
  }

  const starterTranscriptInput = document.querySelector("#starterTranscriptInput");
  if (starterTranscriptInput) {
    starterTranscriptInput.addEventListener("input", (event) => {
      state.transcript = event.target.value;
    });
  }

  const coachTranscriptInput = document.querySelector("#coachTranscriptInput");
  if (coachTranscriptInput) {
    coachTranscriptInput.addEventListener("input", (event) => {
      state.coach.retake.transcript = event.target.value;
    });
  }

  const wordDrillWordInput = document.querySelector("#wordDrillWordInput");
  if (wordDrillWordInput) {
    wordDrillWordInput.addEventListener("input", (event) => {
      state.wordDrill.wordTranscript = event.target.value;
    });
  }

  const wordDrillSentenceInput = document.querySelector("#wordDrillSentenceInput");
  if (wordDrillSentenceInput) {
    wordDrillSentenceInput.addEventListener("input", (event) => {
      state.wordDrill.sentenceTranscript = event.target.value;
    });
  }

  const bankType = document.querySelector("#bankType");
  if (bankType) {
    bankType.addEventListener("change", (event) => {
      state.bankType = event.target.value;
      render();
    });
  }

  const bankDifficulty = document.querySelector("#bankDifficulty");
  if (bankDifficulty) {
    bankDifficulty.addEventListener("change", (event) => {
      state.bankDifficulty = event.target.value;
      render();
    });
  }

  bindClick("[data-show-sentence]", () => {
    state.showSentence = !state.showSentence;
    render();
  });
  bindClick("[data-play-prompt]", () => speakPrompt());
  bindClick("[data-next-question]", () => nextQuestion());
  bindClick("[data-analyze]", () => analyzeCurrent());
  bindClick("[data-starter-show-sentence]", () => {
    state.showSentence = !state.showSentence;
    render();
  });
  bindClick("[data-starter-new-question]", () => resetStarterQuestion());
  bindClick("[data-starter-next-step]", () => nextStarterStep());
  bindClick("[data-starter-to-practice]", () => practiceQuestion(getStarterQuestion().id));
  bindClick("[data-analyze-starter]", () => analyzeStarterStep());
  bindClick("[data-clear-starter]", () => {
    clearStarterAttemptWork(false);
    render();
  });
  bindClick("[data-starter-record-toggle]", () => {
    if (state.isRecording && state.recordingTarget === "starter") stopRecording();
    else {
      state.recordingTarget = "starter";
      startRecording();
    }
  });
  bindClick("[data-clear-current]", () => {
    clearCurrentWork(false);
    render();
  });
  bindClick("[data-start-full]", () => startFullRun());
  bindClick("[data-full-next]", () => nextFullItem());
  bindClick("[data-random-bank]", () => practiceQuestion(randomItem([...QUESTION_BANK.repeat, ...QUESTION_BANK.interview]).id));
  bindClick("[data-export-history]", () => exportHistory());
  bindClick("[data-export-local-data]", () => exportAllLocalData());
  bindClick("[data-clear-coach-data]", () => clearCoachDataWithConfirm());
  bindClick("[data-clear-history]", () => clearHistoryWithConfirm());
  bindClick("[data-save-setup]", () => saveSetupFromForm());
  bindClick("[data-clear-setup]", () => clearSetupWithConfirm());
  bindClick("[data-ladder-diagnostic-next]", () => continueLadderDiagnostic());
  bindClick("[data-reset-ladder]", () => resetLadderWithConfirm());
  bindClick("[data-reset-ladder-plan]", () => resetLadderPlan());
  bindClick("[data-start-coach-current]", () => startCoachFromCurrentAttempt());
  bindClick("[data-start-coach-ladder]", () => startCoachFromLadder());
  bindClick("[data-coach-reset]", () => resetCoachSession());
  bindClick("[data-start-coach-retake]", () => startCoachRetake());
  bindClick("[data-coach-record-toggle]", () => {
    if (state.isRecording && state.recordingTarget === "coach") stopRecording();
    else startCoachRetakeRecording();
  });
  bindClick("[data-analyze-coach-retake]", () => analyzeCoachRetake());

  document.querySelectorAll("[data-practice-question]").forEach((button) => {
    button.addEventListener("click", () => practiceQuestion(button.dataset.practiceQuestion));
  });

  document.querySelectorAll("[data-starter-mode]").forEach((button) => {
    button.addEventListener("click", () => setStarterMode(button.dataset.starterMode));
  });

  document.querySelectorAll("[data-ladder-plan-index]").forEach((button) => {
    button.addEventListener("click", () => startLadderPlanTask(Number(button.dataset.ladderPlanIndex)));
  });

  document.querySelectorAll("[data-review-history]").forEach((button) => {
    button.addEventListener("click", () => reviewHistory(button.dataset.reviewHistory));
  });

  document.querySelectorAll("[data-review-pronunciation]").forEach((button) => {
    button.addEventListener("click", () => startPronunciationReview(button.dataset.reviewPronunciation));
  });

  document.querySelectorAll("[data-mistake-book-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mistakeBookMode = button.dataset.mistakeBookMode;
      render();
    });
  });

  document.querySelectorAll("[data-review-word-pronunciation]").forEach((button) => {
    button.addEventListener("click", () => startWordPronunciationReview(button.dataset.reviewWordPronunciation));
  });

  document.querySelectorAll("[data-start-word-drill]").forEach((button) => {
    button.addEventListener("click", () => startWordEchoDrill(button.dataset.startWordDrill));
  });

  document.querySelectorAll("[data-reset-word-drill]").forEach((button) => {
    button.addEventListener("click", () => resetWordEchoDrill());
  });

  document.querySelectorAll("[data-word-drill-speak]").forEach((button) => {
    button.addEventListener("click", () => speakWordDrillPart(button.dataset.wordDrillSpeak, button.dataset.wordDrillSlow === "true"));
  });

  document.querySelectorAll("[data-word-drill-record]").forEach((button) => {
    button.addEventListener("click", () => toggleWordDrillRecording(button.dataset.wordDrillRecord));
  });

  document.querySelectorAll("[data-check-word-drill]").forEach((button) => {
    button.addEventListener("click", () => analyzeWordDrillPart(button.dataset.checkWordDrill));
  });

  document.querySelectorAll("[data-start-mistake-review]").forEach((button) => {
    button.addEventListener("click", () => startMistakeReview(button.dataset.startMistakeReview));
  });

  document.querySelectorAll("[data-mistake-review-action]").forEach((button) => {
    button.addEventListener("click", () => finishMistakeReviewCard(button.dataset.mistakeReviewAction));
  });

  document.querySelectorAll("[data-mistake-review-star]").forEach((button) => {
    button.addEventListener("click", () => toggleMistakeReviewStar());
  });

  document.querySelectorAll("[data-end-mistake-review]").forEach((button) => {
    button.addEventListener("click", () => endMistakeReview());
  });

  bindMistakeReviewSwipe();

  document.querySelectorAll("[data-speak-word]").forEach((button) => {
    button.addEventListener("click", () => speakNotebookWord(button.dataset.speakWord, false));
  });

  document.querySelectorAll("[data-speak-word-slow]").forEach((button) => {
    button.addEventListener("click", () => speakNotebookWord(button.dataset.speakWordSlow, true));
  });

  document.querySelectorAll("[data-start-coach-history]").forEach((button) => {
    button.addEventListener("click", () => startCoachFromHistory(button.dataset.startCoachHistory));
  });
}

function bindClick(selector, handler) {
  document.querySelectorAll(selector).forEach((element) => {
    element.addEventListener("click", handler);
  });
}

function bindMistakeReviewSwipe() {
  const card = document.querySelector("[data-mistake-review-card]");
  if (!card) return;
  let startX = 0;
  let startY = 0;
  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, textarea, input, audio")) return;
    startX = event.clientX;
    startY = event.clientY;
  });
  card.addEventListener("pointerup", (event) => {
    if (!startX) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    startX = 0;
    startY = 0;
    if (Math.abs(deltaX) < 90 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
    finishMistakeReviewCard(deltaX > 0 ? "pass" : "retry");
  });
}

async function startCoachFromCurrentAttempt(source = "practice") {
  if (!state.setup.coach?.enabled) {
    showToast("Coach Capsule 已在 Setup 中关闭。");
    return;
  }
  const question = getActiveQuestion(state.tab === "full" && state.full.active);
  const transcript = cleanupSpacing(state.transcript);
  if (!state.feedback || !transcript) {
    showToast("先完成一次练习评分，再让 Coach 拆解这题。");
    return;
  }

  stopIfRecording();
  resetCoachSession(false);
  state.coach = createCoachSessionState({
    source,
    question,
    transcript,
    feedback: state.feedback,
    audioStats: state.audioStats,
    historyId: null
  });
  await runCoachDiagnosis();
}

async function startCoachFromLadder() {
  if (!state.setup.coach?.enabled) {
    showToast("Coach Capsule 已在 Setup 中关闭。");
    return;
  }
  if (state.feedback && cleanupSpacing(state.transcript)) {
    await startCoachFromCurrentAttempt("ladder");
    return;
  }

  const profile = state.ladder || getDefaultLadderProfile();
  const step = getCurrentLadderStep(profile);
  const plan = profile.diagnosed ? getTodayLadderPlan(profile) : null;
  const fixTask = plan ? plan.tasks.find((task) => task.drill === profile.recommendedDrill) || plan.tasks[2] || plan.tasks[0] : null;
  const question = getQuestionById(fixTask?.questionId) || selectQuestionForLadderTask({
    type: drillPrefersRepeat(profile.recommendedDrill) ? "repeat" : "interview",
    difficulty: step.difficulty,
    drill: profile.recommendedDrill
  });
  const primaryWeakness = weaknessFromDrill(profile.recommendedDrill, question.type);
  const copy = getCoachCopy(primaryWeakness, question.type);
  const diagnosis = normalizeCoachDiagnosis({
    primaryWeakness,
    secondaryWeakness: question.type === "repeat" ? "endingRetention" : "reasonDevelopment",
    mainDiagnosis: `当前 Ladder 推荐你先处理：${getWeaknessLabel(primaryWeakness, question.type)}。`,
    evidence: [
      `Ladder 最近推荐的 fix 是 ${DRILL_LIBRARY[profile.recommendedDrill]?.label || "Example Builder"}。`,
      "这次 Coach 会先给你一个可执行 micro-drill，再让你完成一次重答。",
      "完成重答后，系统会把结果写入本地 Coach Profile。"
    ],
    coachGoal: copy.goal,
    recommendedDrill: profile.recommendedDrill,
    drillInstruction: copy.instruction,
    retakeMission: copy.mission,
    successCriteria: copy.criteria,
    userFacingFeedback: copy.feedback
  }, { taskType: question.type });

  stopIfRecording();
  resetCoachSession(false);
  state.coach = createCoachSessionState({
    source: "ladder",
    question,
    transcript: "",
    feedback: null,
    audioStats: null,
    historyId: null
  });
  state.coach.phase = "drill-ready";
  state.coach.diagnosis = diagnosis;
  state.coach.drill = buildCoachDrill(diagnosis, question.type);
  state.coach.usedAi = false;
  render();
}

async function startCoachFromHistory(historyId) {
  if (!state.setup.coach?.enabled) {
    showToast("Coach Capsule 已在 Setup 中关闭。");
    return;
  }
  const item = loadHistory().find((entry) => entry.id === historyId);
  if (!item) return;
  const question = getQuestionById(item.questionId) || {
    id: item.questionId,
    type: item.type,
    text: item.prompt,
    category: "History",
    difficulty: "Review",
    sample: ""
  };
  const feedback = createFeedbackFromHistoryItem(item, question);

  stopIfRecording();
  resetCoachSession(false);
  if (question.type === "repeat") {
    state.currentRepeat = question;
    state.mode = "repeat";
  } else {
    state.currentInterview = question;
    state.mode = "interview";
  }
  state.tab = "practice";
  state.full.active = false;
  state.full.complete = false;
  state.transcript = item.transcript || "";
  state.duration = item.duration || 0;
  state.elapsed = item.duration || 0;
  state.feedback = feedback;
  state.audioStats = item.pronunciation?.audioStats || null;
  state.coach = createCoachSessionState({
    source: "history",
    question,
    transcript: state.transcript,
    feedback,
    audioStats: state.audioStats,
    historyId
  });
  await runCoachDiagnosis();
}

async function runCoachDiagnosis() {
  const coach = state.coach;
  const payload = buildCoachPayload(coach);
  coach.phase = "diagnosing";
  coach.isRunning = true;
  coach.error = null;
  render();

  let diagnosis = null;
  let usedAi = false;
  const canUseAi = canUseCoachAi();
  if (canUseAi) {
    try {
      diagnosis = await runAiCoachDiagnosis(payload);
      usedAi = true;
    } catch (error) {
      coach.error = `AI Coach 调用失败，已切换到 Basic 本地规则：${error.message}`;
    }
  }
  if (!diagnosis) diagnosis = buildLocalCoachDiagnosis(payload);

  coach.phase = "drill-ready";
  coach.isRunning = false;
  coach.usedAi = usedAi;
  coach.diagnosis = normalizeCoachDiagnosis(diagnosis, payload);
  coach.drill = buildCoachDrill(coach.diagnosis, payload.taskType);
  render();
}

function buildCoachPayload(coach) {
  return {
    taskType: coach.original.taskType,
    questionText: coach.original.questionText,
    transcript: coach.original.transcript,
    localFeedback: coach.original.feedback,
    localFeedbackSummary: summarizeFeedbackForCoach(coach.original.feedback),
    audioMetrics: summarizeAudioStats(coach.original.audioStats),
    recentHistory: loadHistory().slice(0, 8).map((item) => ({
      type: item.type,
      score: item.score,
      summary: item.summary,
      issues: item.issues || []
    })),
    coachProfile: loadCoachProfile(),
    ladderProfile: state.ladder
  };
}

function buildLocalCoachDiagnosis(payload) {
  const primaryWeakness = payload.taskType === "repeat"
    ? inferRepeatWeakness(payload.localFeedback)
    : inferInterviewWeakness(payload.localFeedback, payload.transcript);
  const secondaryWeakness = inferSecondaryWeakness(primaryWeakness, payload.taskType);
  const copy = getCoachCopy(primaryWeakness, payload.taskType);
  return {
    primaryWeakness,
    secondaryWeakness,
    mainDiagnosis: copy.diagnosis,
    evidence: buildCoachEvidence(primaryWeakness, payload),
    coachGoal: copy.goal,
    recommendedDrill: COACH_DRILL_MAP[primaryWeakness],
    drillInstruction: copy.instruction,
    retakeMission: copy.mission,
    successCriteria: copy.criteria,
    userFacingFeedback: copy.feedback
  };
}

async function runAiCoachDiagnosis(payload) {
  const config = state.setup.ai;
  if (!config.endpoint || !config.apiKey || !config.model) {
    throw new Error("请在 Setup 里填写 AI endpoint、API key 和 model。");
  }
  const systemPrompt = [
    "You are VoxPilot, an adaptive TOEFL-style speaking coach.",
    "Do not estimate an official TOEFL score.",
    "Diagnose the learner's most important training weakness and generate one actionable micro-drill.",
    "Choose primaryWeakness and secondaryWeakness only from the allowed taxonomy.",
    "Allowed Listen & Repeat weaknesses: keywordRetention, wordOrderStability, endingRetention, pronunciationClarity, paceControl.",
    "Allowed Take an Interview weaknesses: directAnswer, reasonDevelopment, exampleSpecificity, organization, languageUse, fluency.",
    "Return only valid JSON with keys: primaryWeakness, secondaryWeakness, mainDiagnosis, evidence, coachGoal, recommendedDrill, drillInstruction, retakeMission, successCriteria, userFacingFeedback."
  ].join(" ");
  const userPrompt = JSON.stringify({
    taskType: payload.taskType,
    question: payload.questionText,
    userTranscript: payload.transcript,
    localFeedback: payload.localFeedbackSummary,
    audioMetrics: payload.audioMetrics,
    recentLearnerProfile: payload.coachProfile,
    tone: state.setup.coach?.tone || "balanced",
    singleWeaknessOnly: Boolean(state.setup.coach?.singleWeaknessOnly)
  }, null, 2);
  return callConfiguredAiJson(config, systemPrompt, userPrompt);
}

function buildCoachDrill(diagnosis, taskType) {
  const fallbackDrill = taskType === "repeat" ? "chunk-repeat" : "answer-skeleton";
  const drillId = DRILL_LIBRARY[diagnosis.recommendedDrill] ? diagnosis.recommendedDrill : (COACH_DRILL_MAP[diagnosis.primaryWeakness] || fallbackDrill);
  const drill = DRILL_LIBRARY[drillId] || DRILL_LIBRARY[fallbackDrill];
  const copy = getCoachCopy(diagnosis.primaryWeakness, taskType);
  return {
    id: drillId,
    title: drill.label,
    instruction: cleanupSpacing(diagnosis.drillInstruction || copy.instruction || drill.tip),
    retakeMission: cleanupSpacing(diagnosis.retakeMission || copy.mission),
    successCriteria: Array.isArray(diagnosis.successCriteria) && diagnosis.successCriteria.length
      ? diagnosis.successCriteria.slice(0, 4)
      : copy.criteria,
    tip: drill.tip
  };
}

function startCoachRetake() {
  if (!state.coach.active) return;
  clearCoachRetakeWork();
  state.coach.phase = "retaking";
  state.status = "准备 Coach 重答";
  render();
}

function startCoachRetakeRecording() {
  if (!state.coach.active) return;
  if (state.isRecording && state.recordingTarget !== "coach") {
    showToast("请先停止当前练习录音。");
    return;
  }
  state.recordingTarget = "coach";
  state.coach.phase = "retaking";
  startRecording();
}

async function analyzeCoachRetake() {
  const coach = state.coach;
  if (!coach.active || coach.phase === "reflecting") return;
  const transcript = cleanupSpacing(coach.retake.transcript);
  if (!transcript) {
    showToast("还没有 Coach 重答转写。可以先录音，也可以手动输入。");
    return;
  }

  const question = getQuestionById(coach.original.questionId) || {
    id: coach.original.questionId,
    type: coach.original.taskType,
    text: coach.original.questionText,
    category: "Coach",
    difficulty: "Retake",
    sample: ""
  };
  const duration = coach.retake.duration || state.duration || state.elapsed;
  const context = {
    audioStats: coach.retake.audioStats,
    recognitionStats: {
      confidenceSamples: [...state.recognitionStats.confidenceSamples],
      finalSegments: state.recognitionStats.finalSegments,
      interimSegments: state.recognitionStats.interimSegments
    }
  };

  coach.retake.transcript = transcript;
  coach.phase = "reflecting";
  coach.isRunning = true;
  render();

  const feedback = question.type === "repeat"
    ? createRepeatFeedback(question, transcript, duration, context)
    : createInterviewFeedback(question, transcript, duration, context);
  await enhanceFeedbackWithExternalScorers(feedback, question, transcript, duration, context, coach.retake.audioBlob);
  feedback.confidence = buildScoringConfidence(question, feedback, transcript, duration, context);

  coach.retake.feedback = feedback;
  coach.isRunning = false;
  await runCoachReflection();
}

async function runCoachReflection() {
  const coach = state.coach;
  const payload = {
    questionText: coach.original.questionText,
    beforeTranscript: coach.original.transcript,
    afterTranscript: coach.retake.transcript,
    retakeMission: coach.drill?.retakeMission || "",
    primaryWeakness: coach.diagnosis?.primaryWeakness || "",
    beforeFeedback: coach.original.feedback,
    afterFeedback: coach.retake.feedback
  };
  let reflection = null;
  const canUseAi = canUseCoachAi();
  if (canUseAi) {
    try {
      reflection = await runAiCoachReflection(payload);
      coach.usedAi = true;
    } catch (error) {
      coach.error = `AI Reflection 调用失败，已使用 Basic 本地对比：${error.message}`;
    }
  }
  if (!reflection) reflection = buildLocalCoachReflection(payload);
  coach.reflection = normalizeCoachReflection(reflection, payload);
  coach.phase = "complete";
  coach.isRunning = false;
  completeCoachSession();
  render();
}

async function runAiCoachReflection(payload) {
  const config = state.setup.ai;
  if (!config.endpoint || !config.apiKey || !config.model) {
    throw new Error("请在 Setup 里填写 AI endpoint、API key 和 model。");
  }
  const systemPrompt = [
    "You are VoxPilot's retake evaluator.",
    "Compare the learner's first answer and retake answer.",
    "Focus only on whether the retake followed the mission.",
    "Do not estimate an official TOEFL score.",
    "Return only valid JSON with keys: improved, improvementSummary, visibleChanges, remainingIssue, nextAction, profileUpdate."
  ].join(" ");
  const userPrompt = JSON.stringify({
    question: payload.questionText,
    firstAnswer: payload.beforeTranscript,
    retakeAnswer: payload.afterTranscript,
    retakeMission: payload.retakeMission,
    primaryWeakness: payload.primaryWeakness
  }, null, 2);
  return callConfiguredAiJson(config, systemPrompt, userPrompt);
}

function buildLocalCoachReflection(payload) {
  const beforeScore = Number(payload.beforeFeedback?.score) || 0;
  const afterScore = Number(payload.afterFeedback?.score) || 0;
  const mission = evaluateCoachMission(payload.afterTranscript, payload.primaryWeakness);
  const wordDelta = normalizeWords(payload.afterTranscript).length - normalizeWords(payload.beforeTranscript).length;
  const improved = mission.passed || afterScore >= beforeScore + 0.5 || wordDelta >= 12;
  const visibleChanges = [];
  if (wordDelta > 8) visibleChanges.push("第二遍信息量更足，不再只是短句回答。");
  if (mission.notes.length) visibleChanges.push(...mission.notes.slice(0, 3));
  if (afterScore > beforeScore) visibleChanges.push(`本地模拟分从 ${beforeScore || "-"} 提升到 ${afterScore}/6。`);
  if (!visibleChanges.length) visibleChanges.push("第二遍已经完成，但主要任务还不够稳定，建议马上再来一遍。");
  return {
    improved,
    improvementSummary: improved ? "这次重答有明显进步，回答更接近 Coach mission。" : "这次重答还没有稳定完成 mission，先不要换题。",
    visibleChanges,
    remainingIssue: mission.remainingIssue,
    nextAction: improved
      ? `继续练 ${state.coach.drill?.title || "当前 drill"}，直到连续 3 次稳定做到。`
      : "马上按同一个 mission 再重答一次，只改一个主要问题。",
    profileUpdate: {
      stablePassDelta: improved ? 1 : -1,
      patternResolved: improved
    }
  };
}

function completeCoachSession() {
  const coach = state.coach;
  if (coach.sessionSaved || !coach.reflection) return;
  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : `coach-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: coach.source,
    taskType: coach.original.taskType,
    questionId: coach.original.questionId,
    questionText: coach.original.questionText,
    before: {
      transcript: coach.original.transcript,
      score: coach.original.feedback?.score || null,
      feedbackSummary: coach.original.feedback?.summary || ""
    },
    diagnosis: coach.diagnosis,
    drill: coach.drill,
    after: {
      transcript: coach.retake.transcript,
      score: coach.retake.feedback?.score || null
    },
    reflection: coach.reflection,
    usedAi: coach.usedAi
  };
  saveCoachSession(session);
  updateCoachProfile(session);
  coach.sessionSaved = true;
}

async function callConfiguredAiJson(config, systemPrompt, userPrompt) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`
  };
  const body = config.mode === "chat"
    ? {
        model: config.model,
        temperature: clamp(0, 1, Number(config.temperature) || 0),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      }
    : {
        model: config.model,
        temperature: clamp(0, 1, Number(config.temperature) || 0),
        instructions: systemPrompt,
        input: userPrompt
      };
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text.slice(0, 160)}`);
  }
  const data = await response.json();
  return parseJsonLike(extractAiText(data));
}

function getDefaultStarterState(mode = "interview") {
  const question = pickStarterQuestion(mode);
  return {
    mode,
    questionId: question.id,
    step: 1,
    feedback: null,
    attempts: [],
    lastSavedSignature: ""
  };
}

function pickStarterQuestion(mode, excludeId = "") {
  const pool = (mode === "repeat" ? QUESTION_BANK.repeat : QUESTION_BANK.interview)
    .filter((item) => item.difficulty !== "Hard");
  const filtered = pool.filter((item) => item.id !== excludeId);
  return randomItem(filtered.length ? filtered : pool);
}

function getStarterQuestion() {
  const starter = state.starter || getDefaultStarterState();
  const pool = starter.mode === "repeat" ? QUESTION_BANK.repeat : QUESTION_BANK.interview;
  let question = pool.find((item) => item.id === starter.questionId);
  if (!question) {
    question = pickStarterQuestion(starter.mode);
    state.starter.questionId = question.id;
  }
  return question;
}

function getStarterSteps(question) {
  if (question.type === "repeat") {
    const chunks = splitStarterChunks(question.text);
    const keywordItems = getStarterKeywords(question).map((word) => ({
      label: word,
      detail: "content word"
    }));
    const keywords = keywordItems.map((item) => item.label).join(" / ");
    const repeatText = state.showSentence ? question.text : "播放句子后整句复述。需要时可以先显示原句。";
    return [
      {
        title: "关键词热身",
        microGoal: "只抓核心词",
        interactionLabel: "Target Words",
        displayText: keywords,
        promptNote: "这一步不要说完整句，只读出你听到的核心词。",
        mission: "只说关键词。你不是在复述句子，而是在训练耳朵抓内容词。",
        templateLabel: "只需要说",
        template: keywords,
        scaffoldTitle: "关键词靶点",
        scaffoldType: "target-words",
        scaffold: keywordItems
      },
      {
        title: "分块跟读",
        microGoal: "按意群说",
        interactionLabel: "Chunk Builder",
        displayText: chunks.join(" / "),
        promptNote: "每个斜线是一小块，一块一口气说完。",
        mission: "按分块顺序跟读，先稳住关键词，再连接成短语。",
        templateLabel: "照这个顺序拼",
        template: chunks.join(" / "),
        scaffoldTitle: "句块拼装",
        scaffoldType: "chunks",
        scaffold: chunks.map((chunk) => ({ label: chunk, detail: "one breath" }))
      },
      {
        title: "看关键词复述",
        microGoal: "用关键词还原句子",
        interactionLabel: "Keyword Recall",
        displayText: keywords,
        promptNote: "现在完整句消失了，只用关键词把句子补回来。",
        mission: "用关键词还原主要意思。可以改写一点，但要有主语、动词和句尾信息。",
        templateLabel: "必须包含",
        template: keywords,
        scaffoldTitle: "只能看这些线索",
        scaffoldType: "recall-cues",
        scaffold: [
          { label: "Start with subject + verb", detail: "不要只报关键词列表" },
          { label: keywords, detail: "关键词尽量都放进去" },
          { label: "Finish the ending", detail: "句尾信息不能丢" }
        ]
      },
      {
        title: "完整复述",
        microGoal: "回到原题",
        interactionLabel: "Full Task",
        displayText: repeatText,
        promptNote: "这一轮使用完整本地评分，但仍然不会调用 AI。",
        mission: "播放后整句复述，尽量保留关键词、顺序和句尾。",
        templateLabel: "考试化流程",
        template: "Listen -> pause -> repeat the whole sentence",
        scaffoldTitle: "完整题检查",
        scaffoldType: "full-task",
        scaffold: [
          { label: "Play once", detail: "先听完整句" },
          { label: "No keyword card", detail: "尽量不依赖提示" },
          { label: "Full local score", detail: "回到完整评分" }
        ]
      }
    ];
  }

  return [
    {
      title: "只说立场",
      microGoal: "一句话开口",
      interactionLabel: "Choice Only",
      displayText: question.text,
      promptNote: "这一步不要解释，不要举例，只选一个方向。",
      mission: "只说一句观点。你的任务是先敢开口，而不是说完整答案。",
      templateLabel: "只允许这种长度",
      template: "I prefer ___. / I think ___.",
      scaffoldTitle: "二选一开口",
      scaffoldType: "choice-only",
      scaffold: getStarterChoiceScaffold(question)
    },
    {
      title: "加 because",
      microGoal: "观点 + 理由",
      interactionLabel: "Reason Builder",
      displayText: question.text,
      promptNote: "这一步要把 Step 1 的观点接上一个原因。",
      mission: "说一条完整 reason chain：观点 + because + 原因。还不要讲例子。",
      templateLabel: "拼句骨架",
      template: "I prefer ___ because ___.",
      scaffoldTitle: "理由零件",
      scaffoldType: "reason-builder",
      scaffold: [
        { label: "I prefer / I think", detail: "先重复你的立场" },
        { label: "because", detail: "必须出现理由连接" },
        { label: "it saves time / gives feedback / reduces stress", detail: "原因要比 good 更具体" }
      ]
    },
    {
      title: "加具体例子",
      microGoal: "补一个场景",
      interactionLabel: "Example Card",
      displayText: question.text,
      promptNote: "这一步像填一张小卡片：时间/场景 + 我做了什么。",
      mission: "不要完整作答，只造一个具体例子。必须有场景和动作。",
      templateLabel: "例子卡片",
      template: "For example, last semester I ___.",
      scaffoldTitle: "例子必须有两块",
      scaffoldType: "example-card",
      scaffold: [
        { label: "When / where", detail: "last semester / in my class / once" },
        { label: "Action", detail: "prepared / asked / worked / created" },
        { label: "Object", detail: "presentation / project / homework / notes" }
      ]
    },
    {
      title: "完整回答",
      microGoal: "回到原题",
      interactionLabel: "Full Task",
      displayText: question.text,
      promptNote: "这一轮使用完整本地评分，但仍然不会调用 AI。",
      mission: "说出观点、理由、例子和结果，完成一题基础答案。",
      templateLabel: "完整答案路线",
      template: "Opinion -> because -> example -> result",
      scaffoldTitle: "四句结构",
      scaffoldType: "full-task",
      scaffold: [
        { label: "Opinion", detail: "I prefer..." },
        { label: "Reason", detail: "because..." },
        { label: "Example", detail: "For example..." },
        { label: "Result", detail: "This helped me..." }
      ]
    }
  ];
}

function splitStarterChunks(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length <= 7) return [text];
  const middle = Math.ceil(words.length / 2);
  return [words.slice(0, middle).join(" "), words.slice(middle).join(" ")];
}

function getStarterKeywords(question) {
  const contentWords = getContentWords(normalizeWords(question.text))
    .filter((word) => word.length > 2)
    .slice(0, 6);
  return contentWords.length ? contentWords : normalizeWords(question.text).slice(0, 5);
}

function getStarterChoiceScaffold(question) {
  const lower = question.text.toLowerCase();
  const preferMatch = question.text.match(/prefer\s+(.+?)\s+or\s+(.+?)[?.]?$/i);
  if (preferMatch) {
    return [
      { label: cleanupChoiceLabel(preferMatch[1]), detail: "Option A" },
      { label: cleanupChoiceLabel(preferMatch[2]), detail: "Option B" }
    ];
  }
  if (lower.startsWith("do you") || lower.startsWith("would you") || lower.startsWith("should ")) {
    return [
      { label: "Yes", detail: "agree / choose yes" },
      { label: "No", detail: "disagree / choose no" }
    ];
  }
  return [
    { label: "I think ___", detail: "give one clear opinion" },
    { label: "My choice is ___", detail: "name one object or action" }
  ];
}

function cleanupChoiceLabel(value) {
  return cleanupSpacing(String(value || "")
    .replace(/\bdo you\b/gi, "")
    .replace(/\bwould you\b/gi, "")
    .replace(/\?+$/g, ""));
}

function setStarterMode(mode) {
  if (!["repeat", "interview"].includes(mode)) return;
  stopIfRecording();
  state.starter = getDefaultStarterState(mode);
  state.mode = mode;
  clearStarterAttemptWork(false);
  state.status = "准备开始";
  render();
}

function resetStarterQuestion() {
  stopIfRecording();
  const currentId = state.starter.questionId;
  const question = pickStarterQuestion(state.starter.mode, currentId);
  state.starter.questionId = question.id;
  state.starter.step = 1;
  state.starter.attempts = [];
  state.starter.lastSavedSignature = "";
  state.mode = state.starter.mode;
  state.showSentence = false;
  clearStarterAttemptWork(false);
  state.status = "已换一题，从 Step 1 开始";
  render();
}

function nextStarterStep() {
  if (!state.starter.feedback) {
    showToast("先完成本步分析，再进入下一步。");
    return;
  }
  if (state.starter.step >= 4) return;
  state.starter.step += 1;
  state.showSentence = false;
  clearStarterAttemptWork(false);
  state.status = `进入 Step ${state.starter.step}`;
  render();
}

function clearStarterAttemptWork(keepTranscript = false) {
  if (!keepTranscript) state.transcript = "";
  state.feedback = null;
  state.starter.feedback = null;
  state.isScoring = false;
  state.elapsed = 0;
  state.duration = 0;
  state.audioStats = null;
  state.audioAnalysisPending = false;
  state.recognitionStats = {
    confidenceSamples: [],
    finalSegments: 0,
    interimSegments: 0
  };
  if (state.audioUrl) {
    URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = "";
  }
  state.audioBlob = null;
  if (state.coach?.active) resetCoachSession(false);
  state.recordingTarget = "starter";
}

function analyzeStarterStep() {
  if (state.isScoring) return;
  const question = getStarterQuestion();
  const transcript = cleanupSpacing(state.transcript);
  state.transcript = transcript;
  if (!transcript) {
    showToast("先录音，或手动输入这一小步的回答。");
    return;
  }

  state.isScoring = true;
  state.status = "正在检查本步目标";
  render();

  const feedback = createStarterFeedback(question, transcript);
  state.starter.feedback = feedback;
  state.isScoring = false;
  state.status = feedback.result === "pass" ? "本步完成，可以进入下一步" : "本步反馈已生成，可以再来一次";
  state.starter.attempts.push({
    step: state.starter.step,
    transcript,
    result: feedback.result,
    createdAt: new Date().toISOString()
  });
  saveStarterHistoryItem(question, transcript, feedback);
  render();
}

function createStarterFeedback(question, transcript) {
  if (state.starter.step === 4) return createStarterFullFeedback(question, transcript);
  return question.type === "repeat"
    ? createStarterRepeatFeedback(question, transcript)
    : createStarterInterviewFeedback(question, transcript);
}

function createStarterInterviewFeedback(question, transcript) {
  const words = normalizeWords(transcript);
  const lower = ` ${transcript.toLowerCase()} `;
  const step = state.starter.step;
  const direct = /\b(i think|i believe|i prefer|i would|yes|no|my favorite|the best|i agree|i disagree)\b/.test(lower.slice(0, 160));
  const reason = /\b(because|since|the reason|one reason)\b/.test(lower);
  const example = /\b(for example|for instance|last semester|one time|once|when i|in my class|in one course)\b/.test(lower);
  const action = /\b(studied|prepared|joined|worked|asked|used|made|helped|learned|went|took|created|met|found|improved|finished|discussed)\b/.test(lower);

  if (step === 1) {
    const tooLong = words.length > 12 || reason || example;
    return buildStarterResult({
      passed: direct && words.length >= 4 && !tooLong,
      almost: direct || words.length >= 4,
      passSummary: "你已经直接说出立场。",
      almostSummary: tooLong ? "你说得太完整了，这一步先练短立场。" : "接近了，但立场还可以更直接。",
      retrySummary: "先只说一句明确观点。",
      nextAction: "下一遍只说一句，不加 because，不加例子。",
      checks: [
        { label: "直接表态", passed: direct, detail: "开头有 I prefer / I think / I would / yes / no 这类信号。" },
        { label: "完整短句", passed: words.length >= 4, detail: "至少说出 4 个词，形成一句能听懂的话。" },
        { label: "保持很短", passed: !tooLong, detail: "这一步不要解释原因或举例。" }
      ]
    });
  }

  if (step === 2) {
    const hasGenericOnly = /\b(good|helpful|interesting|important)\b/.test(lower) && words.length < 12;
    return buildStarterResult({
      passed: direct && reason && words.length >= 8 && !example && !hasGenericOnly,
      almost: (direct && reason) || reason || words.length >= 8,
      passSummary: "你已经把观点和理由连起来。",
      almostSummary: example ? "你已经开始举例了，但这一步先只练理由。" : "接近了，还需要更完整的 because 理由句。",
      retrySummary: "这一轮只练观点 + because。",
      nextAction: "下一遍用 I prefer ___ because ___，理由不要只说 good / helpful。",
      checks: [
        { label: "有观点", passed: direct, detail: "先回答题目，再解释原因。" },
        { label: "有 because 理由", passed: reason, detail: "出现 because / since / reason 这类理由连接。" },
        { label: "原因不太泛", passed: !hasGenericOnly, detail: "不要只停在 good / helpful / interesting。" },
        { label: "还不举例", passed: !example, detail: "Step 2 不需要 for example。" }
      ]
    });
  }

  return buildStarterResult({
    passed: example && action && words.length >= 12 && !reason,
    almost: example || words.length >= 12,
    passSummary: "你已经加入了一个具体例子。",
    almostSummary: reason ? "你还在解释理由，这一步要像写一张例子卡。" : "接近了，例子还需要更像一个真实场景。",
    retrySummary: "这一轮只练具体例子。",
    nextAction: "下一遍加入 For example / last semester / once，并说清楚你做了什么。",
    checks: [
      { label: "有例子信号", passed: example, detail: "出现 for example / once / last semester / when I 等场景信号。" },
      { label: "有具体动作", passed: action, detail: "例子里有 prepared / joined / asked / created 等动作。" },
      { label: "例子不是碎片", passed: words.length >= 12, detail: "至少 12 个词，让例子能独立听懂。" },
      { label: "只做例子卡", passed: !reason, detail: "这一步不需要再解释 because。" }
    ]
  });
}

function createStarterRepeatFeedback(question, transcript) {
  const words = normalizeWords(transcript);
  const wordSet = new Set(words);
  const keywords = getStarterKeywords(question);
  const hitCount = countOverlap(keywords, wordSet);
  const hitRate = keywords.length ? hitCount / keywords.length : 0;
  const refWords = normalizeWords(question.text);
  const lengthFit = refWords.length ? clamp01(1 - Math.abs(words.length - refWords.length) / Math.max(refWords.length, 4)) : 0;
  const step = state.starter.step;

  if (step === 1) {
    return buildStarterResult({
      passed: hitRate >= 0.6 && words.length <= keywords.length + 2,
      almost: hitRate >= 0.4,
      passSummary: "核心关键词抓得不错。",
      almostSummary: words.length > keywords.length + 2 ? "你说得太像完整句了，这一步只报关键词。" : "已经抓到一些关键词，还可以再补几个。",
      retrySummary: "先别急着整句复述，抓关键词。",
      nextAction: "下一遍只盯内容词，尤其是名词、动词、时间和地点。",
      checks: [
        { label: "关键词命中", passed: hitRate >= 0.6, detail: `${hitCount}/${keywords.length} 个关键词被说出。` },
        { label: "不是空白输出", passed: words.length >= 2, detail: "至少说出两个有效词。" },
        { label: "只说关键词", passed: words.length <= keywords.length + 2, detail: "Step 1 不需要完整句。" }
      ]
    });
  }

  if (step === 2) {
    return buildStarterResult({
      passed: hitRate >= 0.7 && words.length >= keywords.length && lengthFit < 0.95,
      almost: hitRate >= 0.5,
      passSummary: "分块跟读已经能保留主要信息。",
      almostSummary: "分块里有核心词，但还不够稳定。",
      retrySummary: "这一轮只按意群跟读。",
      nextAction: "下一遍一块一口气说完，不要逐词停顿。",
      checks: [
        { label: "关键词更完整", passed: hitRate >= 0.7, detail: `${hitCount}/${keywords.length} 个关键词被保留。` },
        { label: "输出长度够用", passed: words.length >= keywords.length, detail: "说出的词数至少覆盖关键词数量。" },
        { label: "还不是完整复述", passed: lengthFit < 0.95, detail: "Step 2 先练分块，不急着整句考试化。" }
      ]
    });
  }

  return buildStarterResult({
    passed: hitRate >= 0.75 && lengthFit >= 0.45,
    almost: hitRate >= 0.55,
    passSummary: "你已经能用关键词还原主要意思。",
    almostSummary: "关键词有了，句子还需要更完整。",
    retrySummary: "这一轮只看关键词复述。",
    nextAction: "下一遍先说主语和动词，再把剩余关键词接上。",
    checks: [
      { label: "关键词稳定", passed: hitRate >= 0.75, detail: `${hitCount}/${keywords.length} 个关键词被保留。` },
      { label: "长度接近原句", passed: lengthFit >= 0.45, detail: "回答长度不能只剩关键词列表。" }
    ]
  });
}

function createStarterFullFeedback(question, transcript) {
  const context = getScoringContext();
  const duration = state.duration || state.elapsed;
  const fullFeedback = question.type === "repeat"
    ? createRepeatFeedback(question, transcript, duration, context)
    : createInterviewFeedback(question, transcript, duration, context);
  fullFeedback.confidence = buildScoringConfidence(question, fullFeedback, transcript, duration, context);
  const passed = fullFeedback.score >= 3.2;
  const almost = fullFeedback.score >= 2.6;
  return buildStarterResult({
    passed,
    almost,
    passSummary: "你完成了一道完整题。",
    almostSummary: "你已经能完成完整题，还需要补稳结构。",
    retrySummary: "这次还没完成完整题的基本要求。",
    nextAction: passed
      ? "下一步可以去练习台做类似题，或继续下一道起步训练。"
      : "先回到前面的台阶，把观点、理由、例子或关键词补稳。",
    score: fullFeedback.score,
    fullFeedback,
    checks: [
      { label: "完成完整题", passed: fullFeedback.score >= 2.6, detail: "已经使用完整本地评分检查整题表现。" },
      { label: "达到起步通过线", passed, detail: "Start Easy 通过线是 3.2/6，不等同高分线。" },
      { label: "AI 未强制介入", passed: true, detail: "本模式 Step 4 只使用本地完整评分，不调用 AI 或外部发音 API。" }
    ]
  });
}

function buildStarterResult({ passed, almost, passSummary, almostSummary, retrySummary, nextAction, checks, score = null, fullFeedback = null }) {
  const result = passed ? "pass" : almost ? "almost" : "try-again";
  const label = passed ? "Pass" : almost ? "Almost" : "Try Again";
  const summary = passed ? passSummary : almost ? almostSummary : retrySummary;
  return {
    result,
    label,
    summary,
    nextAction,
    checks,
    score,
    fullFeedback
  };
}

function saveStarterHistoryItem(question, transcript, feedback) {
  const signature = `starter|${question.id}|${state.starter.step}|${transcript}|${feedback.result}|${feedback.score || ""}`;
  if (state.starter.lastSavedSignature === signature) return;
  saveHistoryItem({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    trainingMode: "starter",
    starterStep: state.starter.step,
    starterResult: feedback.result,
    starterFeedback: {
      result: feedback.result,
      label: feedback.label,
      summary: feedback.summary,
      nextAction: feedback.nextAction,
      checks: feedback.checks,
      score: feedback.score
    },
    type: question.type,
    questionId: question.id,
    prompt: question.text,
    transcript,
    score: feedback.score,
    duration: state.duration || state.elapsed,
    summary: `Start Easy Step ${state.starter.step}: ${feedback.summary}`,
    issues: feedback.result === "pass" ? [] : [feedback.nextAction],
    strengths: feedback.result === "pass" ? [feedback.summary] : [],
    detailScores: feedback.fullFeedback?.detailScores || [],
    pronunciation: feedback.fullFeedback?.pronunciation || null,
    alignment: feedback.fullFeedback?.alignment || [],
    rubricProfile: feedback.fullFeedback?.rubricProfile || null,
    confidence: feedback.fullFeedback?.confidence || null
  });
  state.starter.lastSavedSignature = signature;
}

function getTodayStarterCompletions() {
  return loadHistory().filter((item) =>
    item.trainingMode === "starter" &&
    item.starterStep === 4 &&
    item.starterResult === "pass" &&
    isToday(item.createdAt)
  ).length;
}

function reviewStarterHistory(item) {
  stopIfRecording();
  const mode = item.type === "repeat" ? "repeat" : "interview";
  state.starter = {
    ...getDefaultStarterState(mode),
    mode,
    questionId: item.questionId,
    step: item.starterStep || 1,
    feedback: item.starterFeedback || null,
    attempts: [],
    lastSavedSignature: ""
  };
  state.mode = mode;
  state.tab = "starter";
  state.transcript = item.transcript || "";
  state.duration = item.duration || 0;
  state.elapsed = item.duration || 0;
  state.audioStats = null;
  state.audioBlob = null;
  state.audioUrl = "";
  state.feedback = null;
  state.recordingTarget = "starter";
  state.status = "已载入 Start Easy 历史记录";
  render();
}

function getCurrentRecordingTarget() {
  if (state.recordingTarget === "coach") return "coach";
  if (state.recordingTarget === "starter") return "starter";
  if (state.recordingTarget === "wordDrill") return "wordDrill";
  return "main";
}

function getWordDrillActiveTarget() {
  return state.wordDrill.target === "sentence" ? "sentence" : "word";
}

function getWordDrillTranscript(target = getWordDrillActiveTarget()) {
  return target === "sentence" ? state.wordDrill.sentenceTranscript : state.wordDrill.wordTranscript;
}

function setWordDrillTranscript(value, target = getWordDrillActiveTarget()) {
  if (target === "sentence") state.wordDrill.sentenceTranscript = value;
  else state.wordDrill.wordTranscript = value;
}

function clearWordDrillAttempt(target = getWordDrillActiveTarget()) {
  if (target === "sentence") {
    state.wordDrill.sentenceTranscript = "";
    state.wordDrill.sentenceCheck = null;
    state.wordDrill.sentenceDuration = 0;
    state.wordDrill.sentenceAudioStats = null;
    if (state.wordDrill.sentenceAudioUrl) URL.revokeObjectURL(state.wordDrill.sentenceAudioUrl);
    state.wordDrill.sentenceAudioUrl = "";
    state.wordDrill.sentenceAudioBlob = null;
  } else {
    state.wordDrill.wordTranscript = "";
    state.wordDrill.wordCheck = null;
    state.wordDrill.wordDuration = 0;
    state.wordDrill.wordAudioStats = null;
    if (state.wordDrill.wordAudioUrl) URL.revokeObjectURL(state.wordDrill.wordAudioUrl);
    state.wordDrill.wordAudioUrl = "";
    state.wordDrill.wordAudioBlob = null;
  }
}

async function startRecording() {
  if (state.isRecording) return;
  const target = getCurrentRecordingTarget();
  const drillTarget = target === "wordDrill" ? getWordDrillActiveTarget() : null;
  if (target === "coach") clearCoachRetakeWork();
  else if (target === "starter") clearStarterAttemptWork(false);
  else if (target === "wordDrill") clearWordDrillAttempt(drillTarget);
  else {
    state.recordingTarget = "main";
    clearCurrentWork(false);
  }
  state.isRecording = true;
  state.status = SpeechRecognitionApi ? "正在录音，自动转写中" : "正在录音，可稍后手动输入转写";
  state.elapsed = 0;
  state.duration = 0;
  render();
  startTimer();

  if (navigator.mediaDevices && window.MediaRecorder) {
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.mediaRecorder = new MediaRecorder(state.stream);
      const chunks = [];
      state.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      state.mediaRecorder.addEventListener("stop", async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (target === "coach") {
          if (state.coach.retake.audioUrl) URL.revokeObjectURL(state.coach.retake.audioUrl);
          state.coach.retake.audioBlob = blob;
          state.coach.retake.audioUrl = URL.createObjectURL(blob);
        } else if (target === "wordDrill") {
          if (drillTarget === "sentence") {
            if (state.wordDrill.sentenceAudioUrl) URL.revokeObjectURL(state.wordDrill.sentenceAudioUrl);
            state.wordDrill.sentenceAudioBlob = blob;
            state.wordDrill.sentenceAudioUrl = URL.createObjectURL(blob);
          } else {
            if (state.wordDrill.wordAudioUrl) URL.revokeObjectURL(state.wordDrill.wordAudioUrl);
            state.wordDrill.wordAudioBlob = blob;
            state.wordDrill.wordAudioUrl = URL.createObjectURL(blob);
          }
        } else {
          if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
          state.audioBlob = blob;
          state.audioUrl = URL.createObjectURL(blob);
        }
        state.audioAnalysisPending = true;
        render();
        const audioStats = await analyzeAudioBlob(blob, state.duration || state.elapsed);
        if (target === "coach") state.coach.retake.audioStats = audioStats;
        else if (target === "wordDrill") {
          if (drillTarget === "sentence") state.wordDrill.sentenceAudioStats = audioStats;
          else state.wordDrill.wordAudioStats = audioStats;
        }
        else state.audioStats = audioStats;
        state.audioAnalysisPending = false;
        if (target === "main" && state.transcript.trim() && !state.feedback) {
          analyzeCurrent();
          return;
        }
        if (target === "starter" && state.transcript.trim() && !state.starter.feedback) {
          analyzeStarterStep();
          return;
        }
        if (target === "wordDrill" && getWordDrillTranscript(drillTarget).trim()) {
          analyzeWordDrillPart(drillTarget);
          return;
        }
        render();
      });
      state.mediaRecorder.start();
    } catch (error) {
      showToast("麦克风权限没有打开。你仍然可以手动输入转写后分析。");
    }
  }

  startRecognition();
}

function stopRecording() {
  if (!state.isRecording) return;

  const target = getCurrentRecordingTarget();
  const drillTarget = target === "wordDrill" ? getWordDrillActiveTarget() : null;
  state.isRecording = false;
  state.duration = state.elapsed;
  if (target === "coach") state.coach.retake.duration = state.elapsed;
  if (target === "wordDrill" && drillTarget === "sentence") state.wordDrill.sentenceDuration = state.elapsed;
  if (target === "wordDrill" && drillTarget === "word") state.wordDrill.wordDuration = state.elapsed;
  const transcript = target === "coach"
    ? state.coach.retake.transcript
    : target === "wordDrill"
      ? getWordDrillTranscript(drillTarget)
      : state.transcript;
  state.status = cleanupSpacing(transcript) ? "录音完成，已生成转写" : "录音完成，请检查或手动输入转写";
  stopTimer();

  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (error) {
      // The browser may already have stopped recognition.
    }
  }

  state.mediaRecorder = null;
  state.stream = null;
  state.recognition = null;
  render();

  if (target === "main" && state.transcript.trim()) {
    window.setTimeout(() => {
      if (!state.feedback && !state.audioAnalysisPending) analyzeCurrent();
    }, 900);
  }
  if (target === "starter" && state.transcript.trim()) {
    window.setTimeout(() => {
      if (!state.starter.feedback && !state.audioAnalysisPending) analyzeStarterStep();
    }, 900);
  }
  if (target === "wordDrill" && getWordDrillTranscript(drillTarget).trim()) {
    window.setTimeout(() => {
      if (!state.audioAnalysisPending) analyzeWordDrillPart(drillTarget);
    }, 600);
  }
}

function startRecognition() {
  if (!SpeechRecognitionApi) return;
  try {
    const target = getCurrentRecordingTarget();
    const drillTarget = target === "wordDrill" ? getWordDrillActiveTarget() : null;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.addEventListener("result", (event) => {
      let text = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        text += `${alternative.transcript} `;
        if (result.isFinal && index >= event.resultIndex) {
          state.recognitionStats.finalSegments += 1;
          if (Number.isFinite(alternative.confidence) && alternative.confidence > 0) {
            state.recognitionStats.confidenceSamples.push(alternative.confidence);
          }
        } else if (!result.isFinal) {
          state.recognitionStats.interimSegments += 1;
        }
      }
      const transcript = cleanupSpacing(text);
      if (target === "coach") {
        state.coach.retake.transcript = transcript;
        const input = document.querySelector("#coachTranscriptInput");
        if (input) input.value = state.coach.retake.transcript;
      } else if (target === "wordDrill") {
        setWordDrillTranscript(transcript, drillTarget);
        const input = document.querySelector(drillTarget === "sentence" ? "#wordDrillSentenceInput" : "#wordDrillWordInput");
        if (input) input.value = getWordDrillTranscript(drillTarget);
      } else {
        state.transcript = transcript;
        const input = document.querySelector(target === "starter" ? "#starterTranscriptInput" : "#transcriptInput");
        if (input) input.value = state.transcript;
      }
    });
    recognition.addEventListener("error", () => {
      if (state.isRecording) {
        state.status = "识别暂时不可用，可手动输入转写";
        render();
      }
    });
    recognition.addEventListener("end", () => {
      if (state.isRecording) {
        try {
          recognition.start();
        } catch (error) {
          state.status = "识别已暂停，可继续录音后手动修改文本";
          updateStatusDom();
        }
      }
    });
    state.recognition = recognition;
    recognition.start();
  } catch (error) {
    state.status = "识别启动失败，可手动输入转写";
    updateStatusDom();
  }
}

function startTimer() {
  stopTimer();
  const startedAt = Date.now();
  state.timerId = window.setInterval(() => {
    state.elapsed = Math.floor((Date.now() - startedAt) / 1000);
    updateTimerDom();
  }, 250);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimerDom() {
  const timer = document.querySelector("#timer");
  if (timer) timer.textContent = formatTime(state.elapsed);
}

function updateStatusDom() {
  const status = document.querySelector(".status-line span:last-child");
  if (status) status.textContent = state.status;
}

function speakPrompt() {
  const question = getActiveQuestion(state.tab === "full" && state.full.active);
  if (!window.speechSynthesis) {
    showToast("当前浏览器不支持语音播放。");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(question.text);
  utterance.lang = "en-US";
  utterance.rate = question.type === "repeat" ? 0.88 : 0.94;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  state.status = question.type === "repeat" ? "正在播放句子" : "正在朗读题目";
  render();
}

async function analyzeCurrent() {
  if (state.isScoring) return;
  const question = getActiveQuestion(state.tab === "full" && state.full.active);
  const transcript = cleanupSpacing(state.transcript);
  state.transcript = transcript;

  if (!transcript) {
    showToast("还没有转写文本。可以先录音，也可以手动输入你说的内容。");
    return;
  }

  state.isScoring = true;
  state.status = "正在生成评分报告";
  render();

  const scoringContext = getScoringContext();
  const feedback = question.type === "repeat"
    ? createRepeatFeedback(question, transcript, state.duration || state.elapsed, scoringContext)
    : createInterviewFeedback(question, transcript, state.duration || state.elapsed, scoringContext);
  await enhanceFeedbackWithExternalScorers(feedback, question, transcript, state.duration || state.elapsed, scoringContext);
  feedback.comparison = buildAttemptComparison(feedback, findPreviousAttempt(question.id, transcript));
  feedback.confidence = buildScoringConfidence(question, feedback, transcript, state.duration || state.elapsed, scoringContext);

  state.feedback = feedback;
  state.isScoring = false;
  state.status = "反馈已生成，可以修改后重录";

  const signature = `${question.id}|${transcript}|${feedback.score}|${state.duration}`;
  if (state.lastSavedSignature !== signature) {
    saveHistoryItem({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      type: question.type,
      questionId: question.id,
      prompt: question.text,
      transcript,
      score: feedback.score,
      duration: state.duration || state.elapsed,
      summary: feedback.summary,
      issues: feedback.issues,
      strengths: feedback.strengths,
      detailScores: feedback.detailScores,
      pronunciation: feedback.pronunciation,
      alignment: feedback.alignment || [],
      rubricProfile: feedback.rubricProfile,
      comparison: feedback.comparison,
      confidence: feedback.confidence
    });
    updateLadderAfterFeedback(question, feedback, transcript);
    state.lastSavedSignature = signature;
  }

  if (state.full.active) {
    state.full.results[state.full.index] = {
      question,
      transcript,
      feedback
    };
  }

  render();
}

function startFullRun() {
  stopIfRecording();
  const repeatSet = shuffle([...QUESTION_BANK.repeat]).slice(0, 6);
  const interviewSet = shuffle([...QUESTION_BANK.interview]).slice(0, 5);
  state.full = {
    active: true,
    complete: false,
    examMode: true,
    sequence: shuffle([...repeatSet, ...interviewSet]),
    index: 0,
    results: []
  };
  const current = state.full.sequence[0];
  state.mode = current.type;
  clearCurrentWork(true);
  state.tab = "full";
  render();
  window.setTimeout(() => speakPrompt(), 450);
}

function nextFullItem() {
  if (!state.feedback) {
    showToast("先完成本题分析，再进入下一题。");
    return;
  }

  if (state.full.index >= state.full.sequence.length - 1) {
    state.full.active = false;
    state.full.complete = true;
    clearCurrentWork(true);
    render();
    return;
  }

  state.full.index += 1;
  state.mode = state.full.sequence[state.full.index].type;
  clearCurrentWork(true);
  render();
  window.setTimeout(() => speakPrompt(), 450);
}

function getActiveQuestion(isFullRun) {
  if (state.tab === "starter") return getStarterQuestion();
  if (isFullRun && state.full.sequence.length) {
    return state.full.sequence[state.full.index];
  }
  return state.mode === "repeat" ? state.currentRepeat : state.currentInterview;
}

function nextQuestion() {
  const isFull = state.tab === "full" && state.full.active;
  if (isFull) {
    const current = state.full.sequence[state.full.index];
    const pool = current.type === "repeat" ? QUESTION_BANK.repeat : QUESTION_BANK.interview;
    state.full.sequence[state.full.index] = randomItem(pool.filter((item) => item.id !== current.id));
    state.mode = state.full.sequence[state.full.index].type;
  } else if (state.mode === "repeat") {
    state.currentRepeat = randomItem(QUESTION_BANK.repeat.filter((item) => item.id !== state.currentRepeat.id));
  } else {
    state.currentInterview = randomItem(QUESTION_BANK.interview.filter((item) => item.id !== state.currentInterview.id));
  }
  clearCurrentWork(true);
  render();
}

function practiceQuestion(id) {
  const question = [...QUESTION_BANK.repeat, ...QUESTION_BANK.interview].find((item) => item.id === id);
  if (!question) return;
  stopIfRecording();
  if (question.type === "repeat") {
    state.currentRepeat = question;
    state.mode = "repeat";
  } else {
    state.currentInterview = question;
    state.mode = "interview";
  }
  state.full.active = false;
  state.full.complete = false;
  state.tab = "practice";
  clearCurrentWork(true);
  render();
}

function reviewHistory(id) {
  const item = loadHistory().find((entry) => entry.id === id);
  if (!item) return;
  if (item.trainingMode === "starter") {
    reviewStarterHistory(item);
    return;
  }
  resetCoachSession(false);
  const question = [...QUESTION_BANK.repeat, ...QUESTION_BANK.interview].find((entry) => entry.id === item.questionId) || {
    id: item.questionId,
    type: item.type,
    text: item.prompt,
    category: "History",
    difficulty: "Review",
    sample: ""
  };
  if (question.type === "repeat") {
    state.currentRepeat = question;
    state.mode = "repeat";
  } else {
    state.currentInterview = question;
    state.mode = "interview";
  }
  state.tab = "practice";
  state.transcript = item.transcript;
  state.duration = item.duration;
  state.elapsed = item.duration;
  state.feedback = question.type === "repeat"
    ? createRepeatFeedback(question, item.transcript, item.duration)
    : createInterviewFeedback(question, item.transcript, item.duration);
  state.status = "已载入历史记录";
  render();
}

function clearCurrentWork(keepQuestion) {
  if (!keepQuestion) {
    state.transcript = "";
  } else {
    state.transcript = "";
  }
  state.feedback = null;
  state.isScoring = false;
  state.status = "准备开始";
  state.elapsed = 0;
  state.duration = 0;
  state.audioStats = null;
  state.audioAnalysisPending = false;
  state.recognitionStats = {
    confidenceSamples: [],
    finalSegments: 0,
    interimSegments: 0
  };
  state.showSentence = false;
  state.lastSavedSignature = "";
  if (state.audioUrl) {
    URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = "";
  }
  state.audioBlob = null;
  if (state.coach?.active) resetCoachSession(false);
  else state.recordingTarget = "main";
}

function getDefaultCoachState() {
  return {
    active: false,
    phase: "idle",
    source: null,
    usedAi: false,
    sessionSaved: false,
    original: {
      questionId: null,
      taskType: null,
      questionText: "",
      transcript: "",
      feedback: null,
      audioStats: null,
      historyId: null
    },
    diagnosis: null,
    drill: null,
    retake: {
      transcript: "",
      audioBlob: null,
      audioUrl: "",
      feedback: null,
      audioStats: null,
      duration: 0
    },
    reflection: null,
    isRunning: false,
    error: null
  };
}

function createCoachSessionState({ source, question, transcript, feedback, audioStats, historyId }) {
  return {
    ...getDefaultCoachState(),
    active: true,
    phase: "diagnosing",
    source,
    original: {
      questionId: question.id,
      taskType: question.type,
      questionText: question.text,
      transcript: cleanupSpacing(transcript),
      feedback,
      audioStats,
      historyId
    }
  };
}

function getDefaultWordDrillState() {
  return {
    active: false,
    key: "",
    word: "",
    sentence: "",
    breakdown: [],
    stressHint: "",
    target: "word",
    sourceCount: 0,
    wordTranscript: "",
    sentenceTranscript: "",
    wordCheck: null,
    sentenceCheck: null,
    wordAudioUrl: "",
    sentenceAudioUrl: "",
    wordAudioBlob: null,
    sentenceAudioBlob: null,
    wordAudioStats: null,
    sentenceAudioStats: null,
    wordDuration: 0,
    sentenceDuration: 0
  };
}

function getDefaultMistakeReviewState() {
  return {
    active: false,
    complete: false,
    filter: "weakest",
    deck: [],
    index: 0,
    results: [],
    starredKeys: [],
    startedAt: ""
  };
}

function resetCoachSession(renderNow = true) {
  if (state.coach?.retake?.audioUrl) URL.revokeObjectURL(state.coach.retake.audioUrl);
  state.coach = getDefaultCoachState();
  state.recordingTarget = "main";
  if (renderNow) render();
}

function canUseCoachAi() {
  const setup = state.setup || getDefaultSetupConfig();
  return Boolean(
    setup.coach?.useAi &&
    setup.ai?.endpoint &&
    setup.ai?.apiKey &&
    setup.ai?.model
  );
}

function clearCoachRetakeWork() {
  if (state.coach?.retake?.audioUrl) URL.revokeObjectURL(state.coach.retake.audioUrl);
  state.coach.retake = {
    transcript: "",
    audioBlob: null,
    audioUrl: "",
    feedback: null,
    audioStats: null,
    duration: 0
  };
  state.coach.reflection = null;
  state.coach.sessionSaved = false;
  state.elapsed = 0;
  state.duration = 0;
  state.audioAnalysisPending = false;
  state.recordingTarget = "coach";
  state.recognitionStats = {
    confidenceSamples: [],
    finalSegments: 0,
    interimSegments: 0
  };
}

function createFeedbackFromHistoryItem(item, question) {
  return {
    type: item.type || question.type,
    score: item.score,
    summary: item.summary || "",
    strengths: item.strengths || [],
    issues: item.issues || [],
    improvedAnswer: "",
    metrics: [
      { label: "History", value: `${item.score}/6` },
      { label: "Duration", value: item.duration ? `${item.duration}s` : "-" }
    ],
    detailScores: item.detailScores || [],
    pronunciation: item.pronunciation || null,
    alignment: item.alignment || [],
    rubricProfile: item.rubricProfile || null,
    comparison: item.comparison || null,
    confidence: item.confidence || null
  };
}

function getWeaknessLabel(weakness, taskType) {
  const labels = taskType === "repeat" ? REPEAT_WEAKNESSES : INTERVIEW_WEAKNESSES;
  return labels[weakness] || REPEAT_WEAKNESSES[weakness] || INTERVIEW_WEAKNESSES[weakness] || weakness || "综合问题";
}

function weaknessFromDrill(drill, taskType) {
  const entries = Object.entries(COACH_DRILL_MAP).filter(([, drillId]) => drillId === drill);
  const match = entries.find(([weakness]) => taskType === "repeat" ? weakness in REPEAT_WEAKNESSES : weakness in INTERVIEW_WEAKNESSES);
  if (match) return match[0];
  return taskType === "repeat" ? "keywordRetention" : "exampleSpecificity";
}

function normalizeCoachDiagnosis(raw, payload) {
  const taskType = payload.taskType || "interview";
  const allowed = taskType === "repeat" ? REPEAT_WEAKNESSES : INTERVIEW_WEAKNESSES;
  const fallback = buildLocalCoachDiagnosis({
    ...payload,
    localFeedback: payload.localFeedback || null,
    transcript: payload.transcript || ""
  });
  const primaryWeakness = allowed[raw?.primaryWeakness] ? raw.primaryWeakness : fallback.primaryWeakness;
  const secondaryWeakness = allowed[raw?.secondaryWeakness] && raw.secondaryWeakness !== primaryWeakness
    ? raw.secondaryWeakness
    : inferSecondaryWeakness(primaryWeakness, taskType);
  const recommendedDrill = DRILL_LIBRARY[raw?.recommendedDrill]
    ? raw.recommendedDrill
    : (COACH_DRILL_MAP[primaryWeakness] || (taskType === "repeat" ? "chunk-repeat" : "answer-skeleton"));
  const copy = getCoachCopy(primaryWeakness, taskType);
  return {
    primaryWeakness,
    secondaryWeakness,
    mainDiagnosis: cleanupSpacing(raw?.mainDiagnosis || copy.diagnosis),
    evidence: Array.isArray(raw?.evidence) && raw.evidence.length ? raw.evidence.slice(0, 4) : fallback.evidence,
    coachGoal: cleanupSpacing(raw?.coachGoal || copy.goal),
    recommendedDrill,
    drillInstruction: cleanupSpacing(raw?.drillInstruction || copy.instruction),
    retakeMission: cleanupSpacing(raw?.retakeMission || copy.mission),
    successCriteria: Array.isArray(raw?.successCriteria) && raw.successCriteria.length ? raw.successCriteria.slice(0, 4) : copy.criteria,
    userFacingFeedback: cleanupSpacing(raw?.userFacingFeedback || copy.feedback)
  };
}

function summarizeFeedbackForCoach(feedback) {
  if (!feedback) return "No scored attempt yet.";
  return JSON.stringify({
    score: feedback.score,
    summary: feedback.summary,
    strengths: feedback.strengths || [],
    issues: feedback.issues || [],
    detailScores: (feedback.detailScores || []).map((item) => ({
      label: item.label,
      score: item.score,
      detail: item.detail
    })),
    pronunciation: feedback.pronunciation ? {
      score: feedback.pronunciation.score,
      confidence: feedback.pronunciation.confidence,
      pauseControl: feedback.pronunciation.pauseControl
    } : null
  });
}

function summarizeAudioStats(audioStats) {
  if (!audioStats || !audioStats.available) return "No audio metrics available.";
  return JSON.stringify({
    duration: audioStats.duration,
    rms: audioStats.rms,
    clippingPercent: audioStats.clippingPercent,
    silenceRatio: audioStats.silenceRatio,
    longestSilence: audioStats.longestSilence,
    pauseCount: audioStats.pauseCount,
    snrDb: audioStats.snrDb
  });
}

function inferInterviewWeakness(feedback, transcript) {
  const text = ` ${String(transcript || "").toLowerCase()} `;
  const wordCount = normalizeWords(transcript).length;
  const hasDirect = /\b(i think|i believe|i prefer|i would|my opinion|yes|no)\b/.test(text.slice(0, 160));
  const hasBecause = /\b(because|since|the reason|one reason)\b/.test(text);
  const hasExample = /\b(for example|for instance|last semester|one time|once|when i|in my class|in one course)\b/.test(text);
  const hasResult = /\b(as a result|this helped|therefore|because of this|so i|that is why)\b/.test(text);
  if (!hasDirect && wordCount < 28) return "directAnswer";
  if (!hasBecause) return "reasonDevelopment";
  if (!hasExample) return "exampleSpecificity";
  if (!hasResult) return "organization";
  if ((feedback?.pronunciation?.pauseControl ?? 1) < 0.6) return "fluency";
  return "languageUse";
}

function inferRepeatWeakness(feedback) {
  const details = feedback?.detailScores || [];
  const lowest = [...details].sort((a, b) => Number(a.score) - Number(b.score))[0];
  if (!lowest) return "keywordRetention";
  const label = lowest.label || "";
  if (/完整|遗漏|漏词|Completeness|Listening|处理/.test(label)) return "keywordRetention";
  if (/语序|顺序|order|sequence/i.test(label)) return "wordOrderStability";
  if (/发音|清晰|Pronunciation|intelligibility/i.test(label)) return "pronunciationClarity";
  if (/节奏|停顿|pace|pacing|fluency/i.test(label)) return "paceControl";
  return "endingRetention";
}

function inferSecondaryWeakness(primaryWeakness, taskType) {
  const repeatOrder = ["keywordRetention", "wordOrderStability", "endingRetention", "pronunciationClarity", "paceControl"];
  const interviewOrder = ["directAnswer", "reasonDevelopment", "exampleSpecificity", "organization", "languageUse", "fluency"];
  const order = taskType === "repeat" ? repeatOrder : interviewOrder;
  return order.find((item) => item !== primaryWeakness) || order[0];
}

function buildCoachEvidence(weakness, payload) {
  const text = ` ${String(payload.transcript || "").toLowerCase()} `;
  const evidence = [];
  if (payload.localFeedback?.summary) evidence.push(payload.localFeedback.summary);
  if (weakness === "exampleSpecificity") evidence.push("回答里没有稳定出现 for example / last semester / one time 这类具体场景信号。");
  if (weakness === "reasonDevelopment") evidence.push("观点后缺少 because / since 这样的理由展开。");
  if (weakness === "organization") evidence.push("例子后缺少 as a result / this helped me 这样的结果句。");
  if (weakness === "directAnswer") evidence.push("开头没有足够直接地给出立场。");
  if (weakness === "languageUse") evidence.push("基础结构已经有了，下一步应该升级表达和减少重复。");
  if (weakness === "fluency") evidence.push("停顿、填充词或节奏稳定性是下一遍更值得优先处理的点。");
  if (weakness === "keywordRetention") evidence.push("复述任务优先看关键词和核心内容是否保留下来。");
  if (weakness === "wordOrderStability") evidence.push("复述时需要减少主动改写，先保留原句顺序。");
  if (weakness === "endingRetention") evidence.push("句尾信息容易在复述时丢失，下一遍只盯最后 3-5 个关键词。");
  if (weakness === "pronunciationClarity") evidence.push("系统识别稳定性或本地发音代理分偏低，下一遍先慢速说清内容词。");
  if (weakness === "paceControl") evidence.push("下一遍需要按意群停顿，而不是逐词挤出来。");
  if (/\b(helpful|interesting|good|important)\b/.test(text)) evidence.push("你用了较泛的评价词，可以换成具体行动和结果。");
  return evidence.slice(0, 4);
}

function getCoachCopy(weakness, taskType) {
  const copies = {
    keywordRetention: {
      diagnosis: "你的复述主要问题是关键词保留不够稳定。",
      goal: "先抓住主语、动词、时间地点和内容词。",
      instruction: "把原句拆成 2-3 个意群，每块只保留关键词，再连起来复述。",
      mission: "下一遍只做一件事：保留原句关键词，不主动换词。",
      criteria: ["至少保留主要名词和动词", "不要加入原句没有的信息", "句子意思不能变"],
      feedback: "先求准，再求快。"
    },
    wordOrderStability: {
      diagnosis: "你的复述有内容，但语序和句子骨架不够稳定。",
      goal: "按原句顺序复述，不急着改写。",
      instruction: "听完后先默念句子骨架，再按原来的顺序说出来。",
      mission: "下一遍必须尽量保持原句顺序。",
      criteria: ["先说主语和动词", "中间信息按原顺序", "不主动 paraphrase"],
      feedback: "这一题先练句子骨架。"
    },
    endingRetention: {
      diagnosis: "你的句尾信息容易丢失，导致复述不完整。",
      goal: "把最后一个意群说完整。",
      instruction: "听的时候特别标记最后 3-5 个内容词，复述时放慢句尾。",
      mission: "下一遍必须把句尾关键词说出来。",
      criteria: ["保留最后一个意群", "词尾音说完整", "不要越说越轻"],
      feedback: "这次只盯句尾。"
    },
    pronunciationClarity: {
      diagnosis: "你的发音清晰度会影响系统识别和听感。",
      goal: "慢速说清内容词和词尾音。",
      instruction: "选出 3 个内容词，先慢读两遍，再整句复述。",
      mission: "下一遍放慢 10%，把内容词和词尾音说完整。",
      criteria: ["内容词重读", "词尾音不吞", "录音音量稳定"],
      feedback: "先清楚，再自然。"
    },
    paceControl: {
      diagnosis: "你的语速和停顿控制还不够稳。",
      goal: "按意群连续说完，减少长停顿。",
      instruction: "用斜线把句子分块，每块一口气说完，块与块之间短停顿。",
      mission: "下一遍按 2-3 个意群说，不逐词停顿。",
      criteria: ["长停顿少于 1.2 秒", "每个意群连续", "整体语速自然"],
      feedback: "把句子当成块，不当成单词清单。"
    },
    directAnswer: {
      diagnosis: "你的回答需要更直接地开头表态。",
      goal: "第一句话直接回答题目。",
      instruction: "使用模板：I prefer ___ because ___. 然后再解释。",
      mission: "下一遍第一句必须直接给观点。",
      criteria: ["开头出现 I prefer / I think / I would", "不要先铺垫", "第一句包含 because 或理由方向"],
      feedback: "先回答，再展开。"
    },
    reasonDevelopment: {
      diagnosis: "你的观点有了，但理由展开不足。",
      goal: "用 because 把观点和原因连起来。",
      instruction: "用两句完成：I prefer ___. This is because ___.",
      mission: "下一遍必须有一个清楚的 because 理由句。",
      criteria: ["有 because / since", "理由解释为什么", "不要只说 helpful / good"],
      feedback: "理由要解释作用。"
    },
    exampleSpecificity: {
      diagnosis: "你的回答有观点，但例子不够具体。",
      goal: "加入一个具体经历和一个结果句。",
      instruction: "使用结构：I prefer ___ because ___. For example, last semester I ___. This helped me ___.",
      mission: "下一遍必须包含具体时间或场景、你做了什么、结果是什么。",
      criteria: ["有具体时间或场景", "有一个具体行动", "有结果句"],
      feedback: "从泛泛理由变成真实场景。"
    },
    organization: {
      diagnosis: "你的内容有材料，但结构收束不够清楚。",
      goal: "用观点、理由、例子、结果把回答闭合。",
      instruction: "按四句结构说：观点 → because 理由 → for example 例子 → so/result 结论。",
      mission: "下一遍必须有清楚的结果句或总结句。",
      criteria: ["观点在前", "例子后有结果", "结尾回到题目"],
      feedback: "让听的人知道你说完了什么。"
    },
    languageUse: {
      diagnosis: "你的基础意思能表达，但词汇和句式还比较单一。",
      goal: "把泛词换成具体表达。",
      instruction: "把 good/helpful/interesting 换成 improve my efficiency / receive feedback / reduce stress 这类表达。",
      mission: "下一遍至少升级两个泛泛表达。",
      criteria: ["少用 good / helpful", "加入一个具体动词短语", "语法保持简单但准确"],
      feedback: "升级表达，不堆复杂句。"
    },
    fluency: {
      diagnosis: "你的回答需要更稳定的流利度。",
      goal: "用短句连续说完，减少填充词和长停顿。",
      instruction: "先写 4 个关键词，再用 4 个短句说完，不追求长难句。",
      mission: "下一遍用短句连续说，避免长时间停住。",
      criteria: ["少于 3 个填充词", "每句 8-14 个词", "中途不重启答案"],
      feedback: "短句稳定比长句卡住更好。"
    }
  };
  return copies[weakness] || copies[taskType === "repeat" ? "keywordRetention" : "exampleSpecificity"];
}

function evaluateCoachMission(transcript, weakness) {
  const words = normalizeWords(transcript);
  const lower = ` ${String(transcript || "").toLowerCase()} `;
  const notes = [];
  let passed = false;
  let remainingIssue = "mission 还不够稳定。";
  if (weakness === "exampleSpecificity") {
    const hasScene = /\b(for example|for instance|last semester|one time|once|when i|in my class|in one course)\b/.test(lower);
    const hasResult = /\b(as a result|this helped|therefore|because of this|so i|that is why)\b/.test(lower);
    passed = hasScene && hasResult;
    if (hasScene) notes.push("第二遍加入了具体场景或经历。");
    if (hasResult) notes.push("第二遍补上了结果句。");
    remainingIssue = "还需要同时出现具体场景和结果句。";
  } else if (weakness === "reasonDevelopment") {
    passed = /\b(because|since|the reason)\b/.test(lower) && words.length >= 24;
    if (passed) notes.push("第二遍有更清楚的 because 理由句。");
    remainingIssue = "理由还需要解释为什么，而不是只给评价词。";
  } else if (weakness === "directAnswer") {
    passed = /\b(i think|i believe|i prefer|i would|yes|no)\b/.test(lower.slice(0, 120));
    if (passed) notes.push("第二遍开头更直接地回答了题目。");
    remainingIssue = "第一句话还需要更快给出立场。";
  } else if (weakness === "organization") {
    passed = /\b(for example|for instance)\b/.test(lower) && /\b(as a result|therefore|that is why|so i)\b/.test(lower);
    if (passed) notes.push("第二遍结构更完整，有例子也有结果。");
    remainingIssue = "还需要在例子后补一句结果或总结。";
  } else if (weakness === "languageUse") {
    const uniqueRatio = words.length ? new Set(words).size / words.length : 0;
    passed = words.length >= 30 && uniqueRatio >= 0.55;
    if (passed) notes.push("第二遍表达更丰富，重复词比例更低。");
    remainingIssue = "表达还可以更具体，减少 good/helpful/interesting。";
  } else if (weakness === "fluency") {
    const fillers = lower.match(/\b(um|uh|er|like|you know|sort of|kind of)\b/g) || [];
    passed = words.length >= 25 && fillers.length <= 2;
    if (passed) notes.push("第二遍更连续，填充词控制更好。");
    remainingIssue = "还需要减少填充词或长停顿。";
  } else {
    const refWords = normalizeWords(state.coach.original.questionText);
    const overlap = refWords.length ? countOverlap(refWords, new Set(words)) / Math.max(1, new Set(refWords).size) : 0;
    passed = overlap >= 0.62;
    if (passed) notes.push("第二遍保留了更多原句关键词。");
    remainingIssue = "复述关键词保留还不够，先抓内容词。";
  }
  return { passed, notes, remainingIssue };
}

function normalizeCoachReflection(raw, payload) {
  const fallback = buildLocalCoachReflection(payload);
  return {
    improved: typeof raw?.improved === "boolean" ? raw.improved : fallback.improved,
    improvementSummary: cleanupSpacing(raw?.improvementSummary || fallback.improvementSummary),
    visibleChanges: Array.isArray(raw?.visibleChanges) && raw.visibleChanges.length ? raw.visibleChanges.slice(0, 5) : fallback.visibleChanges,
    remainingIssue: cleanupSpacing(raw?.remainingIssue || fallback.remainingIssue),
    nextAction: cleanupSpacing(raw?.nextAction || fallback.nextAction),
    profileUpdate: {
      stablePassDelta: Number(raw?.profileUpdate?.stablePassDelta ?? fallback.profileUpdate.stablePassDelta),
      patternResolved: Boolean(raw?.profileUpdate?.patternResolved ?? fallback.profileUpdate.patternResolved)
    }
  };
}

function getDefaultCoachProfile() {
  return {
    version: "1.0",
    updatedAt: new Date().toISOString(),
    levelHint: state.ladder?.diagnosed ? (LADDER_LEVELS[state.ladder.level] || LADDER_LEVELS[1]).name : "未诊断",
    primaryWeakness: "",
    secondaryWeakness: "",
    skillState: {
      repeat: {
        keywordRetention: 0.62,
        wordOrderStability: 0.62,
        endingRetention: 0.58,
        pronunciationClarity: 0.66,
        paceControl: 0.66
      },
      interview: {
        directAnswer: 0.68,
        reasonDevelopment: 0.58,
        exampleSpecificity: 0.52,
        organization: 0.56,
        languageUse: 0.58,
        fluency: 0.64
      }
    },
    recentPatterns: [],
    currentCoachGoal: "完成一次 Coach 重答，建立你的第一条复练目标。",
    currentDrill: "example-builder",
    stablePasses: 0
  };
}

function loadCoachProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(COACH_PROFILE_STORAGE_KEY) || "{}");
    return normalizeCoachProfile(saved);
  } catch (error) {
    return getDefaultCoachProfile();
  }
}

function normalizeCoachProfile(saved) {
  const base = getDefaultCoachProfile();
  return {
    ...base,
    ...saved,
    skillState: {
      repeat: { ...base.skillState.repeat, ...(saved.skillState?.repeat || {}) },
      interview: { ...base.skillState.interview, ...(saved.skillState?.interview || {}) }
    },
    recentPatterns: Array.isArray(saved.recentPatterns) ? saved.recentPatterns.slice(0, 8) : [],
    stablePasses: Number.isFinite(Number(saved.stablePasses)) ? Number(saved.stablePasses) : 0
  };
}

function saveCoachProfile(profile) {
  localStorage.setItem(COACH_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function saveCoachSession(session) {
  const sessions = loadCoachSessions();
  sessions.unshift(session);
  localStorage.setItem(COACH_SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 50)));
}

function loadCoachSessions() {
  try {
    const raw = localStorage.getItem(COACH_SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function updateCoachProfile(session) {
  const profile = loadCoachProfile();
  const group = session.taskType === "repeat" ? "repeat" : "interview";
  const primary = session.diagnosis?.primaryWeakness || (group === "repeat" ? "keywordRetention" : "exampleSpecificity");
  const secondary = session.diagnosis?.secondaryWeakness || inferSecondaryWeakness(primary, group);
  const beforeScore = Number(session.before?.score) || 0;
  const afterScore = Number(session.after?.score) || 0;
  const scoreDelta = afterScore && beforeScore ? clamp(-0.25, 0.25, (afterScore - beforeScore) / 6) : 0;
  const currentScore = clamp01((session.reflection?.improved ? 0.72 : 0.42) + scoreDelta);
  profile.skillState[group][primary] = updateSkillScore(profile.skillState[group][primary], currentScore);
  profile.primaryWeakness = primary;
  profile.secondaryWeakness = secondary;
  profile.updatedAt = new Date().toISOString();
  profile.levelHint = state.ladder?.diagnosed ? (LADDER_LEVELS[state.ladder.level] || LADDER_LEVELS[1]).name : profile.levelHint;
  profile.currentCoachGoal = session.drill?.retakeMission || profile.currentCoachGoal;
  profile.currentDrill = session.drill?.id || profile.currentDrill;
  profile.stablePasses = session.reflection?.improved
    ? (profile.stablePasses || 0) + 1
    : Math.max(0, (profile.stablePasses || 0) - 1);
  const pattern = patternForWeakness(primary);
  profile.recentPatterns = [pattern, ...(profile.recentPatterns || []).filter((item) => item !== pattern)].slice(0, 8);
  if (profile.stablePasses >= 3) {
    profile.currentCoachGoal = "这个目标已经连续稳定完成。下一次 Coach 会根据新回答挑一个更高优先级问题。";
    profile.stablePasses = 0;
  }
  saveCoachProfile(profile);
}

function updateSkillScore(oldScore, currentScore, alpha = 0.25) {
  if (!Number.isFinite(Number(oldScore))) return currentScore;
  return Number(oldScore) * (1 - alpha) + Number(currentScore) * alpha;
}

function patternForWeakness(weakness) {
  const patterns = {
    keywordRetention: "missing_keywords_in_repeat",
    wordOrderStability: "unstable_word_order",
    endingRetention: "missing_sentence_ending",
    pronunciationClarity: "low_pronunciation_clarity",
    paceControl: "unstable_pace_control",
    directAnswer: "delayed_direct_answer",
    reasonDevelopment: "generic_reason_without_explanation",
    exampleSpecificity: "generic_reason_without_example",
    organization: "missing_result_sentence",
    languageUse: "limited_language_variety",
    fluency: "fluency_breakdowns"
  };
  return patterns[weakness] || "general_speaking_issue";
}

function stopIfRecording() {
  if (state.isRecording) stopRecording();
  stopTimer();
}

function getFilteredQuestions() {
  return [...QUESTION_BANK.repeat, ...QUESTION_BANK.interview].filter((item) => {
    const typeMatch = state.bankType === "all" || item.type === state.bankType;
    const difficultyMatch = state.bankDifficulty === "all" || item.difficulty === state.bankDifficulty;
    return typeMatch && difficultyMatch;
  });
}

function getDefaultLadderProfile() {
  return {
    diagnosed: false,
    level: 1,
    step: 1,
    recommendedDrill: "example-builder",
    weaknesses: [],
    recent: [],
    stepProgress: {},
    dailyPlan: null,
    currentTask: null,
    diagnostic: null
  };
}

function loadLadderProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(LADDER_STORAGE_KEY) || "{}");
    return normalizeLadderProfile(saved);
  } catch (error) {
    return getDefaultLadderProfile();
  }
}

function normalizeLadderProfile(saved) {
  const base = getDefaultLadderProfile();
  const profile = { ...base, ...(saved || {}) };
  profile.level = clamp(1, 5, Number(profile.level) || 1);
  profile.step = clamp(1, 5, Number(profile.step) || 1);
  profile.weaknesses = Array.isArray(profile.weaknesses) ? profile.weaknesses : [];
  profile.recent = Array.isArray(profile.recent) ? profile.recent : [];
  profile.stepProgress = profile.stepProgress && typeof profile.stepProgress === "object" ? profile.stepProgress : {};
  profile.recommendedDrill = DRILL_LIBRARY[profile.recommendedDrill] ? profile.recommendedDrill : "example-builder";
  return profile;
}

function saveLadderProfile() {
  localStorage.setItem(LADDER_STORAGE_KEY, JSON.stringify(state.ladder));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveHistoryItem(item) {
  const history = loadHistory();
  history.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
}

function exportHistory() {
  const history = loadHistory();
  downloadJson(history, "toefl-speaking-history.json");
}

function exportAllLocalData() {
  downloadJson(buildLocalDataSnapshot(), "voxpilot-local-data.json");
}

function buildLocalDataSnapshot() {
  return {
    version: "1.1",
    exportedAt: new Date().toISOString(),
    app: "VoxPilot Speaking Lab",
    history: loadHistory(),
    ladder: state.ladder || loadLadderProfile(),
    coachProfile: loadCoachProfile(),
    coachSessions: loadCoachSessions(),
    setup: redactSetupConfig(state.setup || loadSetupConfig()),
    note: "API keys are intentionally redacted from this export."
  };
}

function redactSetupConfig(setup) {
  const safe = mergeSetupConfig(getDefaultSetupConfig(), setup || {});
  return {
    ai: {
      enabled: safe.ai.enabled,
      mode: safe.ai.mode,
      endpoint: safe.ai.endpoint,
      hasApiKey: Boolean(safe.ai.apiKey),
      model: safe.ai.model,
      temperature: safe.ai.temperature
    },
    pronunciation: {
      enabled: safe.pronunciation.enabled,
      provider: safe.pronunciation.provider,
      azureRegion: safe.pronunciation.azureRegion,
      endpoint: safe.pronunciation.endpoint,
      hasApiKey: Boolean(safe.pronunciation.apiKey)
    },
    coach: { ...safe.coach }
  };
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clearCoachDataWithConfirm() {
  const hasCoachSessions = loadCoachSessions().length > 0;
  const hasCoachProfile = Boolean(localStorage.getItem(COACH_PROFILE_STORAGE_KEY));
  if (!hasCoachSessions && !hasCoachProfile) return;
  const ok = window.confirm("确定只清空 Coach 复练记录和 Coach Profile 吗？普通练习历史和 Ladder 不会删除。");
  if (!ok) return;
  localStorage.removeItem(COACH_SESSIONS_STORAGE_KEY);
  localStorage.removeItem(COACH_PROFILE_STORAGE_KEY);
  resetCoachSession(false);
  render();
}

function clearHistoryWithConfirm() {
  const hasHistory = loadHistory().length > 0;
  const hasCoachSessions = loadCoachSessions().length > 0;
  const hasCoachProfile = Boolean(localStorage.getItem(COACH_PROFILE_STORAGE_KEY));
  if (!hasHistory && !hasCoachSessions && !hasCoachProfile) return;
  const ok = window.confirm("确定清空本地练习历史、Coach 复练记录和 Coach Profile 吗？这个操作只影响当前浏览器。");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(COACH_SESSIONS_STORAGE_KEY);
  localStorage.removeItem(COACH_PROFILE_STORAGE_KEY);
  resetCoachSession(false);
  render();
}

function getDefaultSetupConfig() {
  return {
    ai: {
      enabled: false,
      mode: "responses",
      endpoint: "",
      apiKey: "",
      model: "",
      temperature: 0.1
    },
    pronunciation: {
      enabled: false,
      provider: "azure",
      azureRegion: "",
      endpoint: "",
      apiKey: ""
    },
    coach: {
      enabled: true,
      useAi: true,
      tone: "balanced",
      singleWeaknessOnly: true
    }
  };
}

function loadSetupConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY) || "{}");
    return mergeSetupConfig(getDefaultSetupConfig(), saved);
  } catch (error) {
    return getDefaultSetupConfig();
  }
}

function mergeSetupConfig(base, saved) {
  return {
    ai: { ...base.ai, ...(saved.ai || {}) },
    pronunciation: { ...base.pronunciation, ...(saved.pronunciation || {}) },
    coach: { ...base.coach, ...(saved.coach || {}) }
  };
}

function saveSetupFromForm() {
  const setup = {
    ai: {
      enabled: Boolean(document.querySelector("#aiEnabled")?.checked),
      mode: document.querySelector("#aiMode")?.value || "responses",
      endpoint: cleanupSpacing(document.querySelector("#aiEndpoint")?.value || ""),
      apiKey: document.querySelector("#aiKey")?.value || "",
      model: cleanupSpacing(document.querySelector("#aiModel")?.value || ""),
      temperature: Number(document.querySelector("#aiTemperature")?.value || 0.1)
    },
    pronunciation: {
      enabled: Boolean(document.querySelector("#pronEnabled")?.checked),
      provider: document.querySelector("#pronProvider")?.value || "azure",
      azureRegion: cleanupSpacing(document.querySelector("#azureRegion")?.value || ""),
      endpoint: cleanupSpacing(document.querySelector("#pronEndpoint")?.value || ""),
      apiKey: document.querySelector("#pronKey")?.value || ""
    },
    coach: {
      enabled: Boolean(document.querySelector("#coachEnabled")?.checked),
      useAi: Boolean(document.querySelector("#coachUseAi")?.checked),
      tone: document.querySelector("#coachTone")?.value || "balanced",
      singleWeaknessOnly: Boolean(document.querySelector("#coachSingleWeaknessOnly")?.checked)
    }
  };
  state.setup = mergeSetupConfig(getDefaultSetupConfig(), setup);
  localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(state.setup));
  showToast("设置已保存到当前浏览器。");
}

function clearSetupWithConfirm() {
  const ok = window.confirm("确定清空本地 API 设置吗？");
  if (!ok) return;
  localStorage.removeItem(SETUP_STORAGE_KEY);
  state.setup = getDefaultSetupConfig();
  render();
}

function averageScore(items) {
  const scored = items.filter((item) => Number.isFinite(Number(item.score)));
  if (!scored.length) return "";
  const average = scored.reduce((sum, item) => sum + Number(item.score), 0) / scored.length;
  return String(roundHalf(average));
}

function normalizeWords(text) {
  return cleanupSpacing(text)
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter(Boolean);
}

function cleanupSpacing(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isWithinDays(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function isToday(value) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(0, 1, value);
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function roundHalf(value) {
  return Math.round(Number(value) * 2) / 2;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

init();
