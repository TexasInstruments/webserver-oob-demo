// Packet boundaries are transport details, not spectrogram time steps.
export class PcmWindows {
  constructor(hop = 1024) { this.hop = hop; this.reset() }
  reset() { this.pending = new Int16Array(0) }
  push(pcm, final = false) {
    const data = new Int16Array(this.pending.length + pcm.length)
    data.set(this.pending); data.set(pcm, this.pending.length)
    const frames = []
    let offset = 0
    while (offset + 1024 <= data.length) {
      frames.push(data.slice(offset, offset + 1024))
      offset += this.hop
    }
    this.pending = data.slice(offset)
    if (final && this.pending.length) {
      const tail = new Int16Array(1024)
      tail.set(this.pending); frames.push(tail); this.reset()
    }
    return frames
  }
}

// Hann-window FFT amplitude reference, shared by both plots (-80 to 0 dB).
export function magnitudeLevel(magnitude, floorDb = -80) {
  if (!Number.isFinite(floorDb) || floorDb >= 0) floorDb = -80
  if (!Number.isFinite(magnitude) || magnitude <= 0) return 0
  const db = 20 * Math.log10(magnitude / 256)
  return Math.max(0, Math.min(1, (db - floorDb) / -floorDb))
}

// Preserve all sample extrema in each pixel instead of point-sampling/aliasing.
export function waveformEnvelope(pcm, width) {
  const result = []
  if (!pcm.length) return result
  for (let x = 0; x < width; x++) {
    const start = Math.floor(x * pcm.length / width)
    const end = Math.min(pcm.length, Math.max(start + 1, Math.floor((x + 1) * pcm.length / width)))
    let min = pcm[start], max = min
    for (let i = start + 1; i < end; i++) {
      min = Math.min(min, pcm[i]); max = Math.max(max, pcm[i])
    }
    result.push({ min, max })
  }
  return result
}

export function drawWaveformEnvelope(ctx, pcm, width, height, color, zoom = 1) {
  const mid = height / 2
  const y = sample => mid - Math.max(-mid, Math.min(mid, sample / 32768 * zoom * mid))
  const envelope = waveformEnvelope(pcm, width)
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1
  for (let x = 0; x < envelope.length; x++) {
    ctx.moveTo(x + 0.5, y(envelope[x].min))
    ctx.lineTo(x + 0.5, y(envelope[x].max))
  }
  ctx.stroke()
  // Connect centers so silence and sparse samples remain visible.
  ctx.beginPath()
  for (let x = 0; x < envelope.length; x++) {
    const center = y((envelope[x].min + envelope[x].max) / 2)
    x ? ctx.lineTo(x + 0.5, center) : ctx.moveTo(x + 0.5, center)
  }
  ctx.stroke()
}

export function computeMagnitudes(int16, numBins) {
  const N = 1024
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  const len = Math.min(N, int16.length)
  for (let i = 0; i < len; i++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)))
    re[i] = (int16[i] / 32768) * w
  }
  let j = 0
  for (let i = 1; i < N; i++) {
    let bit = N >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t }
  }
  for (let half = 1; half < N; half <<= 1) {
    const ang = -Math.PI / half
    const wc = Math.cos(ang), ws = Math.sin(ang)
    for (let k = 0; k < N; k += half << 1) {
      let cr = 1, ci = 0
      for (let n = 0; n < half; n++) {
        const ur = re[k+n], ui = im[k+n]
        const vr = re[k+n+half]*cr - im[k+n+half]*ci
        const vi = re[k+n+half]*ci + im[k+n+half]*cr
        re[k+n] = ur+vr; im[k+n] = ui+vi
        re[k+n+half] = ur-vr; im[k+n+half] = ui-vi
        const tmp = cr*wc - ci*ws; ci = cr*ws + ci*wc; cr = tmp
      }
    }
  }
  const half = (N >> 1) + 1
  const mags = new Float32Array(numBins)
  for (let b = 0; b < numBins; b++) {
    let sum = 0
    const start = Math.floor(b * half / numBins)
    let end = Math.floor((b + 1) * half / numBins)
    if (end > half) end = half
    for (let k = start; k < end; k++) {
      sum += re[k]*re[k] + im[k]*im[k]
    }
    mags[b] = Math.sqrt(sum / (end - start))
  }
  return mags
}
