import { microphoneAudioConstraints, screenCaptureOptions } from "./callAudio";
export type CallRole = "host" | "cohost" | "participant";
export type ModerationAction =
  "promote" | "demote" | "mute" | "remove" | "mute-all";
export interface ClassMedia {
  mic: boolean;
  camera: boolean;
  screen: boolean;
}
export interface ClassPeer {
  id: string;
  name: string;
  role: CallRole;
  microphone: MediaStream;
  media: ClassMedia;
  camera: MediaStream;
  screen: MediaStream;
  audio: MediaStream;
  status: RTCPeerConnectionState;
}
export interface ClassState {
  id: string;
  role: CallRole;
  notice: string;
  microphone: MediaStream | null;
  microphoneId: string;
  microphoneLabel: string;
  noiseSuppression: boolean;
  audioProcessing: { echoCancellation?: boolean; noiseSuppression?: boolean };
  status: "joining" | "connected" | "disconnected";
  peers: ClassPeer[];
  media: ClassMedia;
  camera: MediaStream | null;
  screen: MediaStream | null;
  relayConfigured: boolean;
  maxParticipants: number;
  messages: { id: string; name: string; text: string; at: number }[];
}
interface PeerConnection {
  pc: RTCPeerConnection;
  view: ClassPeer;
  slots: RTCRtpTransceiver[];
  makingOffer: boolean;
  ignoreOffer: boolean;
  answering: boolean;
  candidates: RTCIceCandidateInit[];
  queue: Promise<void>;
  restarts: number;
}
const kinds = ["audio", "video", "video", "audio"] as const;
export function classroomSocketUrl(base: string, roomId: string) {
  const url = new URL(base);
  url.protocol =
    url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  url.pathname = `/classroom/${roomId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
/** Browser-native, fixed media slots + perfect negotiation. No hosted media SDK. */
export class ClassroomSession {
  onState?: (state: ClassState) => void;
  onError?: (message: string) => void;
  private socket: WebSocket;
  private id = "";
  private closed = false;
  private iceServers: RTCIceServer[] = [];
  private peers = new Map<string, PeerConnection>();
  private tracks: (MediaStreamTrack | null)[] = [null, null, null, null];
  private pending = new Set<string>();
  private micGeneration = 0;
  private state: ClassState = {
    id: "",
    role: "participant",
    notice: "",
    microphone: null,
    microphoneId: "",
    microphoneLabel: "",
    noiseSuppression: true,
    audioProcessing: {},
    status: "joining",
    peers: [],
    media: { mic: false, camera: false, screen: false },
    camera: null,
    screen: null,
    relayConfigured: false,
    maxParticipants: 8,
    messages: [],
  };
  constructor(
    url: string,
    private name: string,
    options: { noiseSuppression?: boolean; hostToken?: string } = {},
  ) {
    this.state.noiseSuppression = options.noiseSuppression ?? true;
    this.socket = new WebSocket(url);
    this.socket.onopen = () =>
      this.send({
        type: "join",
        name,
        ...(options.hostToken ? { hostToken: options.hostToken } : {}),
      });
    this.socket.onmessage = (e) => {
      try {
        this.receive(JSON.parse(e.data));
      } catch {
        this.onError?.(
          "Invalid response from the call server. Leave and rejoin.",
        );
      }
    };
    this.socket.onerror = () =>
      this.onError?.(
        "Could not reach the call server. Check your connection and the room server.",
      );
    this.socket.onclose = (event) => {
      if (event.code === 4003)
        this.onError?.("You were removed from this call by a host or co-host.");
      if (event.code === 4001)
        this.onError?.("This room expired after 24 hours.");
      if (!this.closed) this.disconnectCall();
    };
  }
  private emit() {
    if (!this.closed)
      this.onState?.({
        ...this.state,
        media: { ...this.state.media },
        peers: [...this.peers.values()].map((p) => ({
          ...p.view,
          media: { ...p.view.media },
          status: p.pc.connectionState,
        })),
      });
  }
  private send(data: unknown) {
    if (this.socket.readyState === 1) this.socket.send(JSON.stringify(data));
  }
  private receive(message: { type: string; [key: string]: unknown }) {
    if (this.closed) return;
    if (message.type === "welcome") {
      this.id = message.id as string;
      this.state.id = this.id;
      this.state.role =
        message.role === "host" || message.role === "cohost"
          ? message.role
          : "participant";
      this.iceServers = message.iceServers as RTCIceServer[];
      this.state.relayConfigured = message.relayConfigured === true;
      this.state.maxParticipants = message.maxParticipants as number;
      this.state.status = "connected";
      for (const peer of message.peers as {
        id: string;
        name: string;
        media: ClassMedia;
      }[])
        this.addPeer(peer);
      this.emit();
    } else if (message.type === "joined") {
      this.addPeer(
        message.peer as { id: string; name: string; media: ClassMedia },
      );
      this.emit();
    } else if (message.type === "left") {
      const peer = this.peers.get(message.id as string);
      peer?.pc.close();
      this.peers.delete(message.id as string);
      this.emit();
    } else if (message.type === "media") {
      const peer = this.peers.get(message.id as string);
      if (peer) {
        peer.view.media = message.media as ClassMedia;
        peer.view.microphone.getAudioTracks().forEach((track) => {
          track.enabled = peer.view.media.mic;
        });
        this.emit();
      }
    } else if (message.type === "role") {
      const role: CallRole =
        message.role === "host" || message.role === "cohost"
          ? message.role
          : "participant";
      if (message.id === this.id) this.state.role = role;
      const peer = this.peers.get(message.id as string);
      if (peer) peer.view.role = role;
      this.emit();
    } else if (message.type === "moderation") {
      if (message.action === "mute")
        void this.muteFromHost(String(message.by || "Host"));
      else if (message.action === "remove") {
        this.onError?.("You were removed from this call by a host or co-host.");
        // Reverse proxies may delay the socket's closing handshake. Release devices now.
        this.disconnectCall();
        this.socket.close(1000, "Removed from call");
      }
    } else if (message.type === "signal") {
      const peer = this.peers.get(message.from as string);
      if (!peer) return;
      peer.queue = peer.queue
        .then(() => this.signal(peer, message))
        .catch(() => {
          if (!this.closed)
            this.onError?.(
              "A media connection failed. Check your network or leave and rejoin the call.",
            );
        });
    } else if (message.type === "chat") {
      this.state.messages = [
        ...this.state.messages,
        {
          id: message.id as string,
          name: message.name as string,
          text: message.text as string,
          at: message.at as number,
        },
      ].slice(-100);
      this.emit();
    } else if (message.type === "error")
      this.onError?.(String(message.message));
  }
  private addPeer(info: {
    id: string;
    name: string;
    media: ClassMedia;
    role?: CallRole;
  }) {
    if (this.peers.has(info.id) || info.id === this.id) return;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: PeerConnection = {
      pc,
      view: {
        ...info,
        role: info.role || "participant",
        microphone: new MediaStream(),
        camera: new MediaStream(),
        screen: new MediaStream(),
        audio: new MediaStream(),
        status: "new",
      },
      slots: [],
      makingOffer: false,
      ignoreOffer: false,
      answering: false,
      candidates: [],
      queue: Promise.resolve(),
      restarts: 0,
    };
    this.peers.set(info.id, peer);
    pc.onicecandidate = (e) => {
      if (e.candidate)
        this.send({
          type: "signal",
          to: info.id,
          candidate: e.candidate.toJSON(),
        });
    };
    pc.ontrack = (e) => {
      const slot = pc.getTransceivers().indexOf(e.transceiver),
        stream =
          e.track.kind === "audio"
            ? peer.view.audio
            : slot === 2
              ? peer.view.screen
              : peer.view.camera;
      if (!stream.getTracks().some((t) => t.id === e.track.id))
        stream.addTrack(e.track);
      if (e.track.kind === "audio" && slot === 0) {
        peer.view.microphone.addTrack(e.track);
        e.track.enabled = peer.view.media.mic;
      }
      e.track.onunmute = () => this.emit();
      e.track.onmute = () => this.emit();
      e.track.onended = () => {
        stream.removeTrack(e.track);
        peer.view.microphone.removeTrack(e.track);
        this.emit();
      };
      this.emit();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        if (peer.restarts++ < 2) pc.restartIce();
        else
          this.onError?.(
            `${info.name} could not connect. A TURN relay may be needed for this network.`,
          );
      }
      this.emit();
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (!this.closed && pc.localDescription)
          this.send({
            type: "signal",
            to: info.id,
            description: pc.localDescription.toJSON(),
          });
      } catch {
        if (!this.closed && pc.connectionState !== "closed")
          this.onError?.("Could not negotiate the call. Leave and rejoin.");
      } finally {
        peer.makingOffer = false;
      }
    };
    // Only one side creates the initial slots. Locally created addTransceiver slots
    // are NOT reused by setRemoteDescription: creating them on both sides leaves
    // the answerer sending into unnegotiated slots and misroutes screen video.
    if (this.id.localeCompare(info.id) < 0)
      kinds.forEach((kind, index) => {
        const slot = pc.addTransceiver(this.tracks[index] || kind, {
          direction: "sendrecv",
          sendEncodings: [
            {
              maxBitrate:
                index === 2 ? 1500000 : kind === "video" ? 400000 : 32000,
            },
          ],
        });
        peer.slots.push(slot);
      });
  }
  private async signal(
    peer: PeerConnection,
    message: { [key: string]: unknown },
  ) {
    if (this.closed || peer.pc.connectionState === "closed") return;
    if (message.description) {
      const description = message.description as RTCSessionDescriptionInit;
      const ready =
        !peer.makingOffer &&
        (peer.pc.signalingState === "stable" || peer.answering);
      const collision = description.type === "offer" && !ready;
      const polite = this.id.localeCompare(peer.view.id) > 0;
      peer.ignoreOffer = !polite && collision;
      if (peer.ignoreOffer) return;
      peer.answering = description.type === "answer";
      try {
        await peer.pc.setRemoteDescription(description);
      } finally {
        peer.answering = false;
      }
      for (const candidate of peer.candidates.splice(0))
        await peer.pc.addIceCandidate(candidate);
      if (description.type === "offer") {
        // Adopt the offer's slots before answering, including when capture started
        // while we were still waiting for the first offer.
        peer.slots = peer.pc.getTransceivers();
        await Promise.all(
          peer.slots.map(async (slot, index) => {
            slot.direction = "sendrecv";
            await slot.sender.replaceTrack(this.tracks[index] || null);
          }),
        );
        await peer.pc.setLocalDescription();
        this.send({
          type: "signal",
          to: peer.view.id,
          description: peer.pc.localDescription?.toJSON(),
        });
      }
    } else if (message.candidate && !peer.ignoreOffer) {
      const candidate = message.candidate as RTCIceCandidateInit;
      if (!peer.pc.remoteDescription) {
        if (peer.candidates.length < 128) peer.candidates.push(candidate);
      } else await peer.pc.addIceCandidate(candidate);
    }
  }
  private async replace(index: number, track: MediaStreamTrack | null) {
    this.tracks[index] = track;
    const results = await Promise.allSettled(
      [...this.peers.values()].map((peer) =>
        peer.slots[index]?.sender.replaceTrack(track),
      ),
    );
    if (results.some((r) => r.status === "rejected") && !this.closed)
      this.onError?.(
        "A participant could not receive the media update. Leave and rejoin if it persists.",
      );
  }
  moderate(action: ModerationAction, target?: string) {
    if (this.state.status === "connected")
      this.send({ type: "moderate", action, target });
  }
  private async muteFromHost(name: string) {
    ++this.micGeneration;
    this.tracks[0]?.stop();
    await this.replace(0, null);
    if (this.closed) return;
    this.state.microphone = null;
    this.state.microphoneLabel = "";
    this.state.media.mic = false;
    this.state.audioProcessing = {};
    this.state.notice = `Muted by ${name}. You can turn your microphone on again.`;
    this.publishMedia();
  }
  private publishMedia() {
    this.send({ type: "media", ...this.state.media });
    this.emit();
  }
  private microphoneConstraints(
    deviceId = this.state.microphoneId,
  ): MediaTrackConstraints {
    return microphoneAudioConstraints(deviceId, this.state.noiseSuppression);
  }
  async setNoiseSuppression(enabled: boolean) {
    if (
      this.closed ||
      this.state.status !== "connected" ||
      this.pending.has("mic")
    )
      return;
    const generation = this.micGeneration;
    this.pending.add("mic");
    try {
      let track = this.tracks[0];
      if (track)
        await track.applyConstraints(
          microphoneAudioConstraints(this.state.microphoneId, enabled),
        );
      if (this.closed || generation !== this.micGeneration) return;
      // Some browsers acknowledge live constraints without updating their audio processor.
      const actual = track?.getSettings?.().noiseSuppression;
      if (track && typeof actual === "boolean" && actual !== enabled) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...microphoneAudioConstraints(this.state.microphoneId, enabled),
            echoCancellation: { exact: true },
            noiseSuppression: { exact: enabled },
          },
          video: false,
        });
        if (this.closed || generation !== this.micGeneration) {
          stream.getTracks().forEach((item) => item.stop());
          return;
        }
        const replacement = stream.getAudioTracks()[0];
        const settings = replacement?.getSettings?.();
        const setting = settings?.noiseSuppression;
        if (
          !replacement ||
          settings?.echoCancellation === false ||
          (typeof setting === "boolean" && setting !== enabled)
        ) {
          stream.getTracks().forEach((item) => item.stop());
          throw new Error(
            "This microphone could not apply noise cancellation.",
          );
        }
        const previous = track;
        await this.replace(0, replacement);
        previous.stop();
        if (this.closed || generation !== this.micGeneration) {
          replacement.stop();
          return;
        }
        track = replacement;
      }
      this.state.noiseSuppression = enabled;
      if (track) this.watchMicrophone(track);
      this.emit();
    } finally {
      this.pending.delete("mic");
    }
  }

  private watchMicrophone(track: MediaStreamTrack) {
    this.state.microphoneLabel = track.label || "System microphone";
    this.state.microphone = new MediaStream([track]);
    const settings = track.getSettings?.();
    this.state.audioProcessing = {
      echoCancellation: settings?.echoCancellation,
      noiseSuppression: settings?.noiseSuppression,
    };
    track.onended = () => {
      if (this.tracks[0] === track) {
        void this.replace(0, null);
        this.state.media.mic = false;
        this.state.microphoneLabel = "";
        this.state.microphone = null;
        this.state.audioProcessing = {};
        this.publishMedia();
      }
    };
  }
  async selectMicrophone(deviceId: string) {
    if (
      this.closed ||
      this.state.status !== "connected" ||
      this.pending.has("mic")
    )
      return;
    if (!this.state.media.mic) {
      this.state.microphoneId = deviceId;
      this.emit();
      return;
    }
    const generation = this.micGeneration;
    this.pending.add("mic");
    try {
      // Acquire first: a denied or unplugged device must not silence the current microphone.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: this.microphoneConstraints(deviceId),
        video: false,
      });
      if (
        this.closed ||
        this.state.status !== "connected" ||
        generation !== this.micGeneration
      ) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = stream.getAudioTracks()[0],
        previous = this.tracks[0];
      await this.replace(0, track);
      if (
        this.closed ||
        this.state.status !== "connected" ||
        generation !== this.micGeneration
      ) {
        track.stop();
        previous?.stop();
        return;
      }
      this.state.microphoneId = deviceId;
      this.watchMicrophone(track);
      previous?.stop();
      this.publishMedia();
    } finally {
      this.pending.delete("mic");
    }
  }
  async toggle(kind: "mic" | "camera") {
    if (
      this.closed ||
      this.state.status !== "connected" ||
      this.pending.has(kind)
    )
      return;
    const generation = this.micGeneration;
    if (kind === "mic") this.state.notice = "";
    this.pending.add(kind);
    const index = kind === "mic" ? 0 : 1;
    try {
      if (this.tracks[index]) {
        this.tracks[index]?.stop();
        await this.replace(index, null);
        this.state.media[kind] = false;
        if (kind === "mic") {
          this.state.microphoneLabel = "";
          this.state.microphone = null;
          this.state.audioProcessing = {};
        }
        if (kind === "camera") this.state.camera = null;
      } else {
        const stream = await navigator.mediaDevices.getUserMedia(
          kind === "mic"
            ? { audio: this.microphoneConstraints(), video: false }
            : {
                video: {
                  width: { ideal: 640 },
                  height: { ideal: 360 },
                  frameRate: { ideal: 20, max: 24 },
                },
                audio: false,
              },
        );
        if (
          this.closed ||
          this.state.status !== "connected" ||
          (kind === "mic" && generation !== this.micGeneration)
        ) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getTracks()[0];
        await this.replace(index, track);
        if (
          this.closed ||
          this.state.status !== "connected" ||
          (kind === "mic" && generation !== this.micGeneration)
        ) {
          track.stop();
          return;
        }
        this.state.media[kind] = true;
        if (kind === "camera") this.state.camera = stream;
        if (kind === "mic") this.watchMicrophone(track);
        else
          track.onended = () => {
            if (this.tracks[index] === track) {
              void this.replace(index, null);
              this.state.media.camera = false;
              this.state.camera = null;
              this.publishMedia();
            }
          };
      }
      this.publishMedia();
    } finally {
      this.pending.delete(kind);
    }
  }
  async toggleScreen(changeSource = false, shareTabAudio = false) {
    if (
      this.closed ||
      this.state.status !== "connected" ||
      this.pending.has("screen")
    )
      return;
    this.pending.add("screen");
    try {
      if (this.state.screen && !changeSource) {
        await this.stopScreen();
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia(
        screenCaptureOptions(shareTabAudio),
      );
      if (this.closed || this.state.status !== "connected") {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const previous = this.state.screen,
        video = stream.getVideoTracks()[0];
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          "No screen video was selected. Choose a screen, window or tab and try again.",
        );
      }
      const surface = video.getSettings?.().displaySurface;
      if (!shareTabAudio || surface === "monitor" || surface === "window") {
        for (const audio of stream.getAudioTracks()) {
          audio.stop();
          stream.removeTrack(audio);
        }
      }
      this.state.screen = stream;
      await this.replace(2, video);
      await this.replace(3, stream.getAudioTracks()[0] || null);
      if (this.closed || this.state.status !== "connected") {
        stream.getTracks().forEach((t) => t.stop());
        previous?.getTracks().forEach((t) => t.stop());
        return;
      }
      this.state.media.screen = true;
      video.onended = () => {
        if (this.state.screen === stream) void this.stopScreen();
      };
      previous?.getTracks().forEach((t) => t.stop());
      this.publishMedia();
    } finally {
      this.pending.delete("screen");
    }
  }
  private async stopScreen() {
    const stream = this.state.screen;
    this.state.screen = null;
    this.state.media.screen = false;
    stream?.getTracks().forEach((t) => t.stop());
    await Promise.all([this.replace(2, null), this.replace(3, null)]);
    this.publishMedia();
  }
  chat(text: string) {
    if (this.state.status === "connected" && text.trim())
      this.send({ type: "chat", text: text.trim().slice(0, 2000) });
  }
  private stopMedia() {
    this.tracks.forEach((t) => t?.stop());
    this.tracks = [null, null, null, null];
    this.state.camera = null;
    this.state.screen = null;
    this.state.microphoneLabel = "";
    this.state.microphone = null;
    this.state.audioProcessing = {};
    this.state.media = { mic: false, camera: false, screen: false };
  }
  private disconnectCall() {
    ++this.micGeneration;
    this.stopMedia();
    this.dropPeers();
    this.state.status = "disconnected";
    this.emit();
  }
  private dropPeers() {
    for (const peer of this.peers.values()) peer.pc.close();
    this.peers.clear();
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.socket.onclose = null;
    this.socket.close();
    this.stopMedia();
    this.dropPeers();
  }
}
