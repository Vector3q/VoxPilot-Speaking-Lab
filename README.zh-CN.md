# VoxPilot Speaking Lab

[English](README.md) | **简体中文**

VoxPilot Speaking Lab 是一个无需登录、无需数据库、开箱即可用的本地口语练习网站。它面向 TOEFL-style 口语训练，支持复述练习、面试问答、模拟评分、发音诊断、复练对比和可选 AI/API 增强。

> 说明：本项目不是 ETS 官方产品，也不包含泄露考场题。题库为基于公开题型说明创作的仿真练习题。

## 功能

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
- 自适应 Ladder 训练：诊断分级、今日任务、阶梯升级
- API Setup 页面，可选接入 AI 内容评分和外部发音评分

## 运行

```bash
npm.cmd start
```

然后打开：

```text
http://localhost:5173
```

如果 5173 被占用，服务器会自动尝试 5174。

推荐使用最新版 Chrome 或 Edge。若浏览器不支持语音识别，可以手动输入转写文本后点击分析。

## 评分系统

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

## 自适应 Ladder

`Ladder` 模块会把单题练习变成渐进训练路径：

- 先做 6 题诊断
- 自动分到 L1 Survival 到 L5 Advanced
- 生成今日训练：热身、核心 step、补弱 drill、检查点
- 每次评分后自动更新进度
- 根据弱项推荐 Chunk Repeat、Example Builder、Pronunciation Focus、Speed Control 等训练
- 最近表现稳定后才升级，避免一次高分就误判水平

## Coach Capsule

Coach Capsule 是按需出现的深度复练闭环。它会在一次评分后、Ladder 推荐修正处、历史记录复盘处启动。

Basic 模式不需要任何 API：

- 从固定 weakness taxonomy 中诊断一个主要问题
- 把弱项映射到一个 micro-drill
- 保留第一遍回答，不覆盖原始转写
- 引导用户重答同一题
- 本地比较 before / after
- 把结果更新到当前浏览器的 Coach Profile

AI 模式是可选增强：

- 复用 Setup 里的 AI 内容评分配置
- 生成更细的诊断、micro-drill 和 retake mission
- API 调用失败时自动回到 Basic 本地规则
- API key 不会写入仓库

## API Setup

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

## 项目结构

```text
.
├── app.js
├── index.html
├── styles.css
├── server.js
├── package.json
├── README.md
├── README.zh-CN.md
└── LICENSE
```

## 题库说明

题库按 ETS 公开的 TOEFL iBT Speaking 题型说明和校园/学术场景原创编写，用来模拟练习节奏和回答方式。

官方信息可参考：

- https://www.ets.org/toefl/test-takers/ibt/about/content/speaking.html
- https://www.ets.org/toefl/test-takers/ibt/prepare.html

## License

MIT
