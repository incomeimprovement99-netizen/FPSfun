import puppeteer from "puppeteer";
const main = async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio", "--no-sandbox"] });
  const p = await b.newPage();
  p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  await p.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
  await p.goto("http://localhost:5194/?nointro", { waitUntil: "domcontentloaded" });
  await p.waitForFunction("window.__range && window.__range.loaded()", { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 8000));
  console.log(await p.evaluate("JSON.stringify(window.__range.sceneryDrawn())"));
  await b.close();
};
void main();
