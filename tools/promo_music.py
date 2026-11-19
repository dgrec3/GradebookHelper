"""Royalty-free music bed for the promo Reels, synthesized with numpy only.

Style: upbeat modern pop / "tech promo": electric piano chords, warm pad,
sub bass, punchy drums, reverb, sidechain pump, compression + limiter.
Key F major / D minor, progression Dm9 - Bbmaj7 - F/A - Csus4 (one bar each).

Timing: 120 BPM = one beat every 0.5 s. Every scene cut in the video sits on
a half-second mark, so every cut lands on a beat. The musical grid is shifted
so the drop (first full beat with drums) is exactly the color wipe (3.5 s).

Why this replaced the first two attempts (see STRATEGIES_THAT_WONT_WORK.md):
a sine-pluck arpeggio in C major sounded childish, and raw unfiltered saws
with noise hats sounded harsh. Real-instrument techniques (FM electric piano,
filtered detuned pad, pitched kick, band-passed snare, reverb, bus
compression) are what make a synthesized track sound produced.

Usage: from promo_music import render_music; render_music(path, seconds, cues)
"""
import wave
from pathlib import Path

import numpy as np

RATE = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# Chord voicings (MIDI notes), one bar each, plus the bass root.
CHORDS = [
    ([50, 57, 60, 64, 65], 38),   # Dm9  (D A C E F)
    ([46, 53, 57, 62, 65], 34),   # Bbmaj7 (Bb F A D F)
    ([45, 53, 57, 60, 67], 41),   # F/A add9 (A F A C G)
    ([48, 53, 55, 60, 65], 36),   # Csus4 (C F G C F)
]
# Hook for the electric-piano top line: (beat within 2-bar phrase, MIDI note, length in beats).
HOOK = [(0, 72, 0.5), (0.75, 74, 0.5), (1.5, 77, 1.0), (3, 76, 0.5), (3.5, 74, 0.5),
        (4, 72, 0.75), (5, 69, 0.5), (5.5, 72, 1.5), (7.5, 74, 0.5)]


# ---------- DSP helpers (numpy only) ----------

def env(n, attack, decay, sustain=0.0, release=None):
    """Attack / exponential decay envelope of n samples (seconds for times)."""
    x = np.arange(n) / RATE
    e = np.minimum(x / max(attack, 1e-4), 1.0) * (sustain + (1 - sustain) * np.exp(-x / decay))
    if release:
        r = int(release * RATE)
        if r < n:
            e[-r:] *= np.linspace(1, 0, r)
    return e


def fft_filter(x, low=None, high=None, order=2):
    """Zero-phase low/high-pass in the frequency domain (whole buffer)."""
    spectrum = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    gain = np.ones_like(f)
    if low:
        gain *= 1 / np.sqrt(1 + (f / low) ** (2 * order))
    if high:
        gain *= 1 / np.sqrt(1 + (np.maximum(f, 1e-3) / high) ** (-2 * order))
    if x.ndim == 2:
        gain = gain[:, None]
    return np.fft.irfft(spectrum * gain, n=len(x), axis=0)


def fft_convolve(x, ir):
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)
    return y[:len(x)]


def reverb(stereo, seconds=1.8, mix=0.25, seed=3):
    """Simple convolution reverb: decaying, darkened stereo noise impulse."""
    rng = np.random.default_rng(seed)
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    out = np.zeros_like(stereo)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 6.9)) * np.minimum(t / 0.01, 1)
        ir = fft_filter(ir, low=6000, high=200)
        ir[: int(0.02 * RATE)] *= np.linspace(0, 1, int(0.02 * RATE))  # 20 ms pre-delay feel
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = fft_convolve(stereo[:, ch], ir)
    return stereo + mix * out


class Track:
    """A stereo buffer we add notes into at given times."""

    def __init__(self, seconds):
        self.n = int(seconds * RATE)
        self.buf = np.zeros((self.n, 2))

    def add(self, start, mono, gain=1.0, pan=0.0):
        k = int(round(start * RATE))
        if k >= self.n or k + len(mono) <= 0:
            return
        if k < 0:
            mono, k = mono[-k:], 0
        mono = mono[: self.n - k]
        left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.buf[k:k + len(mono), 0] += mono * gain * left
        self.buf[k:k + len(mono), 1] += mono * gain * right


# ---------- instruments ----------

def e_piano(freq, length, velocity=1.0):
    """FM electric piano (Rhodes-style): 1:1 carrier/modulator with a
    decaying index, plus a quiet bell partial (ratio 14) for the tine."""
    n = int(length * RATE)
    t = np.arange(n) / RATE
    index = 1.8 * velocity * np.exp(-t / 0.35) + 0.25
    body = np.sin(2 * np.pi * freq * t + index * np.sin(2 * np.pi * freq * t))
    tine = 0.12 * velocity * np.sin(2 * np.pi * freq * 14 * t) * np.exp(-t / 0.05)
    return (body + tine) * env(n, 0.003, 1.2, 0.0, release=0.08) * (0.6 + 0.4 * velocity)


def pad(freqs, length):
    """Warm pad: 5 detuned band-limited saws per note, darkened, slow attack."""
    n = int(length * RATE)
    t = np.arange(n) / RATE
    out = np.zeros(n)
    for f in freqs:
        for detune in (-0.012, -0.006, 0.0, 0.006, 0.012):
            ff = f * (1 + detune)
            harmonics = min(14, int(9000 / ff))
            phase = np.random.default_rng(int(ff * 1000)).uniform(0, 2 * np.pi)
            out += sum(np.sin(2 * np.pi * ff * h * t + phase * h) / h ** 1.4 for h in range(1, harmonics + 1))
    return out * env(n, 0.25, 10, 1.0, release=0.25) / (5 * len(freqs))


def sub_bass(freq, length):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) + 0.12 * np.sin(6 * np.pi * freq * t)
    return np.tanh(1.4 * tone) * env(n, 0.004, 0.6, 0.6, release=0.03)


def kick():
    n = int(0.45 * RATE)
    t = np.arange(n) / RATE
    pitch = 48 + 130 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(pitch) / RATE) * env(n, 0.001, 0.22)
    click = np.random.default_rng(1).standard_normal(n) * np.exp(-t / 0.002) * 0.3
    return np.tanh(1.8 * (body + fft_filter(click, low=5000)))


def snare():
    n = int(0.35 * RATE)
    t = np.arange(n) / RATE
    noise = fft_filter(np.random.default_rng(2).standard_normal(n), low=9000, high=1200) * env(n, 0.001, 0.09)
    tone = (np.sin(2 * np.pi * 185 * t) + 0.5 * np.sin(2 * np.pi * 330 * t)) * env(n, 0.001, 0.04)
    clap = np.zeros(n)
    rng = np.random.default_rng(5)
    for delay in (0.0, 0.011, 0.022):  # three quick bursts = hand clap
        k = int(delay * RATE)
        burst = fft_filter(rng.standard_normal(n - k), low=6000, high=900) * env(n - k, 0.0005, 0.012 if delay < 0.02 else 0.07)
        clap[k:] += burst
    return 0.9 * noise / np.abs(noise).max() + 0.5 * tone + 0.6 * clap / np.abs(clap).max()


def hat(open_=False, seed=0):
    n = int((0.25 if open_ else 0.06) * RATE)
    noise = np.random.default_rng(10 + seed).standard_normal(n)
    noise = fft_filter(noise, high=7500, order=3)
    return noise / np.abs(noise).max() * env(n, 0.0005, 0.09 if open_ else 0.018)


def crash():
    n = int(2.5 * RATE)
    noise = fft_filter(np.random.default_rng(7).standard_normal(n), high=4000, low=14000)
    return noise / np.abs(noise).max() * env(n, 0.001, 0.7)


def boom():
    n = int(2.0 * RATE)
    t = np.arange(n) / RATE
    return np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / RATE) * env(n, 0.002, 0.6)


def riser(length):
    """Noise swell whose brightness rises (overlap-add of filtered blocks)."""
    n = int(length * RATE)
    noise = np.random.default_rng(9).standard_normal(n)
    out = np.zeros(n)
    block = int(0.08 * RATE)
    window = np.hanning(block * 2)
    for start in range(0, n, block):
        seg = noise[start:start + block * 2]
        if len(seg) < 32:
            break
        cutoff = 300 + 9000 * (start / n) ** 2
        out[start:start + len(seg)] += fft_filter(seg, low=cutoff) * window[: len(seg)]
    return out / np.abs(out).max() * np.linspace(0, 1, n) ** 2


# ---------- arrangement ----------

def render_music(path: Path, seconds: float, drop: float = 3.5, breakdown=None, outro=None):
    """Writes a 16-bit stereo WAV.

    drop       time of the first full beat (the color wipe)
    breakdown  (start, end): drums out, pads + piano only (e.g. the privacy scene)
    outro      time of the final hit; after it only the last chord rings out
    """
    grid0 = drop - 2 * BAR  # bars are counted so a downbeat lands exactly on the drop
    outro = outro if outro is not None else seconds - 2.5
    music = Track(seconds)
    keys = Track(seconds)        # piano + pad (sidechained, reverb)
    lead = Track(seconds)        # hook (reverb + delay)
    bass = Track(seconds)        # sidechained
    drums = Track(seconds)
    fx = Track(seconds)

    def bar_start(i):
        return grid0 + i * BAR

    in_break = (lambda tt: breakdown is not None and breakdown[0] <= tt < breakdown[1])
    k_kick, k_snare, k_crash, k_boom = kick(), snare(), crash(), boom()
    hats_closed = [hat(False, s) for s in range(4)]
    hat_open = hat(True)

    bars = int((seconds - grid0) / BAR) + 2
    for i in range(bars):
        s = bar_start(i)
        if s >= seconds:
            break
        notes, root = CHORDS[i % 4]
        after_drop = s >= drop - 1e-6
        if s >= outro:
            break
        # Pad: whole bar.
        keys.add(s, pad([midi(n) for n in notes[1:]], BAR + 0.3), 0.36)
        # Electric piano: chord stabs on 1, the "and" of 2, and 4 (a pop rhythm).
        for beat_pos, vel in ((0, 1.0), (1.5, 0.7), (3, 0.8)) if after_drop else ((0, 0.8),):
            for j, nn in enumerate(notes[1:]):
                keys.add(s + beat_pos * BEAT + j * 0.006, e_piano(midi(nn), 1.6, vel), 0.17, pan=(j - 1.5) * 0.25)
        if not after_drop:
            continue
        # Hook every other 2-bar phrase while drums play (sections 2 and 4 of each 8 bars).
        phrase = (i // 2) % 4
        if phrase in (1, 3) and not in_break(s) and i % 2 == 0:
            for beat_pos, nn, length in HOOK:
                lead.add(s + beat_pos * BEAT, e_piano(midi(nn), length * BEAT + 0.4, 0.9), 0.24, pan=0.1)
        # Bass: 16th-note pop pattern on the root.
        if not in_break(s):
            for step in (0, 3, 6, 10, 13):
                bass.add(s + step * BEAT / 4, sub_bass(midi(root), BEAT * 0.7), 0.28)
        # Drums.
        for b in range(4):
            tb = s + b * BEAT
            if in_break(tb) or tb >= outro:
                continue
            drums.add(tb, k_kick, 0.55)
            if b in (1, 3):
                drums.add(tb, k_snare, 0.6)
            drums.add(tb + BEAT / 2, hat_open if b % 2 else hats_closed[b], 0.2 if b % 2 else 0.22, pan=0.25)
            for q in (0.25, 0.75):
                drums.add(tb + q * BEAT, hats_closed[(b + int(q * 4)) % 4], 0.11, pan=-0.25)
        # Snare fill at the end of every 4th bar (leads into the next section).
        if i % 4 == 3 and not in_break(s + 3 * BEAT):
            for q in range(4):
                drums.add(s + 3 * BEAT + q * BEAT / 4, k_snare, 0.18 + 0.08 * q)

    # FX: riser into the drop, crash + boom on the drop, riser into the outro hit.
    fx.add(drop - 2.0, riser(2.0), 0.22)
    fx.add(drop, k_crash, 0.22)
    fx.add(drop, k_boom, 0.3)
    if breakdown:
        fx.add(breakdown[1] - 1.5, riser(1.5), 0.18)
    fx.add(outro, k_crash, 0.25)
    fx.add(outro, k_boom, 0.32)
    # Final chord rings out after the outro hit.
    notes, _ = CHORDS[2]
    keys.add(outro, pad([midi(n) for n in notes[1:]], seconds - outro), 0.35)
    for j, nn in enumerate(notes):
        keys.add(outro + j * 0.02, e_piano(midi(nn), seconds - outro, 1.0), 0.12, pan=(j - 2) * 0.2)

    # Sidechain pump: keys and bass duck on each kick after the drop.
    t = np.arange(music.n) / RATE
    since = np.mod(t - drop, BEAT)
    pump = 1 - 0.55 * np.exp(-since / 0.08)
    pump[t < drop] = 1.0
    if breakdown:
        pump[(t >= breakdown[0]) & (t < breakdown[1])] = 1.0
    pump[t >= outro] = 1.0
    keys.buf *= pump[:, None]
    bass.buf *= pump[:, None]

    # Intro: piano and pad muffled until the drop, then open up.
    intro = int(drop * RATE)
    keys.buf[:intro] = 1.8 * fft_filter(keys.buf[:intro], low=1200)

    # Dotted-eighth delay on the hook.
    delayed = np.zeros_like(lead.buf)
    d = int(0.75 * BEAT * RATE)
    delayed[d:, 1] += 0.35 * lead.buf[:-d, 0]
    delayed[2 * d:, 0] += 0.2 * lead.buf[:-2 * d, 1]
    lead.buf += delayed

    music.buf = (reverb(keys.buf, 2.2, 0.35) + reverb(lead.buf, 2.0, 0.4)
                 + fft_filter(bass.buf, low=900) + reverb(drums.buf, 1.0, 0.12) + reverb(fx.buf, 2.5, 0.3))

    # Master: gentle bus compression (RMS follower), then a soft limiter.
    mono = music.buf.mean(axis=1)
    win = int(0.03 * RATE)
    rms = np.sqrt(np.convolve(mono ** 2, np.ones(win) / win, mode="same") + 1e-9)
    threshold = np.percentile(rms[rms > 1e-4], 70) if np.any(rms > 1e-4) else 1.0
    gain = np.where(rms > threshold, (threshold / rms) ** (1 - 1 / 2.5), 1.0)
    gain = np.convolve(gain, np.ones(int(0.05 * RATE)) / int(0.05 * RATE), mode="same")
    master = music.buf * gain[:, None]
    master = fft_filter(master, high=38)  # remove sub-rumble phones can't play anyway
    master /= np.abs(master).max() + 1e-9
    master = np.tanh(master * 1.5) / np.tanh(1.5) * 0.89   # soft limit, peak about -1 dBFS
    fade = np.minimum(1, (seconds - t) / 1.2) * np.minimum(1, t / 0.02)
    master *= fade[:, None]

    pcm = (np.clip(master, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.ravel().tobytes())
    return master
