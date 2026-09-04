import type { VoiceSignalPayload, VoiceStatePayload } from '../types';
import { WebSocketClient } from './websocket';

export interface VoicePeer {
  userId: string;
  userName: string;
  avatar?: string;
  isMuted: boolean;        // Whether they muted themselves
  isLocallyMuted: boolean; // Whether WE muted them locally
  volume: number;          // 0 to 1.5
  isSpeaking: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCVoiceManager {
  private localStream: MediaStream | null = null;
  private wsClient: WebSocketClient | null = null;
  private currentUserId: string = '';

  private peers: Map<string, {
    pc: RTCPeerConnection;
    gainNode: GainNode | null;
    audioElement: HTMLAudioElement | null;
    remoteStream: MediaStream | null;
    isLocallyMuted: boolean;
    volume: number;
    userName: string;
    isMuted: boolean;
    isSpeaking: boolean;
  }> = new Map();

  private audioCtx: AudioContext | null = null;
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  public inVoice: boolean = false;
  public isSelfMuted: boolean = false;

  private onPeersUpdateCallback: ((peers: VoicePeer[]) => void) | null = null;
  private onSelfUpdateCallback: ((inVoice: boolean, isMuted: boolean) => void) | null = null;

  constructor(currentUserId: string, wsClient: WebSocketClient | null) {
    this.currentUserId = currentUserId;
    this.wsClient = wsClient;
  }

  public setCallbacks(
    onPeersUpdate: (peers: VoicePeer[]) => void,
    onSelfUpdate: (inVoice: boolean, isMuted: boolean) => void
  ) {
    this.onPeersUpdateCallback = onPeersUpdate;
    this.onSelfUpdateCallback = onSelfUpdate;
  }

  public async joinVoice(): Promise<boolean> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }
      this.inVoice = true;
      this.isSelfMuted = false;

      this.wsClient?.sendVoiceState(true, false);
      this.notifySelf();
      return true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      return false;
    }
  }

  public leaveVoice() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    this.peers.forEach((peer) => {
      peer.pc.close();
      peer.audioElement?.pause();
      peer.audioElement?.remove();
    });
    this.peers.clear();
    this.pendingCandidates.clear();

    this.audioCtx?.close();
    this.audioCtx = null;

    this.inVoice = false;
    this.isSelfMuted = false;

    this.wsClient?.sendVoiceState(false, true);
    this.notifySelf();
    this.notifyPeers();
  }

  public toggleSelfMute() {
    if (!this.localStream) return;
    this.isSelfMuted = !this.isSelfMuted;
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !this.isSelfMuted;
    });

    this.wsClient?.sendVoiceState(this.inVoice, this.isSelfMuted);
    this.notifySelf();
  }

  // Individual Per-User Mute Toggle
  public setPeerMute(peerUserId: string, muted: boolean) {
    const peer = this.peers.get(peerUserId);
    if (!peer) return;

    peer.isLocallyMuted = muted;
    if (peer.gainNode) {
      peer.gainNode.gain.value = muted ? 0 : peer.volume;
    } else if (peer.audioElement) {
      peer.audioElement.muted = muted;
    }
    this.notifyPeers();
  }

  // Individual Per-User Volume Control (0.0 to 1.5)
  public setPeerVolume(peerUserId: string, volume: number) {
    const peer = this.peers.get(peerUserId);
    if (!peer) return;

    peer.volume = volume;
    if (peer.gainNode && !peer.isLocallyMuted) {
      peer.gainNode.gain.value = volume;
    } else if (peer.audioElement) {
      peer.audioElement.volume = Math.min(1.0, volume);
    }
    this.notifyPeers();
  }

  // Initiate peer connection to target member
  public async initiateConnection(targetUserId: string, targetUserName: string) {
    if (!this.inVoice || !this.localStream || targetUserId === this.currentUserId) return;
    if (this.peers.has(targetUserId)) return;

    const pc = this.createPeerConnection(targetUserId, targetUserName);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.wsClient?.sendVoiceSignal(targetUserId, 'offer', offer);
  }

  private createPeerConnection(targetUserId: string, targetUserName: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local mic track
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.wsClient?.sendVoiceSignal(targetUserId, 'candidate', event.candidate);
      }
    };

    const peerInfo = {
      pc,
      gainNode: null as GainNode | null,
      audioElement: null as HTMLAudioElement | null,
      remoteStream: null as MediaStream | null,
      isLocallyMuted: false,
      volume: 1.0,
      userName: targetUserName,
      isMuted: false,
      isSpeaking: false,
    };
    this.peers.set(targetUserId, peerInfo);

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      peerInfo.remoteStream = remoteStream;

      // Attach audio element with Web Audio gain routing
      const audioEl = new Audio();
      audioEl.srcObject = remoteStream;
      audioEl.autoplay = true;
      peerInfo.audioElement = audioEl;

      if (this.audioCtx) {
        try {
          const source = this.audioCtx.createMediaStreamSource(remoteStream);
          const gainNode = this.audioCtx.createGain();
          gainNode.gain.value = peerInfo.volume;
          source.connect(gainNode);
          gainNode.connect(this.audioCtx.destination);
          peerInfo.gainNode = gainNode;
        } catch {
          // Fallback to standard audio element volume
          audioEl.volume = peerInfo.volume;
        }
      }

      this.notifyPeers();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peerInfo.audioElement?.remove();
        this.peers.delete(targetUserId);
        this.notifyPeers();
      }
    };

    this.notifyPeers();
    return pc;
  }

  private async flushCandidates(senderUserId: string, pc: RTCPeerConnection) {
    const queued = this.pendingCandidates.get(senderUserId);
    if (!queued || queued.length === 0) return;
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('Failed to add queued ICE candidate:', e);
      }
    }
    this.pendingCandidates.delete(senderUserId);
  }

  public async handleSignal(signal: VoiceSignalPayload) {
    if (!this.inVoice) return;
    const { senderUserId, signalType, data } = signal;

    let peer = this.peers.get(senderUserId);

    if (signalType === 'offer') {
      if (!peer) {
        this.createPeerConnection(senderUserId, 'Member');
        peer = this.peers.get(senderUserId);
      }
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
        await this.flushCandidates(senderUserId, peer.pc);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.wsClient?.sendVoiceSignal(senderUserId, 'answer', answer);
      }
    } else if (signalType === 'answer') {
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
        await this.flushCandidates(senderUserId, peer.pc);
      }
    } else if (signalType === 'candidate') {
      if (peer && peer.pc.remoteDescription) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit));
        } catch (e) {
          console.warn('Failed to add ICE candidate:', e);
        }
      } else if (data) {
        // Buffer candidate until remote description is set
        const queue = this.pendingCandidates.get(senderUserId) || [];
        queue.push(data as RTCIceCandidateInit);
        this.pendingCandidates.set(senderUserId, queue);
      }
    }
  }

  public handleRemoteVoiceState(state: VoiceStatePayload) {
    if (state.userId === this.currentUserId) return;

    const peer = this.peers.get(state.userId);
    if (state.inVoice) {
      if (peer) {
        peer.isMuted = state.isMuted;
        peer.userName = state.userName || peer.userName;
      } else if (this.inVoice) {
        // If we are in voice and someone joined, connect with them
        this.initiateConnection(state.userId, state.userName || 'Member');
      }
    } else {
      if (peer) {
        peer.pc.close();
        peer.audioElement?.remove();
        this.peers.delete(state.userId);
      }
    }
    this.notifyPeers();
  }

  private notifySelf() {
    this.onSelfUpdateCallback?.(this.inVoice, this.isSelfMuted);
  }

  private notifyPeers() {
    const list: VoicePeer[] = [];
    this.peers.forEach((p, uid) => {
      list.push({
        userId: uid,
        userName: p.userName,
        isMuted: p.isMuted,
        isLocallyMuted: p.isLocallyMuted,
        volume: p.volume,
        isSpeaking: p.isSpeaking,
      });
    });
    this.onPeersUpdateCallback?.(list);
  }
}
