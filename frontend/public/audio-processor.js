class PCM24kProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) {
      return true;
    }

    const nextBuffer = new Float32Array(this.buffer.length + input.length);
    nextBuffer.set(this.buffer);
    nextBuffer.set(input, this.buffer.length);
    this.buffer = nextBuffer;

    while (this.buffer.length >= 4800) {
      const chunk = this.buffer.slice(0, 4800);
      this.buffer = this.buffer.slice(4800);
      const int16 = new Int16Array(chunk.length);

      for (let index = 0; index < chunk.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, chunk[index]));
        int16[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }

      this.port.postMessage(int16.buffer, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-24k-processor", PCM24kProcessor);
