# VoxPilot Speaking Lab

一个无需登录、无需数据库、开箱即可用的托福口语练习网站。它面向 2026 新托福口语练习，包含 `Listen and Repeat`、`Take an Interview`、完整练习、本地历史记录和题库。

## 运行

```bash
npm.cmd start
```

然后打开：

```text
http://localhost:5173
```

如果 5173 被占用，服务器会自动尝试 5174。

## 功能

- 使用浏览器语音合成播放英文句子
- 使用浏览器语音识别生成转写
- 本地启发式评分，不需要 API key
- Listen and Repeat 差异高亮
- Interview 结构、内容、流利度、语言反馈
- 110 道仿真题：60 道 Listen and Repeat，50 道 Take an Interview
- 11 题完整练习流程
- 使用 `localStorage` 保存最近练习记录

## 题库说明

题库按 ETS 公开的 2026 TOEFL iBT Speaking 题型说明和校园/学术场景原创编写，用来模拟练习节奏和回答方式。项目不包含泄露考场题，也不声称题目等同 ETS 官方真题。

官方信息可参考：

- https://www.ets.org/toefl/test-takers/ibt/about/content/speaking.html
- https://www.ets.org/toefl/test-takers/ibt/prepare.html

## 评分说明

当前评分引擎是专业本地模拟评分，按 1-6 半分制输出，不等同 ETS 官方评分。

Listen and Repeat 会综合：

- 听辨处理：原句词、内容词和用户复述文本的匹配程度
- 完整复述：漏词比例和句子覆盖程度
- 语序稳定：替换、多说、漏说对句子顺序的影响
- 清晰节奏：回答时长是否接近自然复述速度
- 发音可识别：语音识别置信度、内容词匹配和录音质量的综合代理分

Take an Interview 会综合：

- 任务回应：是否直接回答问题，是否与题目相关
- 观点展开：是否有理由、例子和结果说明
- 组织逻辑：是否形成“观点-理由-例子-结果”的结构
- 语言使用：词汇多样性、内容词密度和句式复杂度
- 发音可识别：识别稳定性、音频质量和关键词清晰度
- 表达流利：语速、时长和填充词情况

录音结束后还会分析音频质量、静音占比、长停顿、估算信噪比、削波和发声语速。由于浏览器本地能力有限，目前的发音分是 pronunciation proxy，不是音素级 forced alignment；如果以后接入专业语音评测 API，可以沿用当前报告结构补充 `/θ/`、`/r/`、词尾音和重音等细项。

新增的完整评分闭环包括：

- 考试权重：每次报告展示当前题型的官方风格权重分布
- 疑似音素诊断：根据错漏词、内容词和高风险音素生成 `/θ/`、`/r/`、词尾音等训练提示
- 复练对比：同一道题再次练习时，对比分数和分项变化
- 弱项追踪：历史页统计最近练习中最低的评分维度和高频问题
- 考试模式：完整练习会自动朗读题目，并锁定换题和显示原句

## API Setup

网站有一个 `Setup` 页面，可以填写自己的 API，不需要把任何密钥写进代码：

- AI 内容评分：支持 OpenAI Responses API，或 OpenAI-compatible Chat Completions endpoint
- 发音评分：支持 Azure Speech Pronunciation Assessment，或自定义 JSON endpoint
- 所有 endpoint、model、API key 只保存到当前浏览器的 `localStorage`
- 提交到 GitHub 的文件不包含个人密钥

Azure 发音评分会把浏览器录音转换为 16kHz WAV，再调用 Pronunciation Assessment。自定义 endpoint 会收到题目、转写、音频 base64 和本地音频统计，方便以后接自己的后端或 forced-alignment 服务。

## 浏览器建议

推荐使用最新版 Chrome 或 Edge。若浏览器不支持语音识别，可以手动输入转写文本后点击分析。
