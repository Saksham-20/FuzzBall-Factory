import math
COCOA="#3f2619"; ROSE="#c98586"; ROSED="#9c4f55"; WASH="#f3dcd8"; BG="#ffffff"
X0,Y0=52,46
# F glyph, origin = stem left/top. ligature: F1 arm runs into F2
def F(beak=True, arm_to=70):
    top = f"M -14 0 H {arm_to}" + (" V 30 H 64.5 V 6" if beak else " V 6")
    return (top + " H 32 Q 22 6 22 18 V 52 H 46 V 42 H 51.5 V 66 H 46 V 58 H 30 Q 22 58 22 68 V 108 "
            "Q 22 114 30 114 H 46 V 120 H -24 V 114 H -8 Q 0 114 0 106 V 14 Q 0 6 -8 6 H -14 Z")
f1=f'<path transform="translate({X0} {Y0})" d="{F(beak=False,arm_to=92)}"/>'
f2=f'<path transform="translate({X0+92} {Y0})" d="{F()}"/>'
# yarn ball in crook of F1
bx,by,r=X0+60,Y0+90,19
ball=f'''<clipPath id="bc"><circle cx="{bx}" cy="{by}" r="{r}"/></clipPath>
<circle cx="{bx}" cy="{by}" r="{r}" fill="{ROSE}"/>
<g clip-path="url(#bc)" fill="none" stroke-linecap="round">
<circle cx="{bx+9}" cy="{by+9}" r="{r+3}" stroke="{ROSED}" stroke-width="9" opacity=".6"/>
<g stroke="{WASH}" stroke-width="1.8"><path d="M{bx-24} {by-2} Q{bx} {by+12} {bx+24} {by-12}"/><path d="M{bx-24} {by+8} Q{bx} {by+22} {bx+24} {by-2}"/><path d="M{bx-24} {by-12} Q{bx} {by+2} {bx+24} {by-22}"/><path d="M{bx-24} {by+18} Q{bx} {by+32} {bx+24} {by+8}"/></g></g>'''
# thread: from ball down and across under F2 into a small heart with crossing
def H(t,s,cx,cy):
    return (cx+s*16*math.sin(t)**3, cy-s*(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)))
def unit(v):
    l=math.hypot(*v); return (v[0]/l,v[1]/l)
def cub(p0,p1,p2,p3,n=50):
    return [tuple(((1-u)**3*p0[i]+3*u*(1-u)**2*p1[i]+3*u*u*(1-u)*p2[i]+u**3*p3[i]) for i in (0,1)) for u in [k/n for k in range(n+1)]]
s=1.7; hx,hy=214,176
P=H(math.pi,s,hx,hy); e=0.03
d_r=unit((H(math.pi-e,s,hx,hy)[0]-P[0],H(math.pi-e,s,hx,hy)[1]-P[1]))
d_l=unit((P[0]-H(math.pi+e,s,hx,hy)[0],P[1]-H(math.pi+e,s,hx,hy)[1]))
tt=0.5
def dH(t):
    a=H(t+1e-4,s,hx,hy);b=H(t-1e-4,s,hx,hy);return unit((-(a[0]-b[0]),-(a[1]-b[1])))
N=300
ts=[math.pi-2*math.pi*i/N for i in range(N+1)]
heart=[H(t,s,hx,hy) for t in ts if t>=tt]
A=H(tt,s,hx,hy);B=H(-tt,s,hx,hy);ta=dH(tt);tb=dH(-tt);k=4.5
heart+=cub(A,(A[0]+k*ta[0],A[1]+k*ta[1]),(B[0]-k*tb[0],B[1]-k*tb[1]),B,20)[1:]
heart+=[H(t,s,hx,hy) for t in ts if t<-tt]
start=(bx-1,by+r-1)
tail1=cub(start,(bx-3,by+52),(P[0]-84,P[1]+34),(P[0]-16*d_r[0],P[1]-16*d_r[1]))
tail1+=[P]
end=(P[0]+20*d_l[0]+4,P[1]+20*d_l[1]+3)
def path(pl): return "M"+" L".join(f"{x:.1f} {y:.1f}" for x,y in pl)
w=5.6
allp=tail1+heart+[end]
second=heart[-38:]+[end]
thread=f'''<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="{path(allp)}" stroke="{ROSE}" stroke-width="{w}"/>
<path d="{path(second)}" stroke="{BG}" stroke-width="{w+3}"/><path d="{path(second)}" stroke="{ROSE}" stroke-width="{w}"/></g>'''
svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>FF Ligature</title><g fill="{COCOA}">{f1}{f2}</g>{ball}{thread}</svg>'
open("b.svg","w").write(svg)
