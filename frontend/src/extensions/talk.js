const synth = window.speechSynthesis;
let speechGeneration = 0;
let isSpeechActive = false;

function findContent() {
  for (const selector of ["main", "[role='main']", "article", "#search"]) {
    const content = document.querySelector(selector);
    if (content) return content;
  }
  return document.body;
}

function isRendered(element, content) {
  for (let current = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    if (current === content) break;
  }
  return true;
}

function isInViewport(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return [...range.getClientRects()].some(
    (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < viewportWidth &&
      rect.top < viewportHeight,
  );
}

function extractVisibleText() {
  const content = findContent();
  if (!content) return "";

  const ignoredSelector = [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "nav",
    "aside",
    "[aria-hidden='true']",
    "[hidden]",
    "[inert]",
    "#flykey-extension-root",
  ].join(",");
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const visibleText = [];
  let node;

  while ((node = walker.nextNode())) {
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    const element = node.parentElement;
    if (!text || !element || element.closest(ignoredSelector)) continue;
    if (!isRendered(element, content) || !isInViewport(node)) continue;
    visibleText.push(text);
  }

  return visibleText.join(" ");
}

function extractReadableText() {
  const selectedText = window.getSelection()?.toString().replace(/\s+/g, " ").trim();
  if (selectedText) return selectedText;

  return extractVisibleText();
}

function splitText(text, maximumLength = 1_500) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maximumLength) {
    const candidate = remaining.slice(0, maximumLength);
    const boundary = Math.max(
      candidate.lastIndexOf("。"),
      candidate.lastIndexOf("！"),
      candidate.lastIndexOf("？"),
      candidate.lastIndexOf(". "),
      candidate.lastIndexOf("! "),
      candidate.lastIndexOf("? "),
    );
    const splitAt = boundary > maximumLength / 2 ? boundary + 1 : maximumLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function defaultLanguage() {
  const pageLanguage = document.documentElement?.lang || navigator.language || "";
  return pageLanguage.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

function splitSentences(text) {
  const sentences = [];
  let sentenceStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];
    const isCjkBoundary = /[。！？]/.test(character);
    const isLatinBoundary = /[.!?]/.test(character) && (!nextCharacter || /\s/.test(nextCharacter));
    if (!isCjkBoundary && !isLatinBoundary) continue;

    const sentence = text.slice(sentenceStart, index + 1).trim();
    if (sentence) sentences.push(sentence);
    sentenceStart = index + 1;
  }

  const remainder = text.slice(sentenceStart).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}

function detectLanguage(text) {
  const chineseCharacters = text.match(/\p{Script=Han}/gu)?.length || 0;
  const englishCharacters = text.match(/[A-Za-z]/g)?.length || 0;
  if (!chineseCharacters && !englishCharacters) return defaultLanguage();
  return chineseCharacters >= englishCharacters ? "zh-CN" : "en-US";
}

function createSpeechSegments(text) {
  const segments = [];
  for (const chunk of splitText(text)) {
    for (const sentence of splitSentences(chunk)) {
      const language = detectLanguage(sentence);
      const previous = segments.at(-1);
      if (previous?.language === language && previous.text.length + sentence.length < 1_500) {
        previous.text += ` ${sentence}`;
      } else {
        segments.push({ text: sentence, language });
      }
    }
  }
  return segments;
}

function voiceQualityScore(voice) {
  const identity = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = voice.default ? 20 : 0;
  if (/premium/.test(identity)) score += 400;
  else if (/enhanced/.test(identity)) score += 300;
  else if (/natural|neural|siri/.test(identity)) score += 200;
  if (/super[ -]?compact/.test(identity)) score -= 100;
  else if (/compact/.test(identity)) score += 40;
  if (/eloquence/.test(identity)) score -= 200;
  return score;
}

function findBestSystemVoice(language) {
  const voices = synth.getVoices?.() || [];
  const normalizedLanguage = language.toLowerCase();
  const localVoices = voices.filter((voice) => voice.localService !== false);
  const exactMatches = localVoices.filter((voice) => voice.lang.toLowerCase() === normalizedLanguage);
  const languageMatches = localVoices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(normalizedLanguage.slice(0, 2)),
  );
  const candidates = exactMatches.length ? exactMatches : languageMatches;
  return candidates.sort((left, right) => voiceQualityScore(right) - voiceQualityScore(left))[0] || null;
}

function updateSpeechState(state, onStateChange) {
  isSpeechActive = state === "speaking";
  onStateChange?.(state);
}

function speakChunks(chunks, generation, onStateChange) {
  const segment = chunks.shift();
  if (generation !== speechGeneration) return;
  if (!segment) {
    updateSpeechState("finished", onStateChange);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(segment.text);
  const voice = findBestSystemVoice(segment.language);
  utterance.lang = segment.language;
  if (voice) utterance.voice = voice;
  utterance.onend = () => speakChunks(chunks, generation, onStateChange);
  utterance.onerror = (event) => {
    if (generation !== speechGeneration || event.error === "canceled") return;
    updateSpeechState("error", onStateChange);
  };
  synth.speak(utterance);
}

export function stopSayContent(onStateChange) {
  if (!isSpeechActive) return false;

  speechGeneration += 1;
  isSpeechActive = false;
  synth.cancel();
  onStateChange?.("stopped");
  return true;
}

export function toggleSayContent(onStateChange) {
  if (stopSayContent(onStateChange)) return "stopped";

  const text = extractReadableText();
  if (!text) throw new Error("当前页面没有可朗读的内容。");

  speechGeneration += 1;
  synth.cancel();
  updateSpeechState("speaking", onStateChange);
  speakChunks(createSpeechSegments(text), speechGeneration, onStateChange);
  return "speaking";
}
