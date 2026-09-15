// The first visit: what to click, the few keys that matter, how to play a
// friend. And, on every visit, whether this device can play at all: a link
// sent by text gets opened on a phone, where nothing works and, before this,
// nothing said why.
const KEY = "range.welcomed.v1";

/** why this browser or device cannot play (or plays worse), as HTML; null when it is fine */
export function deviceProblem(ua = navigator.userAgent): string | null {
  const touchOnly = matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
  if (touchOnly || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
    return "<b>This is a PC game.</b> It needs a keyboard and mouse (or a controller) on a computer, in Chrome or Edge. A phone or tablet cannot play it: send yourself this link and open it on a PC.";
  }
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua);
  if (!chromium && /Safari\//.test(ua)) return "<b>Safari is not supported.</b> Open this page in Chrome or Edge.";
  if (/Firefox\//.test(ua)) return "Firefox works, but without raw mouse input, so your aim can pick up mouse acceleration. <b>Chrome or Edge</b> play best.";
  return null;
}

/** show the welcome on a first visit, and the device warning whenever there is one */
export function initWelcome(): void {
  const box = document.getElementById("welcome");
  const warn = document.getElementById("welcomeWarn");
  if (!box || !warn) return;
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === "1";
  } catch {
    /* storage blocked: show it */
  }
  const problem = deviceProblem();
  if (problem) {
    warn.innerHTML = problem;
    warn.hidden = false;
  }
  // the welcome sits on the Play tab; the device warning above every tab
  box.hidden = seen;
  document.getElementById("welcomeOk")?.addEventListener("click", () => {
    box.hidden = true;
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  });
}

/** close the welcome for good: the player has found their way in */
export function dismissWelcome(): void {
  const box = document.getElementById("welcome");
  if (box && !box.hidden) {
    box.hidden = true;
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }
}
