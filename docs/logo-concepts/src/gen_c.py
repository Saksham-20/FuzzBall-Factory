import math
COCOA="#3f2619"; ROSE="#c98586"; ROSED="#9c4f55"; WASH="#f3dcd8"; BG="#ffffff"
cx,cy,R=118,128,86
rows=""
sp=21; rh=15
k=0
y=-R+6
while y<R:
    half=math.sqrt(max(R*R-y*y,0))
    off=(sp/2 if k%2 else 0)
    x=-half-sp+off
    while x<half+sp:
        # V narrows toward the sides like a sphere
        sx=max(0.45,math.sqrt(max(1-(x/R)**2,0)))
        wv=6.2*sx+1.2
        rows+=f'M{cx+x-wv:.1f} {cy+y-7:.1f} L{cx+x:.1f} {cy+y+5.5:.1f} L{cx+x+wv:.1f} {cy+y-7:.1f} '
        x+=sp*(0.62+0.38*sx)
    y+=rh; k+=1
ball=f'''<clipPath id="bc"><circle cx="{cx}" cy="{cy}" r="{R}"/></clipPath>
<circle cx="{cx}" cy="{cy}" r="{R}" fill="{ROSE}"/>
<g clip-path="url(#bc)">
<circle cx="{cx+34}" cy="{cy+38}" r="{R+30}" fill="none" stroke="{ROSED}" stroke-width="56" opacity=".38"/>
<path d="{rows}" fill="none" stroke="{ROSED}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="{rows}" fill="none" stroke="{WASH}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -1.6)" opacity=".85"/>
</g>'''
HOOK="M 4 3.5 Q -0.5 3.5 -0.5 -0.5 Q -0.5 -4.5 4 -4.5 L 6 -4.5 Q 11 -4.5 11 -0.8 L 12 -0.8 Q 17 -0.8 19 -3.5 L 68 -3.5 Q 70 -5 73 -5 L 86 -5 Q 88 -4 90 -4 L 128 -4 Q 132 -4 132 0 Q 132 4 128 4 L 90 4 Q 88 4 86 5 L 73 5 Q 70 5 68 3.5 Z"
hook=f'<g transform="translate(132 146) rotate(-50) scale(1.25)"><path d="{HOOK}" fill="{COCOA}" stroke="{BG}" stroke-width="2.2" paint-order="stroke"/></g>'
tail=f'<path d="M{cx-50} {cy+70} C{cx-60} {cy+100} {cx-100} {cy+108} {cx-112} {cy+84} C{cx-120} {cy+68} {cx-100} {cy+60} {cx-92} {cy+74}" fill="none" stroke="{ROSE}" stroke-width="9" stroke-linecap="round"/>'
svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>Stitch Ball</title>{tail}{ball}{hook}</svg>'
open("c.svg","w").write(svg)
