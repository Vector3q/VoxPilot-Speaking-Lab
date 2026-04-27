# VoxPilot Speaking Lab

**English** | [简体中文](README.zh-CN.md)

VoxPilot Speaking Lab is a no-login, no-database, ready-to-run local speaking practice app. It is designed for TOEFL-style speaking practice, including repetition drills, interview-style responses, simulated scoring, pronunciation diagnostics, retry comparison, and optional AI/API-enhanced feedback.

> Note: This project is not affiliated with ETS and does not include leaked exam questions. The question bank contains original simulation items based on publicly available test-format information.

## Features

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

## Run Locally

```bash
npm.cmd start
```

Then open:

```text
http://localhost:5173
```

If port 5173 is busy, the server will try 5174 automatically.

Chrome or Edge is recommended. If browser speech recognition is unavailable, you can type or edit the transcript manually and then analyze it.

## Scoring

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

## API Setup

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

## Project Structure

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

## Question Bank

The question bank contains original TOEFL-style simulation items based on publicly available TOEFL iBT Speaking format information and common campus/academic contexts.

Official references:

- https://www.ets.org/toefl/test-takers/ibt/about/content/speaking.html
- https://www.ets.org/toefl/test-takers/ibt/prepare.html

## License

MIT
