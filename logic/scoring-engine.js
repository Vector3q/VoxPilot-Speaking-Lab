function createRepeatFeedback(question, transcript, duration, context = {}) {
  const refWords = normalizeWords(question.text);
  const hypWords = normalizeWords(transcript);
  const alignment = alignWords(refWords, hypWords);
  const stats = countAlignment(alignment);
  const refLength = Math.max(1, refWords.length);
  const hypLength = Math.max(1, hypWords.length);
  const exactRecall = stats.matches / refLength;
  const precision = stats.matches / hypLength;
  const contentRecall = getContentRecall(alignment, refWords);
  const omissionRate = stats.missing / refLength;
  const substitutionRate = stats.substitutions / refLength;
  const extraRate = stats.extras / refLength;
  const lengthFit = clamp01(1 - Math.abs(hypWords.length - refWords.length) / Math.max(refWords.length, 4));
  const sequenceScore = clamp01(1 - (stats.substitutions + stats.extras * 0.65 + stats.missing * 0.85) / refLength);
  const expectedSeconds = Math.max(3, refWords.length / 2.25);
  const paceScore = duration ? clamp01(1 - Math.abs(duration - expectedSeconds) / Math.max(expectedSeconds, 5)) : 0.58;
  const fillerPenalty = getFillerPenalty(transcript);
  const audioQualityScore = getAudioQualityScore(context.audioStats);
  const pauseScore = getPauseScore(context.audioStats, duration);
  const recognitionConfidenceScore = getRecognitionConfidenceScore(context.recognitionStats);
  const processingScore = clamp01(exactRecall * 0.68 + precision * 0.18 + contentRecall * 0.14 - extraRate * 0.16);
  const completenessScore = clamp01(1 - omissionRate * 1.35);
  const pronunciationScore = getPronunciationProxy({
    exactRecall,
    precision,
    contentRecall,
    deliveryScore: paceScore,
    audioQualityScore,
    recognitionConfidenceScore,
    fillerPenalty
  });
  const intelligibilityProxy = clamp01(precision * 0.35 + contentRecall * 0.2 + recognitionConfidenceScore * 0.2 + audioQualityScore * 0.15 + lengthFit * 0.1 - fillerPenalty);
  const deliveryScore = clamp01(paceScore * 0.48 + pauseScore * 0.22 + lengthFit * 0.16 + audioQualityScore * 0.14 - fillerPenalty);
  const composite = clamp01(
    processingScore * 0.34 +
    completenessScore * 0.2 +
    sequenceScore * 0.14 +
    pronunciationScore * 0.2 +
    deliveryScore * 0.12
  );
  const score = applyRepeatCaps(roundHalf(1 + composite * 5), {
    exactRecall,
    precision,
    hypWords,
    refWords,
    stats,
    deliveryScore
  });
  const issues = [];
  const strengths = [];

  if (processingScore >= 0.82) strengths.push("听到的核心信息处理比较准确，关键词保留较好。");
  if (completenessScore >= 0.82) strengths.push("原句覆盖较完整，没有明显只复述一小段。");
  if (sequenceScore >= 0.8) strengths.push("语序和句子骨架比较稳定，听起来更接近原句。");
  if (pronunciationScore >= 0.74) strengths.push("发音可识别度较好，系统能较稳定地捕捉到你的词。");
  if (deliveryScore >= 0.78) strengths.push("节奏接近自然复述速度，没有明显拖长或抢跑。");

  if (stats.missing > 0) issues.push(`漏掉 ${stats.missing} 个原句词，下一遍先抓主语、动词、时间和地点信息。`);
  if (stats.substitutions > 0) issues.push(`有 ${stats.substitutions} 处替换词；复述题先追求准确，不要主动改写。`);
  if (stats.extras > 2) issues.push("多说了较多原句没有的词，可能影响“准确复述”这一项。");
  if (contentRecall < 0.75) issues.push("内容词保留不够，优先听清名词、动词、形容词和数字信息。");
  if (pronunciationScore < 0.55) issues.push("发音可识别度偏低；优先放慢重读内容词，并把词尾音说完整。");
  if (audioQualityScore < 0.55) issues.push("录音质量会影响评分，建议离麦克风近一点并避开背景噪音。");
  if (duration && deliveryScore < 0.58) issues.push("节奏与原句差距较大，建议按意群复述，而不是逐词挤出来。");
  if (!issues.length) issues.push("下一遍可以挑战只听一遍，并保持同样准确度。");
  if (!strengths.length) strengths.push("你已经完成了一次可分析的复述，下一遍从减少漏词和替换词开始。");

  return {
    type: "repeat",
    score,
    summary: `专业模拟评分：${getBandLabel(score)}。听辨准确约 ${Math.round(processingScore * 100)}%，完整度约 ${Math.round(completenessScore * 100)}%。`,
    strengths,
    issues: issues.slice(0, 3),
    improvedAnswer: "下一遍按 ETS 新口语的复述目标练：先保留原句含义和关键词，再追求自然节奏。听完后用 2-3 个意群复述，避免主动换词。",
    metrics: [
      { label: "听辨处理", value: `${Math.round(processingScore * 100)}%` },
      { label: "完整复述", value: `${Math.round(completenessScore * 100)}%` },
      { label: "语序稳定", value: `${Math.round(sequenceScore * 100)}%` },
      { label: "发音可识别", value: `${Math.round(pronunciationScore * 100)}%` },
      { label: "清晰节奏", value: `${Math.round(deliveryScore * 100)}%` },
      { label: "漏/换/多", value: `${stats.missing}/${stats.substitutions}/${stats.extras}` }
    ],
    detailScores: [
      { label: "听辨处理", score: processingScore, detail: "原句词、内容词和复述文本的匹配程度。" },
      { label: "完整复述", score: completenessScore, detail: "漏词比例、句子长度和整体覆盖度。" },
      { label: "语序稳定", score: sequenceScore, detail: "替换、多说和漏说对原句结构的影响。" },
      { label: "发音可识别", score: pronunciationScore, detail: "ASR 识别稳定性、内容词匹配和录音质量的综合代理分。" },
      { label: "清晰节奏", score: deliveryScore, detail: "回答时长、停顿比例和自然复述节奏。" }
    ],
    rubricProfile: [
      { label: "复述准确", weight: 0.54, note: "听到的词和核心信息能否被准确保留下来。" },
      { label: "完整与顺序", weight: 0.22, note: "是否漏掉关键片段，句子骨架是否接近原句。" },
      { label: "清晰可懂", weight: 0.14, note: "语音识别稳定性、音频质量和内容词清晰度。" },
      { label: "自然节奏", weight: 0.1, note: "是否按意群自然复述，而不是拖长或抢跑。" }
    ],
    pronunciation: buildPronunciationReport({
      pronunciationScore,
      recognitionConfidenceScore,
      audioQualityScore,
      pauseScore,
      audioStats: context.audioStats,
      recognitionStats: context.recognitionStats,
      phonemeFocus: inferPronunciationFocus({ alignment, refWords, hypWords, transcript }),
      wordCount: hypWords.length,
      duration
    }),
    alignment
  };
}

function createInterviewFeedback(question, transcript, duration, context = {}) {
  const words = normalizeWords(transcript);
  const wordCount = words.length;
  const uniqueRatio = wordCount ? new Set(words).size / wordCount : 0;
  const wpm = duration ? Math.round(wordCount / (duration / 60)) : 0;
  const lower = ` ${transcript.toLowerCase()} `;
  const reasonMarkers = [" because ", " since ", " the reason ", " one reason ", " this is because ", " so "];
  const exampleMarkers = [" for example ", " for instance ", " such as ", " last semester ", " once ", " when i ", " in my class ", " in one course "];
  const structureMarkers = [" first ", " also ", " however ", " in addition ", " on the other hand ", " overall ", " in the end ", " that is why "];
  const resultMarkers = [" as a result ", " this helps ", " this made ", " therefore ", " so that ", " because of this "];
  const directMarkers = [" i think ", " i believe ", " in my opinion ", " i prefer ", " i would ", " yes ", " no ", " one ", " my "];
  const fillerMatches = lower.match(/\b(um|uh|er|like|you know|sort of|kind of)\b/g) || [];
  const repeatedWordPenalty = getRepeatedWordPenalty(words);
  const hasReason = hasAnyMarker(lower, reasonMarkers);
  const hasExample = hasAnyMarker(lower, exampleMarkers);
  const hasStructure = hasAnyMarker(lower, structureMarkers);
  const hasResult = hasAnyMarker(lower, resultMarkers);
  const hasDirectAnswer = hasAnyMarker(lower.slice(0, 120), directMarkers) || /^[\s"']*(yes|no)\b/i.test(transcript);
  const promptKeywords = getContentWords(normalizeWords(question.text));
  const promptOverlap = promptKeywords.length ? countOverlap(promptKeywords, new Set(words)) / promptKeywords.length : 0.45;
  const relevanceScore = clamp01(promptOverlap * 1.6 + (wordCount >= 28 ? 0.25 : 0));
  const lengthScore = getInterviewLengthScore(wordCount);
  const demandScore = getPromptDemandScore(question.text, { hasReason, hasExample, hasDirectAnswer, lower });
  const taskScore = clamp01(lengthScore * 0.32 + relevanceScore * 0.22 + demandScore * 0.26 + (hasDirectAnswer ? 0.2 : 0));
  const developmentScore = clamp01(
    (hasReason ? 0.28 : 0) +
    (hasExample ? 0.34 : 0) +
    (hasResult ? 0.18 : 0) +
    getSpecificDetailScore(transcript, words) * 0.2
  );
  const organizationScore = clamp01(
    (hasDirectAnswer ? 0.25 : 0) +
    Math.min(0.35, countMarkers(lower, structureMarkers) * 0.12 + countMarkers(lower, reasonMarkers) * 0.08) +
    (hasExample ? 0.18 : 0) +
    (hasResult ? 0.12 : 0) +
    getAnswerShapeScore(words, lower) * 0.1
  );
  const lexicalScore = clamp01((uniqueRatio * 1.45 + getContentDensity(words) * 0.55) / 1.35);
  const sentenceComplexityScore = clamp01(countMarkers(lower, [" because ", " when ", " if ", " although ", " while ", " which ", " that "]) / 3);
  const languageScore = clamp01(lexicalScore * 0.55 + sentenceComplexityScore * 0.2 + lengthScore * 0.2 - repeatedWordPenalty);
  const paceScore = wpm ? clamp01(1 - Math.abs(wpm - 125) / 85) : 0.56;
  const fillerPenalty = Math.min(0.25, fillerMatches.length * 0.05);
  const durationFit = duration ? getDurationFit(duration, 35, 75) : 0.58;
  const audioQualityScore = getAudioQualityScore(context.audioStats);
  const pauseScore = getPauseScore(context.audioStats, duration);
  const recognitionConfidenceScore = getRecognitionConfidenceScore(context.recognitionStats);
  const pronunciationScore = getPronunciationProxy({
    exactRecall: relevanceScore,
    precision: lexicalScore,
    contentRecall: developmentScore,
    deliveryScore: paceScore,
    audioQualityScore,
    recognitionConfidenceScore,
    fillerPenalty
  });
  const deliveryScore = clamp01(paceScore * 0.34 + durationFit * 0.18 + pauseScore * 0.2 + pronunciationScore * 0.18 + audioQualityScore * 0.1 - fillerPenalty);
  const composite = clamp01(
    taskScore * 0.27 +
    developmentScore * 0.27 +
    organizationScore * 0.2 +
    languageScore * 0.16 +
    deliveryScore * 0.1
  );
  const score = applyInterviewCaps(roundHalf(clamp(1, 6, 1 + composite * 5)), {
    wordCount,
    hasDirectAnswer,
    hasReason,
    hasExample,
    taskScore,
    developmentScore,
    deliveryScore,
    wpm
  });
  const strengths = [];
  const issues = [];

  if (taskScore >= 0.72) strengths.push("回答能回应题目要求，开头观点比较明确。");
  if (developmentScore >= 0.72) strengths.push("有理由和具体例子，内容展开比单句结论更充分。");
  if (organizationScore >= 0.7) strengths.push("答案有一定组织，听者能跟上观点推进。");
  if (languageScore >= 0.68) strengths.push("词汇和句式有一定变化，表达不只是重复简单词。");
  if (pronunciationScore >= 0.72) strengths.push("发音可识别度较好，关键词更容易被稳定听清。");
  if (deliveryScore >= 0.72) strengths.push("语速和停顿大致自然，适合口语面试回答。");

  if (wordCount < 35) issues.push("回答偏短，建议扩展到 45-75 词，至少包含一个理由和一个例子。");
  if (!hasDirectAnswer) issues.push("开头没有直接回应题目，建议第一句就给出选择、观点或对象。");
  if (!hasReason) issues.push("缺少明确理由，可以加入 because 或 the main reason is。");
  if (!hasExample) issues.push("缺少个人经历或课堂例子，建议用 for example 或 once 展开。");
  if (!hasResult) issues.push("例子后缺少结果或意义，可以补一句 this helped me 或 as a result。");
  if (organizationScore < 0.52) issues.push("组织感偏弱，建议使用“观点-理由-例子-结果”的顺序。");
  if (wpm && wpm < 85) issues.push("语速偏慢，下一遍先准备关键词，再连续说完整句。");
  if (wpm > 170) issues.push("语速偏快，容易牺牲清晰度，建议每个意群后自然停顿。");
  if (fillerMatches.length >= 3) issues.push("填充词较多，可以用短暂停顿代替 um、uh、like。");
  if (pronunciationScore < 0.55) issues.push("发音可识别度偏低，建议放慢内容词并加强词尾音。");
  if (audioQualityScore < 0.55) issues.push("录音质量会影响口语判断，建议减少背景噪音并保持稳定音量。");
  if (repeatedWordPenalty > 0.08) issues.push("重复词偏多，试着替换一两个高频动词或形容词。");

  if (!strengths.length) strengths.push("你已经给出可分析的回答，下一遍先补足观点、理由和例子。");
  if (!issues.length) issues.push("下一遍可以压缩开头，把更多时间留给具体例子和结果。");

  return {
    type: "interview",
    score,
    summary: `专业模拟评分：${getBandLabel(score)}。回答约 ${wordCount} 词，语速约 ${wpm || "-"} WPM。`,
    strengths: strengths.slice(0, 3),
    issues: issues.slice(0, 3),
    improvedAnswer: question.sample,
    metrics: [
      { label: "任务回应", value: `${Math.round(taskScore * 100)}%` },
      { label: "观点展开", value: `${Math.round(developmentScore * 100)}%` },
      { label: "组织逻辑", value: `${Math.round(organizationScore * 100)}%` },
      { label: "语言使用", value: `${Math.round(languageScore * 100)}%` },
      { label: "发音可识别", value: `${Math.round(pronunciationScore * 100)}%` },
      { label: "表达流利", value: `${Math.round(deliveryScore * 100)}%` }
    ],
    detailScores: [
      { label: "任务回应", score: taskScore, detail: "是否直接回应题目，并围绕题目关键词展开。" },
      { label: "观点展开", score: developmentScore, detail: "是否给出理由、例子、结果或意义说明。" },
      { label: "组织逻辑", score: organizationScore, detail: "是否形成清楚的观点、理由、例子、结果顺序。" },
      { label: "语言使用", score: languageScore, detail: "词汇多样性、内容词密度和复合句使用情况。" },
      { label: "发音可识别", score: pronunciationScore, detail: "识别置信度、音频质量和关键词清晰度的综合代理分。" },
      { label: "表达流利", score: deliveryScore, detail: "语速、时长、停顿、填充词和音频稳定性。" }
    ],
    rubricProfile: [
      { label: "任务与展开", weight: 0.54, note: "是否直接回应题目，并用理由和例子充分展开。" },
      { label: "组织逻辑", weight: 0.2, note: "观点、理由、例子、结果是否形成清晰顺序。" },
      { label: "语言使用", weight: 0.16, note: "词汇、句式、语法和表达自然度。" },
      { label: "清晰流利", weight: 0.1, note: "发音可识别、语速、停顿和音频稳定性。" }
    ],
    pronunciation: buildPronunciationReport({
      pronunciationScore,
      recognitionConfidenceScore,
      audioQualityScore,
      pauseScore,
      audioStats: context.audioStats,
      recognitionStats: context.recognitionStats,
      phonemeFocus: inferPronunciationFocus({ alignment: [], refWords: promptKeywords, hypWords: words, transcript }),
      wordCount,
      duration
    })
  };
}

function getBandLabel(score) {
  if (score >= 5.5) return "高级水平";
  if (score >= 4.5) return "良好水平";
  if (score >= 3.5) return "中等水平";
  if (score >= 2.5) return "基础水平";
  return "需要大量练习";
}

async function enhanceFeedbackWithExternalScorers(feedback, question, transcript, duration, context, audioBlob = state.audioBlob) {
  const setup = state.setup || getDefaultSetupConfig();
  const errors = [];

  if (setup.ai.enabled) {
    state.status = "正在调用 AI 内容评分";
    render();
    try {
      const aiResult = await callAiScorer(setup.ai, question, transcript, duration, feedback);
      mergeAiFeedback(feedback, aiResult);
    } catch (error) {
      errors.push(`AI评分失败：${error.message}`);
    }
  }

  if (setup.pronunciation.enabled) {
    state.status = "正在调用外部发音评分";
    render();
    try {
      const pronunciationResult = await callPronunciationScorer(setup.pronunciation, question, transcript, duration, context, audioBlob);
      mergeExternalPronunciation(feedback, pronunciationResult, question.type);
    } catch (error) {
      errors.push(`发音评分失败：${error.message}`);
    }
  }

  if (errors.length) {
    feedback.externalErrors = errors;
    feedback.issues = [...feedback.issues, ...errors].slice(0, 4);
  }
}

async function callAiScorer(config, question, transcript, duration, feedback) {
  if (!config.endpoint || !config.apiKey || !config.model) {
    throw new Error("请在 Setup 里填写 AI endpoint、API key 和 model。");
  }

  const systemPrompt = [
    "You are a TOEFL iBT 2026 speaking evaluator.",
    "Score on a 1-6 half-point scale.",
    "Return only valid JSON with keys: score, summary, strengths, issues, improvedAnswer, grammarNotes, dimensionScores.",
    "dimensionScores should contain percentages from 0 to 100."
  ].join(" ");
  const userPrompt = JSON.stringify({
    taskType: question.type,
    prompt: question.text,
    transcript,
    durationSeconds: duration,
    localScore: feedback.score,
    localSummary: feedback.summary,
    expectedRubric: question.type === "repeat"
      ? ["accuracy of repetition", "completeness", "word order", "clear intelligibility", "natural pace"]
      : ["task response", "development", "organization", "language use", "clear intelligibility", "fluency"]
  }, null, 2);

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
  const text = extractAiText(data);
  return parseJsonLike(text);
}

function extractAiText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content || "";
  if (data.output && data.output[0] && data.output[0].content) {
    const content = data.output.flatMap((item) => item.content || []);
    const textItem = content.find((item) => item.text || item.type === "output_text");
    return textItem ? (textItem.text || "") : "";
  }
  return JSON.stringify(data);
}

function parseJsonLike(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI 返回的不是可解析 JSON。");
  }
}

function mergeAiFeedback(feedback, aiResult) {
  const aiScore = clamp(1, 6, Number(aiResult.score));
  feedback.externalAi = {
    score: Number.isFinite(aiScore) ? roundHalf(aiScore) : null,
    summary: cleanupSpacing(aiResult.summary || ""),
    strengths: Array.isArray(aiResult.strengths) ? aiResult.strengths.slice(0, 4) : [],
    issues: Array.isArray(aiResult.issues) ? aiResult.issues.slice(0, 4) : [],
    grammarNotes: Array.isArray(aiResult.grammarNotes) ? aiResult.grammarNotes.slice(0, 6) : [],
    dimensionScores: aiResult.dimensionScores || {}
  };

  if (feedback.externalAi.score) {
    feedback.localScore = feedback.localScore || feedback.score;
    feedback.score = roundHalf(feedback.localScore * 0.65 + feedback.externalAi.score * 0.35);
    feedback.metrics.push({ label: "AI评分", value: `${feedback.externalAi.score}/6` });
    feedback.summary = `${feedback.summary} AI增强后总分 ${feedback.score}/6。`;
  }
  if (cleanupSpacing(aiResult.improvedAnswer || "")) feedback.improvedAnswer = aiResult.improvedAnswer;
}

async function callPronunciationScorer(config, question, transcript, duration, context, audioBlob) {
  if (!config.apiKey) throw new Error("请在 Setup 里填写发音评分 API key。");
  if (!audioBlob) throw new Error("没有可发送的录音，请先录音再分析。");

  if (config.provider === "custom") {
    if (!config.endpoint) throw new Error("Custom provider 需要 endpoint URL。");
    return callCustomPronunciationEndpoint(config, question, transcript, duration, context, audioBlob);
  }

  const region = config.azureRegion;
  const endpoint = config.endpoint || (region
    ? `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`
    : "");
  if (!endpoint) throw new Error("Azure provider 需要 region 或 endpoint override。");

  const wavBlob = await convertBlobToWav16k(audioBlob);
  const referenceText = question.type === "repeat" ? question.text : transcript;
  const assessment = {
    ReferenceText: referenceText.slice(0, 5000),
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.apiKey,
      "Pronunciation-Assessment": base64EncodeUnicode(JSON.stringify(assessment)),
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json"
    },
    body: wavBlob
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text.slice(0, 160)}`);
  }
  const data = await response.json();
  return normalizeAzurePronunciation(data);
}

async function callCustomPronunciationEndpoint(config, question, transcript, duration, context, audioBlob) {
  const audioBase64 = await blobToBase64(audioBlob);
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      taskType: question.type,
      prompt: question.text,
      referenceText: question.type === "repeat" ? question.text : transcript,
      transcript,
      duration,
      audio: audioBase64,
      audioStats: context.audioStats
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text.slice(0, 160)}`);
  }
  return normalizeCustomPronunciation(await response.json());
}

function normalizeAzurePronunciation(data) {
  const best = data.NBest && data.NBest[0] ? data.NBest[0] : {};
  const assessment = best.PronunciationAssessment || data.PronunciationAssessment || {};
  const words = best.Words || data.Words || [];
  const phonemes = [];
  words.forEach((word) => {
    (word.Phonemes || []).forEach((phoneme) => {
      const score = phoneme.PronunciationAssessment && Number(phoneme.PronunciationAssessment.AccuracyScore);
      if (Number.isFinite(score) && score < 75) {
        phonemes.push({
          sound: phoneme.Phoneme || "",
          word: word.Word || "",
          score,
          errorType: phoneme.PronunciationAssessment.ErrorType || ""
        });
      }
    });
  });
  return {
    provider: "Azure Speech",
    raw: data,
    score: normalizeHundredScore(assessment.PronScore),
    accuracy: normalizeHundredScore(assessment.AccuracyScore),
    fluency: normalizeHundredScore(assessment.FluencyScore),
    completeness: normalizeHundredScore(assessment.CompletenessScore),
    prosody: normalizeHundredScore(assessment.ProsodyScore),
    words: words.slice(0, 80).map((word) => ({
      word: word.Word,
      score: word.PronunciationAssessment ? word.PronunciationAssessment.AccuracyScore : null,
      errorType: word.PronunciationAssessment ? word.PronunciationAssessment.ErrorType : ""
    })),
    phonemes: phonemes.slice(0, 12)
  };
}

function normalizeCustomPronunciation(data) {
  return {
    provider: data.provider || "Custom",
    raw: data,
    score: normalizeHundredScore(data.score || data.pronunciationScore),
    accuracy: normalizeHundredScore(data.accuracy),
    fluency: normalizeHundredScore(data.fluency),
    completeness: normalizeHundredScore(data.completeness),
    prosody: normalizeHundredScore(data.prosody),
    words: Array.isArray(data.words) ? data.words.slice(0, 80) : [],
    phonemes: Array.isArray(data.phonemes) ? data.phonemes.slice(0, 12) : []
  };
}

function normalizeHundredScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number > 1 ? clamp01(number / 100) : clamp01(number);
}

function mergeExternalPronunciation(feedback, pronunciationResult, taskType) {
  if (!pronunciationResult) return;
  feedback.externalPronunciation = pronunciationResult;
  if (feedback.pronunciation) {
    feedback.pronunciation.external = pronunciationResult;
    if (Number.isFinite(pronunciationResult.score)) {
      feedback.pronunciation.score = clamp01(feedback.pronunciation.score * 0.5 + pronunciationResult.score * 0.5);
      feedback.metrics.push({ label: "外部发音", value: `${Math.round(pronunciationResult.score * 100)}%` });
    }
    if (pronunciationResult.phonemes && pronunciationResult.phonemes.length) {
      const externalFocus = pronunciationResult.phonemes.map((item) => ({
        sound: item.sound || item.phoneme || "",
        label: `${item.word || ""} ${Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) : ""}`.trim(),
        tip: item.errorType ? `外部评测标记：${item.errorType}` : "外部评测认为这个音素需要重点练习。",
        words: [item.word || ""].filter(Boolean)
      }));
      feedback.pronunciation.phonemeFocus = [...externalFocus, ...(feedback.pronunciation.phonemeFocus || [])].slice(0, 8);
    }
  }

  if (Number.isFinite(pronunciationResult.score)) {
    feedback.localScore = feedback.localScore || feedback.score;
    const externalScore = 1 + pronunciationResult.score * 5;
    const weight = taskType === "repeat" ? 0.15 : 0.1;
    feedback.score = roundHalf(feedback.score * (1 - weight) + externalScore * weight);
  }
}

function getScoringContext() {
  return {
    audioStats: state.audioStats,
    recognitionStats: {
      confidenceSamples: [...state.recognitionStats.confidenceSamples],
      finalSegments: state.recognitionStats.finalSegments,
      interimSegments: state.recognitionStats.interimSegments
    }
  };
}

function buildScoringConfidence(question, feedback, transcript, duration, context = {}) {
  const words = normalizeWords(transcript);
  const reasons = [];
  const signals = [];
  let score = 0.74;

  if (words.length < 8) {
    score -= 0.24;
    reasons.push("转写文本太短，系统可判断的信息不足。");
  } else if (words.length < 20 && question.type === "interview") {
    score -= 0.14;
    reasons.push("问答回答偏短，内容完成度判断会更不稳定。");
  } else {
    signals.push(`${words.length} words`);
  }

  if (!duration) {
    score -= 0.1;
    reasons.push("缺少有效录音时长，语速和节奏只能部分估算。");
  } else {
    signals.push(`${formatTime(duration)} audio`);
  }

  const audioStats = context.audioStats || feedback.pronunciation?.audioStats || null;
  if (!audioStats || !audioStats.available) {
    score -= 0.12;
    reasons.push("没有完整音频特征，本地可理解度主要依赖转写文本。");
  } else {
    const audioQuality = getAudioQualityScore(audioStats);
    signals.push(`录音质量 ${Math.round(audioQuality * 100)}%`);
    if (audioQuality < 0.55) {
      score -= 0.18;
      reasons.push("录音质量偏低，可能影响可理解度和节奏判断。");
    }
    if (audioStats.clippingPercent > 0.01) {
      score -= 0.08;
      reasons.push("录音出现削波，音量过大会影响评分稳定性。");
    }
  }

  const confidenceSamples = context.recognitionStats?.confidenceSamples || [];
  if (!confidenceSamples.length) {
    score -= 0.06;
    reasons.push("没有浏览器 ASR 置信样本，发音可理解度是代理判断。");
  } else {
    const recognitionScore = getRecognitionConfidenceScore(context.recognitionStats);
    signals.push(`ASR 置信 ${Math.round(recognitionScore * 100)}%`);
    if (recognitionScore < 0.55) {
      score -= 0.16;
      reasons.push("语音识别置信度偏低，可能存在发音、音量或背景噪音问题。");
    }
  }

  if (feedback.externalAi) {
    score += 0.06;
    signals.push("AI 内容评分已合并");
  }
  if (feedback.externalPronunciation || feedback.pronunciation?.external) {
    score += 0.08;
    signals.push("外部发音评分已合并");
  }

  const safeScore = clamp(0.25, 0.95, score);
  const level = safeScore >= 0.78 ? "high" : safeScore >= 0.56 ? "medium" : "low";
  const label = level === "high" ? "高" : level === "medium" ? "中" : "低";
  if (!reasons.length) reasons.push("转写、录音质量和回答长度都足够支撑本次训练反馈。");

  return {
    score: safeScore,
    level,
    label,
    signals: signals.slice(0, 5),
    reasons: reasons.slice(0, 4),
    note: "这是训练用模拟评分可信度，不代表 ETS 官方评分置信度。"
  };
}

async function analyzeAudioBlob(blob, fallbackDuration) {
  const AudioContextApi = window.AudioContext || window.webkitAudioContext;
  if (!blob || !AudioContextApi) return createAudioStatsFallback(fallbackDuration, "Web Audio is not available.");

  let audioContext;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    audioContext = new AudioContextApi();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const sampleRate = audioBuffer.sampleRate;
    const sampleCount = audioBuffer.length;
    const duration = audioBuffer.duration || fallbackDuration || 0;
    const frameSize = Math.max(256, Math.floor(sampleRate * 0.02));
    const frames = [];
    let sumSquares = 0;
    let peak = 0;
    let clipping = 0;

    for (let start = 0; start < sampleCount; start += frameSize) {
      let frameSquares = 0;
      let frameSamples = 0;
      for (let offset = 0; offset < frameSize && start + offset < sampleCount; offset += 1) {
        let mixed = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
          mixed += audioBuffer.getChannelData(channel)[start + offset] || 0;
        }
        const sample = mixed / Math.max(1, audioBuffer.numberOfChannels);
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
        if (abs > 0.985) clipping += 1;
        frameSquares += sample * sample;
        sumSquares += sample * sample;
        frameSamples += 1;
      }
      frames.push(Math.sqrt(frameSquares / Math.max(1, frameSamples)));
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
    const noiseFloor = percentile(frames, 0.18);
    const speechFloor = percentile(frames, 0.75);
    const silenceThreshold = clamp(0.006, 0.05, Math.max(noiseFloor * 2.35, rms * 0.3));
    const frameDuration = frameSize / sampleRate;
    let silenceFrames = 0;
    let currentSilence = 0;
    let longestSilence = 0;
    let pauseCount = 0;
    let speechSquares = 0;
    let speechFrameCount = 0;
    let noiseSquares = 0;
    let noiseFrameCount = 0;

    frames.forEach((frameRms) => {
      if (frameRms <= silenceThreshold) {
        silenceFrames += 1;
        currentSilence += frameDuration;
        noiseSquares += frameRms * frameRms;
        noiseFrameCount += 1;
      } else {
        if (currentSilence >= 0.28) pauseCount += 1;
        if (currentSilence > longestSilence) longestSilence = currentSilence;
        currentSilence = 0;
        speechSquares += frameRms * frameRms;
        speechFrameCount += 1;
      }
    });
    if (currentSilence >= 0.28) pauseCount += 1;
    if (currentSilence > longestSilence) longestSilence = currentSilence;

    const silenceSeconds = silenceFrames * frameDuration;
    const speechSeconds = Math.max(0, duration - silenceSeconds);
    const silenceRatio = duration ? clamp01(silenceSeconds / duration) : 0;
    const speechRms = Math.sqrt(speechSquares / Math.max(1, speechFrameCount));
    const noiseRms = Math.sqrt(noiseSquares / Math.max(1, noiseFrameCount));
    const snrDb = 20 * Math.log10((speechRms + 0.00001) / (noiseRms + 0.00001));

    return {
      available: true,
      duration,
      rms,
      peak,
      clippingPercent: clipping / Math.max(1, sampleCount),
      silenceRatio,
      longestSilence,
      pauseCount,
      speechSeconds,
      snrDb,
      noiseFloor,
      speechFloor
    };
  } catch (error) {
    return createAudioStatsFallback(fallbackDuration, error.message || "Audio analysis failed.");
  } finally {
    if (audioContext && audioContext.close) {
      try {
        await audioContext.close();
      } catch (error) {
        // Some browsers keep the context open for a short time after decoding.
      }
    }
  }
}

function createAudioStatsFallback(duration, reason) {
  return {
    available: false,
    duration: duration || 0,
    rms: 0,
    peak: 0,
    clippingPercent: 0,
    silenceRatio: 0,
    longestSilence: 0,
    pauseCount: 0,
    speechSeconds: duration || 0,
    snrDb: 0,
    reason
  };
}

async function convertBlobToWav16k(blob) {
  const AudioContextApi = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextApi) throw new Error("当前浏览器不支持 Web Audio，无法转换 WAV。");
  let audioContext;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    audioContext = new AudioContextApi();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixToMono(audioBuffer);
    const resampled = resampleLinear(mono, audioBuffer.sampleRate, 16000);
    const wavBuffer = encodeWav16Bit(resampled, 16000);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    if (audioContext && audioContext.close) {
      try {
        await audioContext.close();
      } catch (error) {
        // Closing can fail briefly while the browser releases the decoder.
      }
    }
  }
}

function mixToMono(audioBuffer) {
  const output = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      output[index] += data[index] / audioBuffer.numberOfChannels;
    }
  }
  return output;
}

function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(newLength);
  for (let index = 0; index < newLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, samples.length - 1);
    const fraction = sourceIndex - left;
    output[index] = samples[left] * (1 - fraction) + samples[right] * fraction;
  }
  return output;
}

function encodeWav16Bit(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const value = clamp(-1, 1, samples[index]);
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Blob 转 base64 失败。"));
    reader.readAsDataURL(blob);
  });
}

function base64EncodeUnicode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function getAudioQualityScore(audioStats) {
  if (!audioStats || !audioStats.available) return 0.68;
  const volumeScore = audioStats.rms < 0.012
    ? clamp01(audioStats.rms / 0.012)
    : audioStats.rms > 0.18
      ? clamp01(1 - (audioStats.rms - 0.18) / 0.2)
      : 1;
  const peakScore = audioStats.peak > 0.99 ? 0.55 : audioStats.peak > 0.92 ? 0.78 : 1;
  const clippingScore = clamp01(1 - audioStats.clippingPercent * 18);
  const snrScore = clamp01((audioStats.snrDb - 8) / 18);
  const silenceBalance = clamp01(1 - Math.abs(audioStats.silenceRatio - 0.22) / 0.55);
  return clamp01(volumeScore * 0.28 + peakScore * 0.12 + clippingScore * 0.18 + snrScore * 0.3 + silenceBalance * 0.12);
}

function getPauseScore(audioStats, duration) {
  if (!audioStats || !audioStats.available || !duration) return 0.66;
  const silenceScore = audioStats.silenceRatio <= 0.38 ? 1 : clamp01(1 - (audioStats.silenceRatio - 0.38) / 0.35);
  const longPauseScore = audioStats.longestSilence <= 1.15 ? 1 : clamp01(1 - (audioStats.longestSilence - 1.15) / 2.2);
  const pauseRate = audioStats.pauseCount / Math.max(duration / 60, 0.2);
  const pauseRateScore = pauseRate <= 11 ? 1 : clamp01(1 - (pauseRate - 11) / 18);
  return clamp01(silenceScore * 0.42 + longPauseScore * 0.34 + pauseRateScore * 0.24);
}

function getRecognitionConfidenceScore(recognitionStats) {
  const samples = recognitionStats && recognitionStats.confidenceSamples ? recognitionStats.confidenceSamples : [];
  if (!samples.length) return 0.68;
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return clamp01((average - 0.35) / 0.55);
}

function getPronunciationProxy(parts) {
  return clamp01(
    parts.exactRecall * 0.22 +
    parts.precision * 0.2 +
    parts.contentRecall * 0.15 +
    parts.recognitionConfidenceScore * 0.18 +
    parts.audioQualityScore * 0.14 +
    parts.deliveryScore * 0.11 -
    parts.fillerPenalty
  );
}

function buildPronunciationReport(data) {
  const audioStats = data.audioStats || createAudioStatsFallback(data.duration, "No audio stats.");
  const articulationRate = audioStats.available && audioStats.speechSeconds
    ? Math.round(data.wordCount / Math.max(audioStats.speechSeconds / 60, 0.1))
    : 0;
  const notes = [];

  if (!audioStats.available) notes.push("当前报告未拿到完整音频特征，本地可理解度主要依赖转写文本和语速。");
  if (data.recognitionConfidenceScore < 0.58) notes.push("语音识别置信度偏低，可能存在发音不清、音量不足或背景噪音。");
  if (data.audioQualityScore < 0.58) notes.push("录音质量偏低，会影响发音判断，建议使用安静环境和稳定麦克风距离。");
  if (data.pauseScore < 0.58) notes.push("停顿偏多或长停顿明显，建议按意群连续说完。");
  if (audioStats.available && audioStats.clippingPercent > 0.01) notes.push("录音出现削波，音量可能过大，建议降低输入音量。");
  if (audioStats.available && audioStats.rms < 0.012) notes.push("整体音量偏低，建议靠近麦克风或提高输入音量。");
  if (!notes.length) notes.push("本地发音诊断未发现明显录音或可识别度问题。");

  return {
    mode: "Local intelligibility proxy",
    score: data.pronunciationScore,
    confidence: data.recognitionConfidenceScore,
    audioQuality: data.audioQualityScore,
    pauseControl: data.pauseScore,
    articulationRate,
    audioStats,
    notes,
    phonemeFocus: data.phonemeFocus || []
  };
}

function inferPronunciationFocus({ alignment = [], refWords = [], hypWords = [], transcript = "" }) {
  const candidates = [];
  const mismatchWords = alignment.length
    ? alignment
        .filter((item) => item.type === "missing" || item.type === "substitute")
        .flatMap((item) => [item.ref, item.hyp])
        .filter(Boolean)
    : [];
  const sourceWords = [...mismatchWords, ...getContentWords(refWords), ...getContentWords(hypWords), ...normalizeWords(transcript)];
  const uniqueWords = [...new Set(sourceWords)].filter((word) => word.length > 2);
  const rules = [
    { key: "th-voiceless", sound: "/θ/", label: "think / three / method", pattern: /(^th|th$|th)/, tip: "舌尖轻触上齿背，气流出去，不要说成 /s/ 或 /t/。" },
    { key: "th-voiced", sound: "/ð/", label: "this / those / rather", pattern: /(the|this|that|these|those|there|rather|another)/, tip: "保持舌尖轻触上齿背并带声带振动，不要说成 /d/。" },
    { key: "r-l", sound: "/r/ vs /l/", label: "right / library / clearly", pattern: /[rl]/, tip: "/r/ 舌尖不要碰上齿龈，/l/ 舌尖需要轻触上齿龈。" },
    { key: "v-w", sound: "/v/ vs /w/", label: "very / review / available", pattern: /v|w/, tip: "/v/ 用上齿轻触下唇，/w/ 是圆唇滑音，不要混在一起。" },
    { key: "final-consonant", sound: "final consonants", label: "asked / helps / project", pattern: /(ed|s|t|d|k|p|g|m|n)$/, tip: "词尾音要短而清楚，尤其是 -s、-ed、/t/、/d/。" },
    { key: "consonant-cluster", sound: "clusters", label: "students / strengths / projects", pattern: /(str|spr|skr|sts|nts|cts|ghts|rts|lds|lps|mps)/, tip: "辅音连缀不要吞音，可以先慢速拆开再连起来。" },
    { key: "long-vowel", sound: "long vowels", label: "leave / reach / improve", pattern: /(ee|ea|oo|ou|oa|ai)/, tip: "长元音需要拉开一点，但不要把一个词拖得过长。" }
  ];

  rules.forEach((rule) => {
    const words = uniqueWords.filter((word) => rule.pattern.test(word)).slice(0, 5);
    if (words.length) {
      candidates.push({
        sound: rule.sound,
        label: rule.label,
        tip: rule.tip,
        words
      });
    }
  });

  return candidates.slice(0, 4);
}

function applyRepeatCaps(score, data) {
  let capped = score;
  if (data.hypWords.length < Math.ceil(data.refWords.length * 0.45)) capped = Math.min(capped, 2.5);
  if (data.exactRecall < 0.5) capped = Math.min(capped, 3);
  if (data.exactRecall < 0.68 || data.precision < 0.62) capped = Math.min(capped, 4);
  if (data.stats.missing >= 3 || data.stats.substitutions >= 3) capped = Math.min(capped, 4.5);
  if (data.stats.extras >= 5) capped = Math.min(capped, 4.5);
  if (data.exactRecall >= 0.94 && data.precision >= 0.94 && data.deliveryScore >= 0.7) capped = Math.max(capped, 5.5);
  return roundHalf(clamp(1, 6, capped));
}

function applyInterviewCaps(score, data) {
  let capped = score;
  if (data.wordCount < 12) capped = Math.min(capped, 2);
  if (data.wordCount < 25) capped = Math.min(capped, 3);
  if (data.wordCount < 38) capped = Math.min(capped, 4);
  if (!data.hasDirectAnswer) capped = Math.min(capped, 4.5);
  if (!data.hasReason && !data.hasExample) capped = Math.min(capped, 4);
  if (!data.hasExample && data.developmentScore < 0.55) capped = Math.min(capped, 4.5);
  if ((data.wpm && (data.wpm < 70 || data.wpm > 185)) || data.deliveryScore < 0.42) capped = Math.min(capped, 5);
  if (data.wordCount >= 50 && data.hasDirectAnswer && data.hasReason && data.hasExample && data.taskScore >= 0.72 && data.developmentScore >= 0.72) {
    capped = Math.max(capped, 4.5);
  }
  return roundHalf(clamp(1, 6, capped));
}

function findPreviousAttempt(questionId, transcript) {
  const currentFingerprint = fingerprintText(transcript);
  return loadHistory().find((item) => item.questionId === questionId && fingerprintText(item.transcript) !== currentFingerprint) || null;
}

function buildAttemptComparison(feedback, previousAttempt) {
  if (!previousAttempt) return null;
  const previousScore = Number(previousAttempt.score) || 0;
  const delta = roundHalf(feedback.score - previousScore);
  const currentDetails = indexDetailScores(feedback.detailScores || []);
  const previousDetails = indexDetailScores(previousAttempt.detailScores || []);
  const notes = [];

  Object.keys(currentDetails).forEach((label) => {
    if (!Number.isFinite(previousDetails[label])) return;
    const diff = Math.round((currentDetails[label] - previousDetails[label]) * 100);
    if (Math.abs(diff) >= 6) {
      notes.push(`${label}${diff > 0 ? "提升" : "下降"} ${Math.abs(diff)}%。`);
    }
  });

  const currentPron = feedback.pronunciation ? feedback.pronunciation.score : null;
  const previousPron = previousAttempt.pronunciation ? previousAttempt.pronunciation.score : null;
  if (Number.isFinite(currentPron) && Number.isFinite(previousPron)) {
    const pronDiff = Math.round((currentPron - previousPron) * 100);
    if (Math.abs(pronDiff) >= 6) notes.push(`发音可识别度${pronDiff > 0 ? "提升" : "下降"} ${Math.abs(pronDiff)}%。`);
  }

  if (!notes.length) notes.push("这次表现与上次接近，下一遍建议只盯一个最弱维度重练。");

  return {
    previousScore,
    delta,
    summary: delta > 0
      ? `比上次同题提高 ${delta} 分，复练有效。`
      : delta < 0
        ? `比上次同题低 ${Math.abs(delta)} 分，建议回看弱项后再录一次。`
        : "与上次同题分数持平，可以继续打磨细节。",
    notes: notes.slice(0, 4)
  };
}

function indexDetailScores(detailScores) {
  return detailScores.reduce((acc, item) => {
    acc[item.label] = Number(item.score);
    return acc;
  }, {});
}

function fingerprintText(text) {
  return normalizeWords(text).join(" ");
}

function getContentRecall(alignment, refWords) {
  const contentRef = getContentWords(refWords);
  if (!contentRef.length) return 1;
  const matchedContent = new Set(
    alignment
      .filter((item) => item.type === "match" && isContentWord(item.ref))
      .map((item) => item.ref)
  );
  return clamp01(matchedContent.size / new Set(contentRef).size);
}

function getContentWords(words) {
  return words.filter(isContentWord);
}

function isContentWord(word) {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at", "for", "from", "with", "by", "as",
    "is", "are", "was", "were", "be", "been", "being", "it", "this", "that", "these", "those", "i", "you",
    "we", "they", "he", "she", "my", "your", "our", "their", "his", "her", "do", "does", "did", "will",
    "would", "should", "can", "could", "may", "might", "have", "has", "had"
  ]);
  return word.length > 2 && !stopWords.has(word);
}

function hasAnyMarker(lowerText, markers) {
  return markers.some((marker) => lowerText.includes(marker));
}

function countMarkers(lowerText, markers) {
  return markers.reduce((sum, marker) => sum + (lowerText.includes(marker) ? 1 : 0), 0);
}

function countOverlap(words, wordSet) {
  return new Set(words).size ? [...new Set(words)].filter((word) => wordSet.has(word)).length : 0;
}

function getPromptDemandScore(prompt, signals) {
  const lowerPrompt = prompt.toLowerCase();
  const asksWhy = /\bwhy\b/.test(lowerPrompt);
  const asksPreference = /\bprefer|rather|better|should|would\b/.test(lowerPrompt);
  const asksDescribe = /\bdescribe|what|which|how\b/.test(lowerPrompt);
  let score = 0.45;
  if (!asksWhy && !asksPreference && !asksDescribe) score += 0.2;
  if (asksWhy && signals.hasReason) score += 0.28;
  if (asksPreference && signals.hasDirectAnswer) score += 0.22;
  if (asksDescribe && signals.hasExample) score += 0.2;
  if (signals.hasReason && signals.hasExample) score += 0.18;
  if (/\bshould\b/.test(lowerPrompt) && /\b(should|need|important|benefit|problem)\b/.test(signals.lower)) score += 0.12;
  return clamp01(score);
}

function getInterviewLengthScore(wordCount) {
  if (wordCount <= 0) return 0;
  if (wordCount < 25) return clamp01(wordCount / 35);
  if (wordCount <= 85) return clamp01(0.62 + (wordCount - 25) / 100);
  return clamp01(1 - (wordCount - 85) / 90);
}

function getSpecificDetailScore(transcript, words) {
  const lower = transcript.toLowerCase();
  const hasNumber = /\b(one|two|three|first|second|last|semester|week|year|\d+)\b/.test(lower);
  const hasClassContext = /\b(class|course|teacher|professor|project|presentation|library|campus|exam|homework|club)\b/.test(lower);
  const hasPastEvent = /\b(was|were|had|joined|took|made|helped|worked|prepared|studied|finished)\b/.test(lower);
  return clamp01((hasNumber ? 0.28 : 0) + (hasClassContext ? 0.36 : 0) + (hasPastEvent ? 0.26 : 0) + (words.length >= 55 ? 0.1 : 0));
}

function getAnswerShapeScore(words, lowerText) {
  const openingClear = words.slice(0, 12).some((word) => ["think", "prefer", "would", "yes", "no", "one", "my"].includes(word));
  const hasMiddle = hasAnyMarker(lowerText, [" because ", " for example ", " for instance ", " when i ", " once "]);
  const hasEnding = hasAnyMarker(lowerText, [" that is why ", " overall ", " in the end ", " as a result ", " this helps "]);
  return clamp01((openingClear ? 0.36 : 0) + (hasMiddle ? 0.42 : 0) + (hasEnding ? 0.22 : 0));
}

function getContentDensity(words) {
  if (!words.length) return 0;
  return getContentWords(words).length / words.length;
}

function getRepeatedWordPenalty(words) {
  const contentWords = getContentWords(words);
  if (contentWords.length < 12) return 0;
  const counts = contentWords.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
  const repeated = Object.values(counts).filter((count) => count >= 3).reduce((sum, count) => sum + count - 2, 0);
  return Math.min(0.18, repeated / Math.max(contentWords.length, 1));
}

function getFillerPenalty(text) {
  const matches = String(text).toLowerCase().match(/\b(um|uh|er|like|you know|sort of|kind of)\b/g) || [];
  return Math.min(0.22, matches.length * 0.045);
}

function getDurationFit(duration, minGood, maxGood) {
  if (!duration) return 0.58;
  if (duration >= minGood && duration <= maxGood) return 1;
  if (duration < minGood) return clamp01(duration / minGood);
  return clamp01(1 - (duration - maxGood) / maxGood);
}

function alignWords(refWords, hypWords) {
  const rows = refWords.length + 1;
  const cols = hypWords.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  const op = Array.from({ length: rows }, () => Array(cols).fill(""));

  for (let i = 1; i < rows; i += 1) {
    dp[i][0] = i;
    op[i][0] = "del";
  }
  for (let j = 1; j < cols; j += 1) {
    dp[0][j] = j;
    op[0][j] = "ins";
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const same = refWords[i - 1] === hypWords[j - 1];
      const replaceCost = dp[i - 1][j - 1] + (same ? 0 : 1);
      const deleteCost = dp[i - 1][j] + 1;
      const insertCost = dp[i][j - 1] + 1;
      const min = Math.min(replaceCost, deleteCost, insertCost);
      dp[i][j] = min;
      op[i][j] = min === replaceCost ? (same ? "match" : "sub") : min === deleteCost ? "del" : "ins";
    }
  }

  const alignment = [];
  let i = refWords.length;
  let j = hypWords.length;
  while (i > 0 || j > 0) {
    const current = op[i][j];
    if (current === "match") {
      alignment.push({ type: "match", ref: refWords[i - 1], hyp: hypWords[j - 1] });
      i -= 1;
      j -= 1;
    } else if (current === "sub") {
      alignment.push({ type: "substitute", ref: refWords[i - 1], hyp: hypWords[j - 1] });
      i -= 1;
      j -= 1;
    } else if (current === "del") {
      alignment.push({ type: "missing", ref: refWords[i - 1], hyp: "" });
      i -= 1;
    } else {
      alignment.push({ type: "extra", ref: "", hyp: hypWords[j - 1] });
      j -= 1;
    }
  }

  return alignment.reverse();
}

function countAlignment(alignment) {
  return alignment.reduce(
    (acc, item) => {
      if (item.type === "match") acc.matches += 1;
      if (item.type === "substitute") acc.substitutions += 1;
      if (item.type === "missing") acc.missing += 1;
      if (item.type === "extra") acc.extras += 1;
      return acc;
    },
    { matches: 0, substitutions: 0, missing: 0, extras: 0 }
  );
}
