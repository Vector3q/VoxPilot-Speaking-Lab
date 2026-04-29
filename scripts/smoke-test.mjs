import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPaths = [
  path.join(root, "data", "question-bank.js"),
  path.join(root, "data", "training-config.js"),
  path.join(root, "logic", "scoring-engine.js")
];
const appPath = path.join(root, "app.js");
const source = [
  ...dataPaths.map((filePath) => fs.readFileSync(filePath, "utf8")),
  fs.readFileSync(appPath, "utf8")
].join("\n");

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

const appElement = { innerHTML: "" };
const noopElement = {
  value: "",
  textContent: "",
  dataset: {},
  style: {},
  addEventListener() {},
  click() {}
};

const context = {
  console,
  Blob,
  URL: {
    createObjectURL: () => "blob:mock",
    revokeObjectURL() {}
  },
  crypto: {
    randomUUID: () => "test-id"
  },
  localStorage: createLocalStorage(),
  navigator: {},
  SpeechSynthesisUtterance: function SpeechSynthesisUtterance(text) {
    this.text = text;
  },
  window: {
    SpeechRecognition: null,
    webkitSpeechRecognition: null,
    MediaRecorder: null,
    speechSynthesis: {
      cancel() {},
      speak() {}
    },
    confirm: () => true,
    setTimeout: (fn) => {
      if (typeof fn === "function") fn();
      return 0;
    },
    clearTimeout() {}
  },
  document: {
    querySelector(selector) {
      if (selector === "#app") return appElement;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return { ...noopElement };
    }
  },
  setTimeout: (fn) => {
    if (typeof fn === "function") fn();
    return 0;
  },
  clearTimeout() {}
};

context.window.window = context.window;
context.window.document = context.document;

const expose = `
globalThis.__voxpilot = {
  state,
  STORAGE_KEY,
  COACH_PROFILE_STORAGE_KEY,
  COACH_SESSIONS_STORAGE_KEY,
  createInterviewFeedback,
  analyzeStarterStep,
  buildScoringConfidence,
  nextQuestion,
  clearHistoryWithConfirm,
  loadCoachSessions,
  buildLocalDataSnapshot,
  buildPronunciationNotebook,
  buildWordPronunciationNotebook,
  startWordEchoDrill,
  analyzeWordDrillPart,
  startMistakeReview,
  finishMistakeReviewCard
};
`;

vm.runInNewContext(`${source}\n${expose}`, context, {
  filename: "app.js",
  timeout: 5000
});

const api = context.__voxpilot;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(appElement.innerHTML.includes("VoxPilot Speaking Lab"), "initial render failed");
assert(appElement.innerHTML.includes("Start Easy") || appElement.innerHTML.includes("起步训练"), "starter mode did not render");

api.state.transcript = "I prefer studying with classmates.";
api.analyzeStarterStep();
assert(api.state.starter.feedback?.result === "pass", "starter step 1 should pass a direct answer");
assert(context.localStorage.getItem(api.STORAGE_KEY)?.includes("starter"), "starter attempt was not saved");

const question = api.state.currentInterview;
const transcript = "I prefer studying with classmates because I can get useful feedback. For example, last semester I prepared a presentation with two classmates. As a result, our presentation became clearer.";
const feedback = api.createInterviewFeedback(question, transcript, 52, {
  audioStats: null,
  recognitionStats: { confidenceSamples: [], finalSegments: 0, interimSegments: 0 }
});
feedback.confidence = api.buildScoringConfidence(question, feedback, transcript, 52, {
  audioStats: null,
  recognitionStats: { confidenceSamples: [], finalSegments: 0, interimSegments: 0 }
});
assert(feedback.score >= 1 && feedback.score <= 6, "feedback score is outside 1-6");
assert(["high", "medium", "low"].includes(feedback.confidence.level), "confidence level missing");

api.state.coach.active = true;
api.state.coach.phase = "complete";
api.state.coach.original.questionId = api.state.currentRepeat.id;
api.state.recordingTarget = "coach";
api.nextQuestion();
assert(api.state.recordingTarget === "main", "nextQuestion did not reset recording target");
assert(api.state.coach.active === false, "nextQuestion did not clear coach state");

context.localStorage.setItem(api.STORAGE_KEY, JSON.stringify([{ id: "h1" }]));
context.localStorage.setItem(api.COACH_SESSIONS_STORAGE_KEY, JSON.stringify([{ id: "c1" }]));
context.localStorage.setItem(api.COACH_PROFILE_STORAGE_KEY, JSON.stringify({ primaryWeakness: "exampleSpecificity" }));
api.clearHistoryWithConfirm();
assert(context.localStorage.getItem(api.STORAGE_KEY) === null, "history was not cleared");
assert(context.localStorage.getItem(api.COACH_SESSIONS_STORAGE_KEY) === null, "coach sessions were not cleared");
assert(context.localStorage.getItem(api.COACH_PROFILE_STORAGE_KEY) === null, "coach profile was not cleared");

context.localStorage.setItem(api.STORAGE_KEY, JSON.stringify([{ id: "h2" }]));
api.state.setup.ai.apiKey = "secret-key";
const snapshot = api.buildLocalDataSnapshot();
assert(snapshot.setup.ai.hasApiKey === true, "export should preserve key presence");
assert(!JSON.stringify(snapshot).includes("secret-key"), "export leaked an API key");

context.localStorage.setItem(api.STORAGE_KEY, JSON.stringify([
  {
    id: "pron-1",
    type: "repeat",
    questionId: "lr-01",
    prompt: "The library will extend its hours during final exam week.",
    transcript: "library hours final exam week",
    createdAt: new Date().toISOString(),
    alignment: [
      { type: "match", ref: "the", hyp: "the" },
      { type: "substitute", ref: "library", hyp: "liberty" },
      { type: "missing", ref: "extend", hyp: "" },
      { type: "match", ref: "hours", hyp: "hours" }
    ],
    pronunciation: {
      external: {
        provider: "Test",
        words: [
          { word: "environment", score: 62, errorType: "Mispronunciation" }
        ]
      },
      phonemeFocus: [
        { sound: "/r/ vs /l/", label: "right / library", tip: "Practice r and l.", words: ["library", "clearly"] }
      ]
    }
  }
]));
const notebook = api.buildPronunciationNotebook();
assert(notebook.length === 1, "pronunciation notebook did not aggregate history");
assert(notebook[0].words.some((item) => item.word === "library"), "pronunciation notebook missed focus words");
const wordNotebook = api.buildWordPronunciationNotebook();
assert(wordNotebook.some((item) => item.word === "library" && item.heardAs.some((heard) => heard.word === "liberty")), "word notebook missed repeat substitutions");
assert(wordNotebook.some((item) => item.word === "environment" && item.hasExternal), "word notebook missed external word scores");
api.startWordEchoDrill("library");
assert(api.state.wordDrill.active === true, "word drill did not start");
api.state.wordDrill.wordTranscript = "library";
api.analyzeWordDrillPart("word");
assert(api.state.wordDrill.wordCheck?.result === "pass", "word drill should pass exact word repetition");
api.state.wordDrill.sentenceTranscript = "The library will extend its hours this week.";
api.analyzeWordDrillPart("sentence");
assert(api.state.wordDrill.sentenceCheck?.result === "pass", "word drill sentence should pass exact sentence repetition");
api.startMistakeReview("weakest");
assert(api.state.mistakeReview.active === true, "mistake review deck did not start");
assert(api.state.mistakeReview.deck.length >= 1, "mistake review deck is empty");
api.state.wordDrill.wordTranscript = api.state.wordDrill.word;
api.analyzeWordDrillPart("word");
api.state.wordDrill.sentenceTranscript = api.state.wordDrill.sentence;
api.analyzeWordDrillPart("sentence");
api.finishMistakeReviewCard("pass");
assert(api.state.mistakeReview.results.length === 1, "mistake review did not record a completed card");

console.log("VoxPilot smoke test passed");
