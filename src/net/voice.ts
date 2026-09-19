// Voice chat (src/config/voice.json).
//
// Push to talk (Caps Lock), heard by the people you play with: your squad in
// a battle royale, your team in the team modes, everyone in a lobby, a 1v1 or
// a free-for-all. It goes peer to peer between the players themselves, not
// through the host: the host already carries every state in the match, and
// voice through it would multiply its upload by the lobby again. So the host
// tells everyone each player's PeerJS id (the `voice` message), and each page
// calls the ones it may talk to over PeerJS's media calls, on the same broker
// and relays as the game's own connection.
//
// The microphone is asked for on the first press of the key, not before: a
// player who never talks is never asked. Held, the microphone's track is on;
// let go, it is off, so nothing is sent between words. A page that never
// talks still hears: it answers the calls of those who do, receiving only.
import type Peer from "peerjs";
import type { MediaConnection } from "peerjs";
import cfg from "../config/voice.json";

interface Heard {
  call: MediaConnection;
  audio: HTMLAudioElement;
  analyser: AnalyserNode | null;
  level: number;
}

export class Voice {
  /** the players this page may talk to and hear, by PeerJS id */
  private group = new Set<string>();
  /** our microphone, once the player has pressed the key and allowed it */
  private mic: MediaStream | null = null;
  private asking: Promise<MediaStream | null> | null = null;
  /** calls we made with our microphone, by the callee's PeerJS id */
  private outgoing = new Map<string, MediaConnection>();
  /** what we hear, by the talker's PeerJS id */
  private heard = new Map<string, Heard>();
  private ctx: AudioContext | null = null;
  private talking = false;
  volume = cfg.volume;
  /** the player said no to the microphone (or there is none): the key does nothing, and says so once */
  denied = false;

  constructor(private readonly peer: Peer) {
    peer.on("call", (call) => this.answer(call));
  }

  /** who this page may talk to and hear now (their PeerJS ids): calls to anyone else end */
  setGroup(ids: Iterable<string>): void {
    this.group = new Set([...ids].filter((id) => id && id !== this.peer.id));
    for (const [id, call] of [...this.outgoing]) {
      if (this.group.has(id)) continue;
      call.close();
      this.outgoing.delete(id);
    }
    for (const [id, h] of [...this.heard]) {
      if (this.group.has(id)) continue;
      this.dropHeard(id, h);
    }
    // someone new in the group while we have a microphone: call them too
    if (this.mic) this.callGroup();
  }

  /** the key: held, the microphone is on (asked for on the first press); let go, it is off */
  async setTalking(on: boolean): Promise<void> {
    this.talking = on;
    if (on && !this.mic && !this.denied) {
      this.asking ??= navigator.mediaDevices
        ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        .then(
          (s) => s,
          () => {
            this.denied = true;
            return null;
          }
        ) ?? Promise.resolve(null);
      this.mic = await this.asking;
      this.asking = null;
      if (!this.mic) return;
      this.callGroup();
    }
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = this.talking;
  }

  /** is this page sending its voice now */
  get live(): boolean {
    return this.talking && !!this.mic;
  }

  /** how loud each player we hear is, 0 to 1, by PeerJS id (the HUD's "talking" mark) */
  levels(): Map<string, number> {
    const out = new Map<string, number>();
    const buf = new Uint8Array(256);
    for (const [id, h] of this.heard) {
      if (!h.analyser) continue;
      h.analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      // held a moment, so a word reads as one mark rather than a flicker
      h.level = Math.max(peak, h.level * cfg.levelHold);
      out.set(id, h.level);
    }
    return out;
  }

  /** out of the match: every call ended, the microphone let go */
  stop(): void {
    for (const c of this.outgoing.values()) c.close();
    this.outgoing.clear();
    for (const [id, h] of [...this.heard]) this.dropHeard(id, h);
    for (const t of this.mic?.getTracks() ?? []) t.stop();
    this.mic = null;
    this.talking = false;
    void this.ctx?.close();
    this.ctx = null;
  }

  /** our microphone to everyone in the group we have not called yet */
  private callGroup(): void {
    const mic = this.mic;
    if (!mic) return;
    for (const t of mic.getAudioTracks()) t.enabled = this.talking;
    for (const id of this.group) {
      if (this.outgoing.has(id)) continue;
      const call = this.peer.call(id, mic, { metadata: { voice: 1 } });
      if (!call) continue;
      this.outgoing.set(id, call);
      const gone = () => {
        if (this.outgoing.get(id) === call) this.outgoing.delete(id);
      };
      call.on("close", gone);
      call.on("error", gone);
    }
  }

  /** someone's call: heard if they are in the group, turned away if not */
  private answer(call: MediaConnection): void {
    const md = call.metadata as { voice?: number } | undefined;
    if (!md || md.voice !== 1 || !this.group.has(call.peer)) {
      call.close();
      return;
    }
    // receiving only: our own voice goes on our own call to them
    call.answer();
    call.on("stream", (stream) => this.hear(call, stream));
    call.on("close", () => {
      const h = this.heard.get(call.peer);
      if (h && h.call === call) this.dropHeard(call.peer, h);
    });
  }

  private hear(call: MediaConnection, stream: MediaStream): void {
    const old = this.heard.get(call.peer);
    if (old) this.dropHeard(call.peer, old);
    const audio = new Audio();
    audio.srcObject = stream;
    audio.volume = Math.max(0, Math.min(1, this.volume));
    void audio.play().catch(() => undefined);
    let analyser: AnalyserNode | null = null;
    try {
      this.ctx ??= new AudioContext();
      analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      this.ctx.createMediaStreamSource(stream).connect(analyser);
    } catch {
      analyser = null;
    }
    this.heard.set(call.peer, { call, audio, analyser, level: 0 });
  }

  private dropHeard(id: string, h: Heard): void {
    h.call.close();
    h.audio.pause();
    h.audio.srcObject = null;
    this.heard.delete(id);
  }

  /** the volume every voice plays at (the Settings tab's) */
  setVolume(v: number): void {
    this.volume = v;
    for (const h of this.heard.values()) h.audio.volume = Math.max(0, Math.min(1, v));
  }
}
