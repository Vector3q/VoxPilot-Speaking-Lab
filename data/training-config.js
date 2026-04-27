const STORAGE_KEY = "toefl-speaking-lab-history-v1";
const SETUP_STORAGE_KEY = "toefl-speaking-lab-setup-v1";
const LADDER_STORAGE_KEY = "voxpilot-ladder-profile-v1";
const COACH_PROFILE_STORAGE_KEY = "voxpilot-coach-profile-v1";
const COACH_SESSIONS_STORAGE_KEY = "voxpilot-coach-sessions-v1";
const LADDER_LEVELS = {
  1: { name: "L1 Survival", target: "先能稳定开口，复述短句，回答完整句。", threshold: 3.2 },
  2: { name: "L2 Stable", target: "减少漏词，回答里稳定加入明确理由。", threshold: 3.8 },
  3: { name: "L3 Developing", target: "把理由、例子和结果说完整。", threshold: 4.4 },
  4: { name: "L4 Test Ready", target: "在限时状态下保持自然节奏和清楚表达。", threshold: 5 },
  5: { name: "L5 Advanced", target: "打磨高分表达、自然语音和复杂内容。", threshold: 5.4 }
};

const LADDER_STEPS = {
  1: [
    { id: "l1-s1", title: "Short Repeat", type: "repeat", difficulty: "Easy", drill: "chunk-repeat", goal: "复述 8-10 词短句，先不追求快。" },
    { id: "l1-s2", title: "One Clear Sentence", type: "interview", difficulty: "Easy", drill: "answer-skeleton", goal: "用一个完整句直接回答问题。" },
    { id: "l1-s3", title: "Reason Starter", type: "interview", difficulty: "Easy", drill: "because-builder", goal: "每个回答都加入 because 理由。" },
    { id: "l1-s4", title: "Clean Ending", type: "repeat", difficulty: "Easy", drill: "pronunciation-focus", goal: "把词尾音和关键词说清楚。" },
    { id: "l1-s5", title: "Mini Check", type: "mixed", difficulty: "Easy", drill: "checkpoint", goal: "完成短复述和简单问答小测。" }
  ],
  2: [
    { id: "l2-s1", title: "Campus Repeat", type: "repeat", difficulty: "Medium", drill: "chunk-repeat", goal: "复述 12-15 词校园句，减少漏词。" },
    { id: "l2-s2", title: "Because Chain", type: "interview", difficulty: "Easy", drill: "because-builder", goal: "观点后立刻给出清楚理由。" },
    { id: "l2-s3", title: "First Example", type: "interview", difficulty: "Medium", drill: "example-builder", goal: "每题加入一个具体例子。" },
    { id: "l2-s4", title: "Speed Control", type: "interview", difficulty: "Medium", drill: "speed-control", goal: "控制在自然语速区间，减少停顿。" },
    { id: "l2-s5", title: "Stability Check", type: "mixed", difficulty: "Medium", drill: "checkpoint", goal: "连续完成复述和问答，检查稳定性。" }
  ],
  3: [
    { id: "l3-s1", title: "Academic Repeat", type: "repeat", difficulty: "Hard", drill: "chunk-repeat", goal: "复述学术句，保留内容词和语序。" },
    { id: "l3-s2", title: "Example Builder", type: "interview", difficulty: "Medium", drill: "example-builder", goal: "例子要有人、事、结果。" },
    { id: "l3-s3", title: "Result Sentence", type: "interview", difficulty: "Medium", drill: "result-builder", goal: "例子后补一句结果或意义。" },
    { id: "l3-s4", title: "Language Upgrade", type: "interview", difficulty: "Hard", drill: "language-upgrade", goal: "减少重复词，加入更自然表达。" },
    { id: "l3-s5", title: "Timed Check", type: "mixed", difficulty: "Medium", drill: "checkpoint", goal: "在限时下完成完整结构。" }
  ],
  4: [
    { id: "l4-s1", title: "Hard Repeat", type: "repeat", difficulty: "Hard", drill: "shadow-sprint", goal: "保持高准确率和自然节奏。" },
    { id: "l4-s2", title: "Timed Interview", type: "interview", difficulty: "Hard", drill: "timed-response", goal: "45-60 秒内说完整。" },
    { id: "l4-s3", title: "Fluency Polish", type: "interview", difficulty: "Hard", drill: "speed-control", goal: "减少填充词和长停顿。" },
    { id: "l4-s4", title: "Pronunciation Polish", type: "mixed", difficulty: "Hard", drill: "pronunciation-focus", goal: "针对疑似音素和词尾音补弱。" },
    { id: "l4-s5", title: "Mock Segment", type: "mixed", difficulty: "Hard", drill: "checkpoint", goal: "完成小段模考并保持稳定。" }
  ],
  5: [
    { id: "l5-s1", title: "Precision Repeat", type: "repeat", difficulty: "Hard", drill: "shadow-sprint", goal: "追求接近原句的高精度复述。" },
    { id: "l5-s2", title: "Advanced Interview", type: "interview", difficulty: "Hard", drill: "language-upgrade", goal: "回答更自然、有层次。" },
    { id: "l5-s3", title: "Compression", type: "interview", difficulty: "Hard", drill: "timed-response", goal: "用更少废话表达更多信息。" },
    { id: "l5-s4", title: "Voice Control", type: "mixed", difficulty: "Hard", drill: "pronunciation-focus", goal: "细化清晰度、节奏和重音。" },
    { id: "l5-s5", title: "High Score Check", type: "mixed", difficulty: "Hard", drill: "checkpoint", goal: "冲刺高分稳定输出。" }
  ]
};

const DRILL_LIBRARY = {
  "chunk-repeat": { label: "Chunk Repeat", tip: "把句子拆成 2-3 个意群，先逐块复述，再整句复述。" },
  "shadow-sprint": { label: "Shadow Sprint", tip: "先听一遍，再用接近原速跟读，重点模仿停顿和重音。" },
  "answer-skeleton": { label: "Answer Skeleton", tip: "按 I prefer ___ because ___. For example, ___. 说完整。" },
  "because-builder": { label: "Because Builder", tip: "第一句直接回答，第二句必须用 because 给理由。" },
  "example-builder": { label: "Example Builder", tip: "例子里说清楚 when、where、what happened、result。" },
  "result-builder": { label: "Result Builder", tip: "例子后补一句结果：This helped me... / As a result..." },
  "pronunciation-focus": { label: "Pronunciation Focus", tip: "根据报告里的疑似音素，慢速重读内容词和词尾音。" },
  "speed-control": { label: "Speed Control", tip: "目标语速 100-150 WPM，长停顿少于 1.2 秒。" },
  "language-upgrade": { label: "Language Upgrade", tip: "把重复动词换成更具体表达，加入一个从句。" },
  "timed-response": { label: "Timed Response", tip: "用 45-60 秒完成观点、理由、例子、结果。" },
  "checkpoint": { label: "Checkpoint", tip: "像小测一样完成，不中途换题，不看答案。" }
};

const REPEAT_WEAKNESSES = {
  keywordRetention: "关键词保留不足",
  wordOrderStability: "语序不稳定",
  endingRetention: "句尾容易丢失",
  pronunciationClarity: "发音清晰度不足",
  paceControl: "语速和停顿控制不稳"
};

const INTERVIEW_WEAKNESSES = {
  directAnswer: "没有直接回答",
  reasonDevelopment: "理由展开不足",
  exampleSpecificity: "例子不够具体",
  organization: "结构不清楚",
  languageUse: "词汇语法表达单一",
  fluency: "流利度不足"
};

const COACH_DRILL_MAP = {
  keywordRetention: "chunk-repeat",
  wordOrderStability: "chunk-repeat",
  endingRetention: "chunk-repeat",
  pronunciationClarity: "pronunciation-focus",
  paceControl: "speed-control",
  directAnswer: "answer-skeleton",
  reasonDevelopment: "because-builder",
  exampleSpecificity: "example-builder",
  organization: "answer-skeleton",
  languageUse: "language-upgrade",
  fluency: "timed-response"
};
