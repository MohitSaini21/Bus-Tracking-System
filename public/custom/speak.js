let voicesReady = false;

function setupSpeechSynthesis() {
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      voicesReady = true;
    };
  } else {
    voicesReady = true;
  }
}

setupSpeechSynthesis(); // ✅ Call this ONCE at startup

function speakHindi(text) {
  if (!voicesReady) {
    console.warn("Voices not ready yet!");
    return;
  }
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();

  const hindiVoice =
    voices.find((v) => v.name === "Google हिन्दी") ||
    voices.find((v) => v.lang === "hi-IN"); // fallback

  const utterance = new SpeechSynthesisUtterance(text);
  if (hindiVoice) {
    utterance.voice = hindiVoice;
    console.log("🎤 Using Hindi Voice:", hindiVoice.name);
  } else {
    console.warn("⚠️ Hindi voice not found. Using default voice.");
  }

  utterance.pitch = 1;
  utterance.rate = 1;
  utterance.volume = 1;

  synth.cancel(); // Cancel any ongoing speech first
  synth.speak(utterance);
}

function safeSpeakHindi(text, retries = 10) {
  console.log("speaking....................");
  return;
  if (voicesReady) {
    speakHindi(text);
  } else if (retries > 0) {
    setTimeout(() => safeSpeakHindi(text, retries - 1), 300); // retry after 300ms
  } else {
    console.warn("Voices never got ready.");
  }
}
