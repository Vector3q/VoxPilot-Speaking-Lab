# VoxPilot Speaking Lab

**Languages:** [中文](#中文) | [English](#english)

---

## 中文

VoxPilot Speaking Lab 是一个无需登录、无需数据库、开箱即可用的本地口语练习网站。它面向 TOEFL-style 口语训练，支持复述练习、面试问答、模拟评分、发音诊断、复练对比和可选 AI/API 增强。

> 说明：本项目不是 ETS 官方产品，也不包含泄露考场题。题库为基于公开题型说明创作的仿真练习题。

### 功能

- Listen and Repeat 复述练习
- Take an Interview 面试问答练习
- 11 题完整练习模式
- 110 道仿真题：60 道复述题，50 道问答题
- 浏览器录音、回放和语音识别转写
- 1-6 半分制本地模拟评分
- 音频质量、停顿、语速、信噪比和发音可识别度诊断
- 疑似音素训练点：`/θ/`、`/r/`、`/l/`、词尾音、辅音连缀等
- 同题复练对比
- 历史记录和弱项追踪
- API Setup 页面，可选接入 AI 内容评分和外部发音评分

### 运行

```bash
npm.cmd start
```

然后打开：

```text
http://localhost:5173
```

如果 5173 被占用，服务器会自动尝试 5174。

推荐使用最新版 Chrome 或 Edge。若浏览器不支持语音识别，可以手动输入转写文本后点击分析。

### 评分系统

本地评分引擎按 1-6 半分制输出模拟分，不等同 ETS 官方评分。

Listen and Repeat 会综合：

- 听辨处理
- 完整复述
- 语序稳定
- 发音可识别
- 清晰节奏

Take an Interview 会综合：

- 任务回应
- 观点展开
- 组织逻辑
- 语言使用
- 发音可识别
- 表达流利

录音结束后还会分析：

- 音量 RMS
- 峰值和削波
- 静音占比
- 最长停顿
- 停顿次数
- 估算信噪比 SNR
- 去除静音后的发声语速

### API Setup

网站内置 `Setup` 页面。你可以在界面里填写自己的 API key、endpoint 和 model。

支持：

- OpenAI Responses API
- OpenAI-compatible Chat Completions endpoint
- Azure Speech Pronunciation Assessment
- 自定义发音评分 JSON endpoint

安全设计：

- API key 不写进源码
- 配置只保存在当前浏览器的 `localStorage`
- 提交到 GitHub 不会包含你的个人密钥
- 没有配置 API 时，系统会自动使用本地评分

如果部署到公开网站，用户填写的 key 会从用户自己的浏览器发起请求。部分服务可能有 CORS 限制；遇到这种情况，可以用自定义后端代理或 custom endpoint。

### 项目结构

```text
.
├── app.js
├── index.html
├── styles.css
├── server.js
├── package.json
├── README.md
└── LICENSE
```

### 题库说明

题库按 ETS 公开的 TOEFL iBT Speaking 题型说明和校园/学术场景原创编写，用来模拟练习节奏和回答方式。

官方信息可参考：

- https://www.ets.org/toefl/test-takers/ibt/about/content/speaking.html
- https://www.ets.org/toefl/test-takers/ibt/prepare.html

### License

MIT

---

## English

VoxPilot Speaking Lab is a no-login, no-database, ready-to-run local speaking practice app. It is designed for TOEFL-style speaking practice, including repetition drills, interview-style responses, simulated scoring, pronunciation diagnostics, retry comparison, and optional AI/API-enhanced feedback.

> Note: This project is not affiliated with ETS and does not include leaked exam questions. The question bank contains original simulation items based on publicly available test-format information.

### Features

- Listen and Repeat practice
- Take an Interview practice
- 11-item full practice mode
- 110 simulation questions: 60 repetition items and 50 interview items
- Browser recording, playback, and speech recognition transcription
- Local simulated 1-6 half-point scoring
- Audio quality, pauses, pace, estimated SNR, and intelligibility diagnostics
- Suspected pronunciation focus points: `/θ/`, `/r/`, `/l/`, final consonants, consonant clusters, and more
- Same-question retry comparison
- Local history and weakness tracking
- Setup page for optional AI scoring and external pronunciation assessment

### Run Locally

```bash
npm.cmd start
```

Then open:

```text
http://localhost:5173
```

If port 5173 is busy, the server will try 5174 automatically.

Chrome or Edge is recommended. If browser speech recognition is unavailable, you can type or edit the transcript manually and then analyze it.

### Scoring

The local scoring engine outputs simulated 1-6 half-point scores. It is not an official ETS scoring system.

Listen and Repeat evaluates:

- Listening processing
- Completeness
- Word-order stability
- Pronunciation intelligibility
- Clear pacing

Take an Interview evaluates:

- Task response
- Idea development
- Organization
- Language use
- Pronunciation intelligibility
- Fluency

After recording, the app also analyzes:

- RMS volume
- Peak and clipping
- Silence ratio
- Longest pause
- Pause count
- Estimated SNR
- Articulation rate excluding silence

### API Setup

The app includes a `Setup` page where users can enter their own API keys, endpoints, and models.

Supported options:

- OpenAI Responses API
- OpenAI-compatible Chat Completions endpoint
- Azure Speech Pronunciation Assessment
- Custom pronunciation scoring JSON endpoint

Security design:

- API keys are not stored in source code
- Configuration is saved only in the current browser's `localStorage`
- Publishing the repo to GitHub will not expose personal keys
- If no API is configured, the app continues to use local scoring

If deployed as a public site, requests are made from the user's browser with the user's own key. Some services may block direct browser requests due to CORS; in that case, use a custom backend proxy or custom endpoint.

### Project Structure

```text
.
├── app.js
├── index.html
├── styles.css
├── server.js
├── package.json
├── README.md
└── LICENSE
```

### Question Bank

The question bank contains original TOEFL-style simulation items based on publicly available TOEFL iBT Speaking format information and common campus/academic contexts.

Official references:

- https://www.ets.org/toefl/test-takers/ibt/about/content/speaking.html
- https://www.ets.org/toefl/test-takers/ibt/prepare.html

### License

MIT
