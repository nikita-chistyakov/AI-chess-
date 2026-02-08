/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const VolMeterWorket = `
class VolMeter extends AudioWorkletProcessor {
    volume = 0
    updateIntervalInMS = 25
    nextUpdateFrame = 25

    constructor() {
      super()
      this.port.onmessage = event => {
        if (event.data.updateIntervalInMS) {
          this.updateIntervalInMS = event.data.updateIntervalInMS
        }
      }
    }

    get intervalInFrames() {
      return (this.updateIntervalInMS / 1000) * sampleRate
    }

    process(inputs) {
      const input = inputs[0]
      if (input.length > 0) {
        const samples = input[0]
        let sum = 0
        for (let i = 0; i < samples.length; ++i) {
          sum += samples[i] * samples[i]
        }
        const rms = Math.sqrt(sum / samples.length)
        this.volume = Math.max(rms, this.volume * 0.7)

        this.nextUpdateFrame -= samples.length
        if (this.nextUpdateFrame < 0) {
          this.nextUpdateFrame += this.intervalInFrames
          this.port.postMessage({volume: this.volume})
        }
      }
      return true
    }
  }`;

export default VolMeterWorket;
