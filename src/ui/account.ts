// The account box on the Stats tab (src/net/account.ts): sign up, sign in,
// sync, sign out. Optional; on a site without the game's own server it says
// so and stays out of the way.
import { accountBase, push, session, signIn, signOut } from "../net/account";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface AccountUiDeps {
  /** your name on the boards and to the people you play: the account's, once signed in */
  setName: (name: string) => void;
}

export function initAccountUi(deps: AccountUiDeps): { sync: () => void } {
  const box = $<HTMLDivElement>("accountBox");
  const out = $<HTMLSpanElement>("accountSignedOut");
  const inn = $<HTMLSpanElement>("accountSignedIn");
  const who = $<HTMLElement>("accountWho");
  const status = $<HTMLDivElement>("accountStatus");
  const nameIn = $<HTMLInputElement>("accountName");
  const passIn = $<HTMLInputElement>("accountPass");
  const say = (t: string, good = true) => {
    status.textContent = t;
    status.style.color = good ? "" : "#ff8a7a";
  };
  const render = () => {
    const s = session();
    out.hidden = !!s;
    inn.hidden = !s;
    who.textContent = s ? s.name : "";
  };
  void accountBase().then((b) => {
    box.dataset.available = b ? "1" : "0";
    if (!b) {
      out.hidden = true;
      inn.hidden = true;
      say("Accounts need the game's own server; this copy of the game has none. Your things are kept in this browser.");
      return;
    }
    render();
    const s = session();
    say(s ? `Signed in as ${s.name}. Your settings, keys, loadouts and stats sync to the account.` : "Optional: keep your settings, keys, loadouts and stats across browsers. Nobody needs one to play.");
  });
  const go = async (create: boolean) => {
    const name = nameIn.value.trim();
    const password = passIn.value;
    say(create ? "Signing up..." : "Signing in...");
    const r = await signIn(name, password, create);
    passIn.value = "";
    if (!r.ok) {
      say(r.error ?? "That did not work.", false);
      return;
    }
    const s = session();
    if (s) deps.setName(s.name);
    if (r.reload) {
      say(`Signed in as ${s?.name}. Loading your profile...`);
      setTimeout(() => location.reload(), 400);
      return;
    }
    // (a new account took this browser's things; the name change goes up too)
    await push();
    render();
    say(`Signed in as ${s?.name}. This browser's settings, keys, loadouts and stats are on the account now.`);
  };
  $("accountSignIn").addEventListener("click", () => void go(false));
  $("accountSignUp").addEventListener("click", () => void go(true));
  passIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void go(false);
  });
  $("accountSync").addEventListener("click", () => {
    say("Syncing...");
    void push().then((ok) => {
      render();
      say(ok ? "Synced." : "Could not sync: sign in again.", ok);
    });
  });
  $("accountSignOut").addEventListener("click", () => {
    void signOut().then(() => {
      render();
      say("Signed out. Your things stay in this browser.");
    });
  });
  // after a match or a run: the new stats go up quietly
  let pending: ReturnType<typeof setTimeout> | null = null;
  return {
    sync: () => {
      if (!session()) return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => void push(), 1500);
    },
  };
}
