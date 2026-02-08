/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { audioContext, arrayBufferToBase64 } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorket from './worklets/vol-meter';
import { createWorketFromSrc } from './audioworklet-registry';
import EventEmitter from 'eventemitter3';

interface AudioContextWithWorklets extends AudioContext {
  _registeredWorklets?: Set<string>;
}

export class AudioRecorder {
  private emitter = new EventEmitter();

  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {}

  async start() {
    if (this.recording || this.starting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Could not request user media');
    }

    this.starting = (async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx: AudioContextWithWorklets = await audioContext({ sampleRate: this.sampleRate });
        this.audioContext = audioCtx;
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        if (!audioCtx._registeredWorklets) {
          audioCtx._registeredWorklets = new Set<string>();
        }

        const workletName = 'audio-recorder-worklet';
        if (!audioCtx._registeredWorklets.has(workletName)) {
            const src = createWorketFromSrc(workletName, AudioRecordingWorklet);
            await this.audioContext.audioWorklet.addModule(src);
            audioCtx._registeredWorklets.add(workletName);
        }
        
        this.recordingWorklet = new AudioWorkletNode(this.audioContext, workletName);

        this.recordingWorklet.port.onmessage = (ev: MessageEvent) => {
          const arrayBuffer = ev.data.data.int16arrayBuffer;
          if (arrayBuffer) {
            const arrayBufferString = arrayBufferToBase64(arrayBuffer);
            this.emitter.emit('data', arrayBufferString);
          }
        };
        this.source.connect(this.recordingWorklet);

        const vuWorkletName = 'vu-meter';
        if (!audioCtx._registeredWorklets.has(vuWorkletName)) {
            const vuSrc = createWorketFromSrc(vuWorkletName, VolMeterWorket);
            await this.audioContext.audioWorklet.addModule(vuSrc);
            audioCtx._registeredWorklets.add(vuWorkletName);
        }
        this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
        this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
          this.emitter.emit('volume', ev.data.volume);
        };

        this.source.connect(this.vuWorklet);
        this.recording = true;
      } finally {
        this.starting = null;
      }
    })();
    
    return this.starting;
  }

  stop() {
    const handleStop = () => {
      if (!this.recording && !this.starting) return;
      this.source?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
      this.recording = false;
    };

    if (this.starting) {
      this.starting.then(handleStop).catch(handleStop);
    } else {
      handleStop();
    }
  }
}