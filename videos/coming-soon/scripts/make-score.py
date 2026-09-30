"""Synthesises the coming-soon score: kalimba notes tied to on-screen beats + soft foley. Deterministic (seeded)."""
import math, random, struct, wave

SR = 44100
DUR = 12.0
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N
rnd = random.Random(7)

def note_f(name):
    names = {"C": 0, "D": 2, "E": 4, "G": 7, "A": 9, "B": 11}
    n, o = name[0], int(name[1])
    return 440.0 * 2 ** (((o - 4) * 12 + names[n] - 9) / 12)

def add(t0, samples, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    gl = gain * (1 - max(0, pan)) ; gr = gain * (1 + min(0, pan))
    for i, s in enumerate(samples):
        j = i0 + i
        if j >= N: break
        L[j] += s * gl; R[j] += s * gr

def kalimba(name, dur=1.4, vel=1.0):
    f = note_f(name)
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        env = min(1, t / 0.003) * math.exp(-t / 0.42)
        tine = math.sin(2*math.pi*f*t) + 0.28*math.sin(2*math.pi*f*2.01*t)*math.exp(-t/0.12) + 0.14*math.sin(2*math.pi*f*5.4*t)*math.exp(-t/0.05)
        out.append(tine * env * 0.32 * vel)
    return out

def noise_band(dur, lo0, lo1, amp, attack=0.05, release=0.3, hp=0.0):
    """Swept low-pass noise = whoosh / yarn pull."""
    out = []; y = 0.0; yh = 0.0
    n = int(dur * SR)
    for i in range(n):
        t = i / n
        a = 1 - math.exp(-2 * math.pi * (lo0 + (lo1 - lo0) * t) / SR)
        x = rnd.uniform(-1, 1)
        y += a * (x - y)
        v = y
        if hp:
            yh += hp * (v - yh); v = v - yh
        e = min(1, (i / SR) / attack) * min(1, (dur - i / SR) / release)
        out.append(v * e * amp)
    return out

def thump(dur=0.5):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        f = 55 + 70 * math.exp(-t / 0.03)
        body = math.sin(2*math.pi*f*t) * math.exp(-t / 0.11)
        click = rnd.uniform(-1, 1) * math.exp(-t / 0.006) * 0.5
        out.append((body * 0.9 + click) * 0.8)
    return out

def pop(dur=0.16):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        f = 260 + 900 * (t / dur)
        out.append(math.sin(2*math.pi*f*t) * math.exp(-t / 0.035) * 0.5)
    return out

def tick(dur=0.05):
    return [math.sin(2*math.pi*1800*(i/SR)) * math.exp(-(i/SR) / 0.008) * 0.25 for i in range(int(dur * SR))]

def rip(dur=0.4):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        gate = 1.0 if rnd.random() < 0.55 + 0.4 * math.exp(-t / 0.1) else 0.15
        out.append(rnd.uniform(-1, 1) * gate * math.exp(-t / 0.18) * 0.28)
    return out

# ── foley, timed to the composition ──
add(0.15, noise_band(2.4, 1500, 4200, 0.05, 0.4, 0.6, hp=0.05), pan=0.2)          # yarn pull as the thread draws
add(0.50, kalimba("G4", 1.6, 0.7))                                                 # headline rise
add(2.6, noise_band(1.0, 500, 3200, 0.11, 0.2, 0.5), pan=-0.1)                     # camera whoosh 1
add(4.95, noise_band(1.05, 500, 3200, 0.11, 0.2, 0.5), pan=-0.1)                   # camera whoosh 2
add(8.55, noise_band(0.95, 500, 3600, 0.12, 0.2, 0.45), pan=-0.1)                  # camera whoosh 3
# station nodes: an ascending phrase
for t, n in [(3.26, "C5"), (3.98, "E5"), (4.70, "G5")]:
    add(t, tick(), 1.0); add(t, kalimba(n, 1.5, 1.0))
add(3.98, noise_band(0.5, 900, 2600, 0.09, 0.02, 0.35, hp=0.08), pan=0.3)           # ticket swing
add(5.70, pop(), 0.9)                                                             # ball pops in
add(5.70, kalimba("C4", 1.8, 0.8))
add(6.50, kalimba("E4", 1.8, 0.8)); add(6.50, kalimba("G4", 1.8, 0.6))              # "Fuzzballs"
add(6.75, noise_band(0.4, 1500, 5200, 0.07, 0.05, 0.25), pan=0.25)                 # highlighter swipe
for t, n in [(7.55, "A5"), (7.71, "G5"), (7.87, "E5")]:                            # "…" three dots: a question
    add(t, kalimba(n, 1.2, 0.75))
add(7.15, noise_band(1.5, 800, 2200, 0.05, 0.4, 0.6, hp=0.05), pan=-0.3)           # tail unspools
add(9.79, thump(), 1.0)                                                           # COMING SOON stamp
add(9.90, noise_band(0.9, 1200, 6000, 0.05, 0.1, 0.5), pan=0.1)                   # logo shimmer bed
for k, n in enumerate(["C5", "E5", "G5", "C6"]):                                  # logo arpeggio
    add(9.95 + k * 0.11, kalimba(n, 2.2, 0.85))
add(10.40, rip(), 0.9, pan=0.2)                                                   # tape rip
add(10.90, kalimba("G5", 1.2, 0.55)); add(10.90, tick(), 0.6)                      # handle lands
add(11.05, kalimba("C4", 1.0, 0.5))

peak = max(max(abs(x) for x in L), max(abs(x) for x in R)) or 1
g = 0.7 / peak
fade = int(0.5 * SR)
with wave.open("assets/audio/score.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    frames = bytearray()
    for i in range(N):
        f = 1.0 if i < N - fade else (N - i) / fade
        frames += struct.pack("<hh", int(max(-1, min(1, L[i] * g * f)) * 32767), int(max(-1, min(1, R[i] * g * f)) * 32767))
    w.writeframes(bytes(frames))
print("score.wav written", DUR, "s")
