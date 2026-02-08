/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  Session,
} from '@google/genai';
import EventEmitter from 'eventemitter3';
import { base64ToArrayBuffer } from './utils';

export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: LiveServerContent) => void;
  error: (e: ErrorEvent) => void;
  interrupted: () => void;
  open: () => void;
  toolcall: (toolCall: LiveServerToolCall) => void;
  turncomplete: () => void;
  inputTranscription: (text: string, isFinal: boolean) => void;
  outputTranscription: (text: string, isFinal: boolean) => void;
}

export class GenAILiveClient {
  private emitter = new EventEmitter<LiveClientEventTypes>();
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  protected readonly client: GoogleGenAI;
  protected session?: Session;
  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

  public get status() {
    return this._status;
  }

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  public async connect(config: LiveConnectConfig): Promise<void> {
    if (this._status !== 'disconnected') {
      return;
    }
    this._status = 'connecting';

    const callbacks: LiveCallbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    };

    try {
      this.session = await this.client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config,
        callbacks,
      });
      this._status = 'connected';
    } catch (e: any) {
      console.error('Error connecting to GenAI Live:', e);
      this._status = 'disconnected';
      this.session = undefined;
      const errorEvent = new ErrorEvent('error', {
        error: e,
        message: e?.message || 'Failed to connect.',
      });
      this.onError(errorEvent);
      throw e;
    }
  }

  public disconnect() {
    if (this._status === 'disconnected') return;
    this.session?.close();
    this.session = undefined;
    this._status = 'disconnected';
  }

  public sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (this._status !== 'connected' || !this.session) return;
    chunks.forEach(chunk => {
      this.session!.sendRealtimeInput({ media: chunk });
    });
  }

  public sendText(text: string) {
    if (this._status !== 'connected' || !this.session) return;
    this.session.sendRealtimeInput({ text });
  }

  public sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (this._status !== 'connected' || !this.session) return;
    if (toolResponse.functionResponses && toolResponse.functionResponses.length) {
      this.session.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
    }
  }

  protected onMessage(message: LiveServerMessage) {
    if (message.toolCall) {
      this.emitter.emit('toolcall', message.toolCall);
    }

    if (message.serverContent) {
      const { serverContent } = message;
      if (serverContent.interrupted) {
        this.emitter.emit('interrupted');
      }
      if (serverContent.inputTranscription) {
        this.emitter.emit(
          'inputTranscription',
          serverContent.inputTranscription.text,
          (serverContent.inputTranscription as any).isFinal ?? false
        );
      }
      if (serverContent.outputTranscription) {
        this.emitter.emit(
          'outputTranscription',
          serverContent.outputTranscription.text,
          (serverContent.outputTranscription as any).isFinal ?? false
        );
      }
      if (serverContent.modelTurn?.parts) {
        serverContent.modelTurn.parts.forEach(part => {
          if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
            const data = base64ToArrayBuffer(part.inlineData.data);
            this.emitter.emit('audio', data);
          }
        });
      }
      if (serverContent.turnComplete) {
        this.emitter.emit('turncomplete');
      }
    }
  }

  protected onError(e: ErrorEvent) {
    console.error('GenAI Live Error:', e);
    this.emitter.emit('error', e);
    this.disconnect();
  }

  protected onOpen() {
    this.emitter.emit('open');
  }

  protected onClose(e: CloseEvent) {
    this._status = 'disconnected';
    this.emitter.emit('close', e);
  }
}