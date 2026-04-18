"""
Generate a short 'sad streak' tone (original, no external license).
Run from repo: python mobile/scripts/generate_streak_break_sound.py
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds" / "streak-break-sad.wav"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 22050
    duration_s = 0.85
    n = int(sample_rate * duration_s)
    freq_start = 380
    freq_end = 120

    with wave.open(str(OUT), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        for i in range(n):
            t = i / sample_rate
            env = (1.0 - i / max(n - 1, 1)) ** 1.2
            freq = freq_start + (freq_end - freq_start) * (i / n)
            sample = 0.22 * math.sin(2 * math.pi * freq * t)
            sample *= env
            val = int(max(-32767, min(32767, sample * 32767)))
            w.writeframes(struct.pack("<h", val))

    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
