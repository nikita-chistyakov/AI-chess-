/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Manages the playback of raw PCM audio streams from the Gemini Live API.
 * It decodes each chunk and schedules it for seamless, gapless playback.
 */
export class AudioStreamer {
  // FIX: Made `nextStartTime` public to allow calculating remaining playback time.
  public nextStartTime: number = 0;
  public gainNode: GainNode;
  private analyser: AnalyserNode;
  private sampleRate: number = 24000; // Expected sample rate from Gemini Live API
  private sources = new Set<AudioBufferSourceNode>();
  private volumeDataArray: Uint8Array;


  constructor(public context: AudioContext) {
    this.gainNode = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.6;
    this.volumeDataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.gainNode.connect(this.context.destination);
  }

  /**
   * Decodes a raw PCM16 (16-bit signed integer) byte array into an AudioBuffer.
   * @param pcm16Data The raw audio data chunk.
   * @returns A promise that resolves to an AudioBuffer.
   */
  private async decodeAndBuffer(pcm16Data: Uint8Array): Promise<AudioBuffer> {
    const frameCount = pcm16Data.length / 2; // 2 bytes per sample for PCM16
    const audioBuffer = this.context.createBuffer(1, frameCount, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    const dataView = new DataView(pcm16Data.buffer);

    for (let i = 0; i < frameCount; i++) {
      const int16 = dataView.getInt16(i * 2, true); // true for little-endian
      channelData[i] = int16 / 32768.0; // Convert to float between -1.0 and 1.0
    }
    return audioBuffer;
  }

  /**
   * Adds a chunk of PCM16 data to the playback queue.
   * @param chunk The raw audio data chunk to play.
   */
  public async addPCM16(chunk: Uint8Array) {
    if (!chunk || chunk.length === 0) return;

    // Ensure audio context is running before trying to play audio.
    await this.resume();

    const audioBuffer = await this.decodeAndBuffer(chunk);
    
    // Schedule this buffer to play right after the previous one, or now if it's the first.
    // This ensures gapless playback.
    this.nextStartTime = Math.max(this.nextStartTime, this.context.currentTime);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    
    // Route audio through analyser before sending to gain/output
    source.connect(this.analyser);
    this.analyser.connect(this.gainNode);

    // Clean up the source from our set once it has finished playing.
    source.addEventListener('ended', () => {
      this.sources.delete(source);
    });
    
    source.start(this.nextStartTime);

    // Update the start time for the next buffer.
    this.nextStartTime += audioBuffer.duration;
    this.sources.add(source);
  }

  /**
   * Gets the current audio volume as a normalized value (0-1).
   * @returns A number representing the average volume.
   */
  public getVolume(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.volumeDataArray);
    const average = this.volumeDataArray.reduce((acc, val) => acc + val, 0) / this.volumeDataArray.length;
    // Normalize to a 0-1 range. The average is 0-255.
    // Increased divisor from 140 to 180 to increase dynamic range and prevent constant maxing out.
    return Math.min(1, average / 180);
  }

  /**
   * Stops all currently playing and scheduled audio sources immediately.
   * This is used for interruptions or when disconnecting.
   */
  stop() {
    for (const source of this.sources.values()) {
        try {
            source.stop();
        } catch (e) {
            // It's possible the source already stopped, so we can ignore the error.
            console.warn("Could not stop audio source, it may have already finished.", e);
        }
    }
    this.sources.clear();
    this.nextStartTime = 0;
  }

  /**
   * Resumes the AudioContext if it is in a suspended state.
   * This is necessary to play audio after a user interaction.
   */
  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
}