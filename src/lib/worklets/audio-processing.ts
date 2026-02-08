/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const AudioRecordingWorklet = `
class AudioProcessingWorklet extends AudioWorkletProcessor {
  buffer = new Int16Array(2048);
  bufferWriteIndex = 0;

  constructor() {
    super();
  }

  process(inputs) {
    if (inputs[0]?.[0]) {
      this.processChunk(inputs[0][0]);
    }
    return true;
  }

  sendAndClearBuffer() {
    if (this.bufferWriteIndex > 0) {
      this.port.postMessage({
        event: "chunk",
        data: {
          int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
        },
      });
      this.bufferWriteIndex = 0;
    }
  }

  processChunk(float32Array) {
    for (let i = 0; i < float32Array.length; i++) {
      const int16Value = Math.max(-32768, Math.min(32767, float32Array[i] * 32768));
      this.buffer[this.bufferWriteIndex++] = int16Value;
      if (this.bufferWriteIndex >= this.buffer.length) {
        this.sendAndClearBuffer();
      }
    }
  }
}
`;

export default AudioRecordingWorklet;
