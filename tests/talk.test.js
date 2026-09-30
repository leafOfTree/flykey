import assert from "node:assert/strict";
import test from "node:test";

class MockElement {
  innerText = "";
  textContent = "";
  parentElement = null;

  cloneNode() {
    const clone = new MockElement();
    clone.innerText = this.innerText;
    clone.textContent = this.textContent;
    return clone;
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }
}

class MockUtterance {
  constructor(text) {
    this.text = text;
    this.voice = null;
    this.rate = 1;
  }
}

const body = new MockElement();
const visibleTextNode = { textContent: "Visible article text.", parentElement: body };
let selectedText = "这是一段测试文本。";
const speech = {
  current: null,
  cancelCount: 0,
  voices: [],
  cancel() {
    this.cancelCount += 1;
    this.current = null;
  },
  speak(utterance) {
    this.current = utterance;
  },
  getVoices() {
    return this.voices;
  },
};

globalThis.HTMLElement = MockElement;
globalThis.SpeechSynthesisUtterance = MockUtterance;
globalThis.document = {
  body,
  documentElement: { lang: "zh-CN", clientWidth: 1280, clientHeight: 720 },
  querySelector() {
    return null;
  },
  createTreeWalker() {
    let returned = false;
    return {
      nextNode() {
        if (returned) return null;
        returned = true;
        return visibleTextNode;
      },
    };
  },
  createRange() {
    return {
      selectNodeContents() {},
      getClientRects() {
        return [{ top: 20, right: 220, bottom: 40, left: 20, width: 200, height: 20 }];
      },
    };
  },
};
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  speechSynthesis: speech,
  getSelection() {
    return { toString: () => selectedText };
  },
};
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.getComputedStyle = () => ({
  display: "block",
  visibility: "visible",
  contentVisibility: "visible",
  opacity: "1",
});
const { stopSayContent, toggleSayContent } = await import("../frontend/src/extensions/talk.js");

test("the same shortcut starts and stops reading with state updates", () => {
  const states = [];

  assert.equal(toggleSayContent((state) => states.push(state)), "speaking");
  assert.equal(speech.current.text, "这是一段测试文本。");
  assert.equal(speech.current.lang, "zh-CN");
  assert.equal(speech.current.voice, null);
  assert.equal(speech.current.rate, 1);
  assert.deepEqual(states, ["speaking"]);

  assert.equal(toggleSayContent((state) => states.push(state)), "stopped");
  assert.equal(speech.current, null);
  assert.deepEqual(states, ["speaking", "stopped"]);
});

test("natural completion reports that reading finished", () => {
  const states = [];

  toggleSayContent((state) => states.push(state));
  speech.current.onend();

  assert.deepEqual(states, ["speaking", "finished"]);
  assert.equal(stopSayContent(), false);
});

test("English content selects an English voice language", () => {
  selectedText = "Read this English sentence.";

  toggleSayContent();

  assert.equal(speech.current.text, selectedText);
  assert.equal(speech.current.lang, "en-US");
  stopSayContent();
});

test("English product names stay inside a Chinese sentence without interrupting speech", () => {
  const states = [];
  selectedText =
    "一个基于 Microsoft Edge TTS 的免费在线语音合成服务，支持 20+ 种中文声音，一键将文字转换为自然流畅的语音。";

  toggleSayContent((state) => states.push(state));
  assert.equal(speech.current.text, selectedText);
  assert.equal(speech.current.lang, "zh-CN");

  speech.current.onend();
  assert.deepEqual(states, ["speaking", "finished"]);
});

test("separate Chinese and English sentences use their matching languages", () => {
  selectedText = "你好。 This is Flykey.";

  toggleSayContent();
  assert.equal(speech.current.lang, "zh-CN");
  speech.current.onend();
  assert.equal(speech.current.lang, "en-US");
  stopSayContent();
});

test("the highest-quality local voice is preferred over compact voices", () => {
  const superCompactVoice = {
    name: "Tingting",
    voiceURI: "com.apple.voice.super-compact.zh-CN.Tingting",
    lang: "zh-CN",
    localService: true,
    default: true,
  };
  const compactVoice = {
    name: "Tingting",
    voiceURI: "com.apple.voice.compact.zh-CN.Tingting",
    lang: "zh-CN",
    localService: true,
    default: false,
  };
  const premiumVoice = {
    name: "Tingting Premium",
    voiceURI: "com.apple.speech.synthesis.voice.ting-ting.premium",
    lang: "zh-CN",
    localService: true,
    default: false,
  };
  speech.voices = [superCompactVoice, compactVoice, premiumVoice];
  selectedText = "这是一段普通话。";

  toggleSayContent();

  assert.equal(speech.current.voice, premiumVoice);
  stopSayContent();
  speech.voices = [];
});

test("visible page text is read when there is no selection", () => {
  selectedText = "";

  toggleSayContent();

  assert.equal(speech.current.text, visibleTextNode.textContent);
  assert.equal(speech.current.lang, "en-US");
  stopSayContent();
});
