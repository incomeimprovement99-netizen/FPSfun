// The account box on the Stats tab (src/net/account.ts): sign up, sign in,
// sync, sign out. Optional; on a site without the game's own server it says
// so and stays out of the way.
import { accountBase, pullIfNewer, push, PUSH_FAILED, session, signIn, signOut } from "../net/account";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface AccountUiDeps {
  /** your name on the boards and to the people you play: the account's, once signed in */
  setName: (name: string) => void;
}

/**
 * What a failed sync says, by the server's answer (Milestone 731). It said "sign in again" whatever went wrong: after
 * a few too many saves (429), a profile too big for it (400, 413, 507) or no answer at all, and signing in again put the
 * account's older profile over this browser's newer one.
 */
export function syncFailed(status: number | null): string {
  if (status === 401) return "Could not sync: the server has signed you out. Sign in again.";
  if (status === 429) return "Not synced yet: a lot of saves just now. It goes up after your next match.";
  if (status === 400 || status === 413 || status === 507) return "Could not sync: the server would not take this much. Your things are safe in this browser.";
  return "Could not sync: no answer from the server. Your things are safe in this browser; try again in a minute.";
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
    // another browser saved to the account since this one last synced: its things, and a fresh start from them
    if (s)
      void pullIfNewer().then((newer) => {
        if (newer) location.reload();
        else lapsed();
      });
  });
  // the server signed this browser out (its session ran out): the box says so, where it went on saying signed in while
  // nothing went up (Milestone 910)
  const lapsed = () => {
    if (session() || inn.hidden) return;
    render();
    say(syncFailed(401), false);
  };
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
    if (r.reload) {
      // the account's things are on: reload at once, before anything of this page's writes over them
      // (its name comes with its profile)
      say(`Signed in as ${s?.name}. Loading your profile...`);
      location.reload();
      return;
    }
    if (s) deps.setName(s.name);
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
      say(ok ? "Synced." : syncFailed(PUSH_FAILED.status), ok);
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
      pending = setTimeout(() => void push().then(lapsed), 1500);
    },
  };
}
