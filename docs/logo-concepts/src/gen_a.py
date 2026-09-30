import math
COCOA="#3f2619"; ROSE="#c98586"; ROSED="#9c4f55"; BG="#ffffff"
s=4.9; cx=100; cy=100
def H(t):
    x=16*math.sin(t)**3
    y=-(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))
    return (cx+s*x, cy+s*y)
def unit(v):
    l=math.hypot(*v); return (v[0]/l,v[1]/l)
e=0.03
# right branch leaves cusp going up: t=pi-> decreasing
P=H(math.pi)
d_r=unit((H(math.pi-e)[0]-H(math.pi-3*e)[0]*0-P[0], H(math.pi-e)[1]-P[1]))   # direction leaving cusp along right branch (t decreasing)
d_l=unit((P[0]-H(math.pi+e)[0], P[1]-H(math.pi+e)[1]))                        # direction arriving at cusp along left branch (t increasing)
pts=[]
# left tail (cubic) F -> P arriving along d_r
F=(10,214)
c1=(F[0]+70,F[1]+6); c2=(P[0]-46*d_r[0],P[1]-46*d_r[1])
def cub(p0,p1,p2,p3,n=60):
    out=[]
    for i in range(n+1):
        u=i/n; a=(1-u)**3; b=3*u*(1-u)**2; c=3*u*u*(1-u); d=u**3
        out.append((a*p0[0]+b*p1[0]+c*p2[0]+d*p3[0], a*p0[1]+b*p1[1]+c*p2[1]+d*p3[1]))
    return out
tail1=cub(F,c1,c2,P)
# heart: t from pi down to 0 (right branch), 0..-pi... i.e. t: pi -> -pi
N=400
def dH(t,h=1e-4):
    a=H(t+h); b=H(t-h); return unit((-(a[0]-b[0]),-(a[1]-b[1])))  # travel direction (t decreasing)
tt=0.42
heart=[]
for i in range(N+1):
    t=math.pi-2*math.pi*i/N
    if abs(t)>=tt: heart.append(H(t))
    elif t>0 and not any(abs(q[2])<9 for q in [(0,0,10)]): pass
# rebuild with bridge
heart=[H(math.pi-2*math.pi*i/N) for i in range(N+1) if (math.pi-2*math.pi*i/N)>=tt]
A=H(tt); B=H(-tt); ta=dH(tt); tb=dH(-tt); k=15
heart+=cub(A,(A[0]+k*ta[0],A[1]+k*ta[1]),(B[0]-k*tb[0],B[1]-k*tb[1]),B,30)[1:]
heart+=[H(math.pi-2*math.pi*i/N) for i in range(N+1) if (math.pi-2*math.pi*i/N)<-tt]
W=(212,118)
c1=(P[0]+58*d_l[0],P[1]+58*d_l[1]); c2=(W[0]-52,W[1]+66)
tail2=cub(P,c1,c2,W)
def path(pl): return "M"+" L".join(f"{x:.1f} {y:.1f}" for x,y in pl)
th=path(tail1[:-1]+heart+tail2[1:])
w=8.5
# hook
HOOK="M 4 3.5 Q -0.5 3.5 -0.5 -0.5 Q -0.5 -4.5 4 -4.5 L 6 -4.5 Q 11 -4.5 11 -0.8 L 12 -0.8 Q 17 -0.8 19 -3.5 L 68 -3.5 Q 70 -5 73 -5 L 86 -5 Q 88 -4 90 -4 L 128 -4 Q 132 -4 132 0 Q 132 4 128 4 L 90 4 Q 88 4 86 5 L 73 5 Q 70 5 68 3.5 Z"
ang=78; sc=1.45; tip=(196,44)
hook=f'<g transform="translate({tip[0]} {tip[1]}) rotate({ang}) scale({sc})"><path d="{HOOK}" fill="{COCOA}"/></g>'
# wraps around rod
dirv=(math.cos(math.radians(ang)),math.sin(math.radians(ang))); nv=(-dirv[1],dirv[0])
wraps=""
for k in range(2):
    o=36+k*7
    cxp=tip[0]+dirv[0]*o*sc; cyp=tip[1]+dirv[1]*o*sc
    a=(cxp-nv[0]*8.5-dirv[0]*5, cyp-nv[1]*8.5-dirv[1]*5); b=(cxp+nv[0]*8.5+dirv[0]*5, cyp+nv[1]*8.5+dirv[1]*5)
    wraps+=f'<path d="M{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f}" stroke="{BG}" stroke-width="{w+3.5}" stroke-linecap="round"/><path d="M{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f}" stroke="{ROSE}" stroke-width="{w}" stroke-linecap="round"/>'
# crossing: draw tail1+heart first, then second pass over: split at index
idx_first=len(tail1)-1
i_mid=idx_first+N-40
p1=path(tail1[:-1]+heart[:-30]); p2=path(heart[-60:]+tail2[1:])
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke-linecap="round" stroke-linejoin="round"><title>Thread Heart</title>
{hook}
<path d="{th}" stroke="{ROSE}" stroke-width="{w}"/>
<path d="{path(heart[-46:]+tail2[1:])}" stroke="{BG}" stroke-width="{w+4}"/>
<path d="{path(heart[-46:]+tail2[1:])}" stroke="{ROSE}" stroke-width="{w}"/>
{wraps}
</svg>'''
open("a.svg","w").write(svg)
