"use client"

/**
 * Muvx UI Sound Effects Engine
 * Generates ultra-low-latency, crystal-clear procedural audio for micro-interactions
 * using the Web Audio API. Requires zero external network requests or asset loading.
 */

class SoundEngine {
  private ctx: AudioContext | null = null
  private isMuted: boolean = false
  private lastKeyTime: number = 0
  private lastClickTime: number = 0

  constructor() {
    if (typeof window !== "undefined") {
      this.isMuted = localStorage.getItem("muvx-sound-muted") === "true"
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted
    if (typeof window !== "undefined") {
      localStorage.setItem("muvx-sound-muted", String(this.isMuted))
      window.dispatchEvent(new CustomEvent("muvx-sound-mute-change", { detail: { isMuted: this.isMuted } }))
    }
    return this.isMuted
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted
    if (typeof window !== "undefined") {
      localStorage.setItem("muvx-sound-muted", String(this.isMuted))
      window.dispatchEvent(new CustomEvent("muvx-sound-mute-change", { detail: { isMuted: this.isMuted } }))
    }
  }

  public getMuted(): boolean {
    return this.isMuted
  }

  /**
   * macOS / Apple Trackpad Haptic Click
   * Physical dual-transient: low-frequency damped actuator thud (180Hz -> 80Hz)
   * plus a subtle crisp micro-contact click (2.2kHz) lasting ~14ms.
   */
  public playTrackpadClick(volume: number = 0.09) {
    if (this.isMuted) return
    const nowMs = Date.now()
    if (nowMs - this.lastClickTime < 35) return // throttle rapid jitter
    this.lastClickTime = nowMs

    const ctx = this.getContext()
    if (!ctx) return
    const t = ctx.currentTime

    // 1. Damped haptic actuator body
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(190, t)
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.016)

    gain.gain.setValueAtTime(volume * 1.2, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.016)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(t)
    osc.stop(t + 0.016)

    // 2. Crisp micro-click transient
    const clickOsc = ctx.createOscillator()
    const clickGain = ctx.createGain()

    clickOsc.type = "triangle"
    clickOsc.frequency.setValueAtTime(2200, t)
    clickOsc.frequency.exponentialRampToValueAtTime(900, t + 0.007)

    clickGain.gain.setValueAtTime(volume * 0.45, t)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.007)

    clickOsc.connect(clickGain)
    clickGain.connect(ctx.destination)

    clickOsc.start(t)
    clickOsc.stop(t + 0.007)
  }

  /**
   * Crisp micro-tap for buttons, tabs, and menu selections
   */
  public playClick(volume: number = 0.08) {
    this.playTrackpadClick(volume)
  }

  /**
   * Soft mechanical key sound when user types in inputs / textareas.
   * Dampened acoustic tap with pitch micro-variance (+/- 25Hz) and rate-limiting.
   */
  public playKeypress(volume: number = 0.035) {
    if (this.isMuted) return
    const nowMs = Date.now()
    if (nowMs - this.lastKeyTime < 40) return // Throttled to 25 keystrokes/sec max
    this.lastKeyTime = nowMs

    const ctx = this.getContext()
    if (!ctx) return
    const t = ctx.currentTime

    // Subtle pitch variance for realistic mechanical keyboard feel
    const randomOffset = (Math.random() - 0.5) * 50
    const baseFreq = 420 + randomOffset

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    osc.type = "triangle"
    osc.frequency.setValueAtTime(baseFreq, t)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + 0.015)

    filter.type = "lowpass"
    filter.frequency.setValueAtTime(1400, t)

    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start(t)
    osc.stop(t + 0.015)
  }

  /**
   * Soft spatial pulse for dialogs, modals, and sheets opening.
   * Multi-harmonic warm swell (220Hz & 330Hz) with gentle lowpass sweep (400Hz -> 180Hz)
   * creating an expansive, luxurious spatial bloom rather than a click.
   */
  public playPulse(volume: number = 0.12) {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return
    const t = ctx.currentTime

    // 1. Warm harmonic pad (A3 220Hz + E4 330Hz)
    const freqs = [220, 330]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.22)

      filter.type = "lowpass"
      filter.frequency.setValueAtTime(450, t)
      filter.frequency.exponentialRampToValueAtTime(160, t + 0.28)

      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(volume * (idx === 0 ? 0.9 : 0.45), t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(t)
      osc.stop(t + 0.28)
    })

    // 2. Soft sub-bass presence
    const subOsc = ctx.createOscillator()
    const subGain = ctx.createGain()
    subOsc.type = "sine"
    subOsc.frequency.setValueAtTime(85, t)
    subGain.gain.setValueAtTime(0.0001, t)
    subGain.gain.linearRampToValueAtTime(volume * 0.7, t + 0.03)
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)

    subOsc.connect(subGain)
    subGain.connect(ctx.destination)

    subOsc.start(t)
    subOsc.stop(t + 0.24)
  }

  /**
   * Subtle glass confirmation chime for saving/confirming actions
   */
  public playConfirm(volume: number = 0.1) {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return
    const t = ctx.currentTime

    // Two crystal chime tones (E6 1318Hz, B6 1975Hz)
    const tones = [1318.5, 1975.5]
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, t + i * 0.035)

      gain.gain.setValueAtTime(0.0001, t + i * 0.035)
      gain.gain.linearRampToValueAtTime(volume * 0.6, t + i * 0.035 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.035 + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(t + i * 0.035)
      osc.stop(t + i * 0.035 + 0.3)
    })
  }

  /**
   * Gentle warning thud for deletes or destructive modals
   */
  public playWarning(volume: number = 0.1) {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return
    const t = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12)

    gain.gain.setValueAtTime(volume * 0.8, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(t)
    osc.stop(t + 0.12)
  }

  /**
   * Bubble pop for stars, tags, badges, and small items
   */
  public playPop(volume: number = 0.09) {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(450, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06)

    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.06)
  }

  /**
   * Harmonic celebration for success actions (dispatch, invoice, settlement, save)
   */
  public playSuccess(volume: number = 0.1) {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now + idx * 0.045)

      gain.gain.setValueAtTime(0.001, now + idx * 0.045)
      gain.gain.linearRampToValueAtTime(volume, now + idx * 0.045 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.28)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.045)
      osc.stop(now + idx * 0.045 + 0.28)
    })
  }

  /**
   * Bell chime for notifications and incoming alerts
   */
  public playBell(volume: number = 0.1) {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const freqs = [1200, 2400]

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(f, now)

      gain.gain.setValueAtTime(volume * (1 / (i + 1)), now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.5)
    })
  }

  /**
   * Subdued switch toggle
   */
  public playToggle(checked: boolean, volume: number = 0.07) {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    const startFreq = checked ? 400 : 600
    const endFreq = checked ? 650 : 350

    osc.frequency.setValueAtTime(startFreq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.04)

    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.04)
  }

  // Convenience aliases for intuitive micro-interaction calling
  public pop(volume?: number) { this.playPop(volume) }
  public click(volume?: number) { this.playClick(volume) }
  public typing(volume?: number) { this.playKeypress(volume) }
  public success(volume?: number) { this.playSuccess(volume) }
  public toggle(checked: boolean, volume?: number) { this.playToggle(checked, volume) }
  public pulse(volume?: number) { this.playPulse(volume) }
  public confirm(volume?: number) { this.playConfirm(volume) }
  public warning(volume?: number) { this.playWarning(volume) }
  public bell(volume?: number) { this.playBell(volume) }
}

export const sounds = new SoundEngine()

if (typeof window !== "undefined") {
  ;(window as any).__muvxSounds = sounds
}
