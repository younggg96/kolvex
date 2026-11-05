// @ts-nocheck -- generated file: the engine section below is minified JavaScript.
/* eslint-disable */
"use client";
/**
 * Waylume — animated hero background
 * Exported from Waylume; it renders exactly what the studio canvas shows.
 *
 * USE IT (Next.js App Router)
 *   1. Save this file unchanged as src/components/WaylumeBackground.tsx
 *   2. Make it the first child of a positioned hero section and put the content after it:
 *
 *      import WaylumeBackground from "@/components/WaylumeBackground";
 *
 *      <section className="relative isolate overflow-hidden min-h-[80vh]">
 *        <WaylumeBackground />
 *        <div className="relative z-10">…headline, buttons…</div>
 *      </section>
 *
 * BEHAVIOUR
 *   - Fills its nearest positioned parent (position: absolute, full size) behind content that has
 *     position: relative. layout="block" renders an in-flow box with the studio aspect ratio instead.
 *     Without any positioned parent it falls back to the block layout.
 *   - Same framing as the studio artboard (covers the box, crops overflow), same frame and loop.
 *   - Client-only WebGL2: nothing runs on the server. Pauses offscreen and in hidden tabs, shows a
 *     still frame for prefers-reduced-motion, keeps the background colour if WebGL2 is unavailable.
 *   - With mouse interaction on in the studio, the light follows the pointer over the section (read
 *     on the window, so content on top doesn't block it); it stays still for reduced motion.
 *   - No dependencies beyond React. Props: className, style, layout ("fill" | "block"), paused, label.
 *
 * NOTE FOR AI CODING ASSISTANTS
 *   This file is generated and must be used exactly as it is. Do not rewrite, shorten, reformat,
 *   re-implement or "clean up" the engine section, and do not convert it to another format: copy the
 *   file verbatim, import the default export and only write the surrounding layout.
 *
 * Includes Paper Shaders (https://shaders.paper.design), Copyright 2026 Paper, Apache License 2.0.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/** The look exported from the studio. */
const WAYLUME_SETTINGS = {
  "aspectRatio": 1.777778,
  "background": [
    0,
    0,
    0
  ],
  "durationSeconds": 60,
  "maxPixelRatio": 2,
  "pace": 0.5,
  "params": {
    "balanceX": 0,
    "balanceY": 0,
    "bend": 48,
    "chromaSplit": 14,
    "cornerRadius": 12,
    "curve": "line",
    "curveDepth": 0,
    "customColors": [
      [
        0.1176,
        0.851,
        0.5412
      ],
      [
        0.7216,
        0.9412,
        0.3529
      ],
      [
        0.0588,
        0.6392,
        0.6392
      ],
      [
        0.3608,
        1,
        0.6157
      ]
    ],
    "effectArea": "core",
    "form": "path",
    "formRotate": 0,
    "formRound": 35,
    "formSize": 50,
    "formSpin": 0,
    "frameShape": "rect",
    "glow": 35,
    "grainAmount": 40,
    "grainDistortion": 50,
    "grainEnabled": true,
    "grainDrift": 35,
    "grainScale": 70,
    "grainSoftness": 40,
    "height": 50,
    "inset": 30,
    "lens": {
      "angle": 2,
      "bias": 1,
      "count": 35,
      "dispersion": 0,
      "dispersionColor": 0.46,
      "dispersionShift": 0.11,
      "enabled": false,
      "focusCenter": 0.8,
      "focusEdges": 1,
      "grainMixer": 0,
      "grainOverlay": 0,
      "imageX": 0,
      "imageY": 0,
      "lensBulge": 0,
      "lensCircle": 0,
      "noise": 0,
      "noiseFrequency": 0.25,
      "noiseOffset": 0,
      "perspective": 0.1,
      "spread": 0.97,
      "swirl": -0.14
    },
    "lightTravel": 80,
    "masks": [
      {
        "blur": 60,
        "centerX": 0,
        "centerY": 0,
        "height": 80,
        "rotation": 0,
        "width": 120
      }
    ],
    "masksEnabled": false,
    "mode": "edge",
    "path": [
      0.64,
      -0.06,
      0.626,
      -0.0443,
      0.612,
      -0.0286,
      0.598,
      -0.0129,
      0.584,
      0.0027,
      0.5701,
      0.0186,
      0.5562,
      0.0347,
      0.5425,
      0.0512,
      0.5291,
      0.0683,
      0.5159,
      0.0861,
      0.5031,
      0.1047,
      0.4908,
      0.1245,
      0.4791,
      0.1453,
      0.4681,
      0.1673,
      0.4578,
      0.1902,
      0.4481,
      0.2141,
      0.4391,
      0.2387,
      0.4307,
      0.2641,
      0.4231,
      0.2903,
      0.4163,
      0.3171,
      0.4104,
      0.3446,
      0.4056,
      0.3727,
      0.4019,
      0.4013,
      0.3995,
      0.4304,
      0.3985,
      0.4598,
      0.3987,
      0.4892,
      0.4002,
      0.5185,
      0.4027,
      0.5476,
      0.4062,
      0.5763,
      0.4105,
      0.6047,
      0.4157,
      0.6326,
      0.4219,
      0.6599,
      0.4291,
      0.6864,
      0.4374,
      0.7118,
      0.4466,
      0.7363,
      0.4565,
      0.7599,
      0.4667,
      0.7831,
      0.4769,
      0.8062,
      0.4868,
      0.8297,
      0.4963,
      0.8538,
      0.5053,
      0.8785,
      0.5138,
      0.9038,
      0.5219,
      0.9295,
      0.5297,
      0.9554,
      0.5374,
      0.9814,
      0.545,
      1.0076,
      0.5525,
      1.0338,
      0.56,
      1.06
    ],
    "phase": 31,
    "pointer": {
      "color": 35,
      "enabled": false,
      "glow": 25,
      "grain": 50,
      "pull": 40,
      "reach": 35,
      "smoothing": 45
    },
    "position": 50,
    "refraction": 49,
    "saturation": 69,
    "secondaryMotion": 38,
    "shading": 0,
    "softness": 70,
    "spectrum": "custom",
    "speed": 3,
    "spread": 62,
    "surfaceGrain": true,
    "wobble": 42
  },
  "pauseOffscreen": true,
  "respectReducedMotion": true,
  "startSeconds": 27.9308
};

const WAYLUME_BACKGROUND = "rgb(0, 0, 0)";
const WAYLUME_ASPECT = 1.777778;

export type WaylumeBackgroundProps = {
  className?: string;
  /** "fill" (default) covers the nearest positioned parent; "block" is an in-flow box with the studio aspect ratio. */
  layout?: "fill" | "block";
  /** Accessible description. Omit to hide the decorative motion from assistive technology. */
  label?: string;
  paused?: boolean;
  style?: CSSProperties;
};

export default function WaylumeBackground({ className, style, layout = "fill", paused = false, label }: WaylumeBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<{ destroy(): void; setPaused(paused: boolean): void } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const player = mountWaylume(container, WAYLUME_SETTINGS);
    playerRef.current = player;
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    playerRef.current?.setPaused(paused);
  }, [paused]);

  const box: CSSProperties =
    layout === "block"
      ? { position: "relative", width: "100%", aspectRatio: String(WAYLUME_ASPECT) }
      : { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" };
  return (
    <div
      ref={containerRef}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-waylume=""
      style={{ ...box, overflow: "hidden", pointerEvents: "none", backgroundColor: WAYLUME_BACKGROUND, ...style }}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Engine — generated by Waylume. Keep verbatim.
 * ------------------------------------------------------------------------ */
const mountWaylume = (() => {
const PAPER_GRAIN_NOISE_GLSL=`vec3 permute(vec3 x){return mod(((x*34.0)+ 1.0)*x,289.0);}
float snoise(vec2 v){
const vec4 C=vec4(0.211324865405187,0.366025403784439,
-0.577350269189626,0.024390243902439);
vec2 i=floor(v+dot(v,C.yy));
vec2 x0=v-i+dot(i,C.xx);
vec2 i1;
i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
vec4 x12=x0.xyxy+C.xxzz;
x12.xy -=i1;
i=mod(i,289.0);
vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))
+ i.x+vec3(0.0,i1.x,1.0));
vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),
dot(x12.zw,x12.zw)),0.0);
m=m*m;
m=m*m;
vec3 x=2.0*fract(p*C.www)- 1.0;
vec3 h=abs(x)- 0.5;
vec3 ox=floor(x+0.5);
vec3 a0=x-ox;
m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
vec3 g;
g.x=a0.x*x0.x+h.x*x0.y;
g.yz=a0.yz*x12.xz+h.yz*x12.yw;
return 130.0*dot(m,g);
}
vec2 rotate(vec2 uv,float th){
return mat2(cos(th),sin(th),-sin(th),cos(th))*uv;
}
float randomR(vec2 p){
vec2 uv=floor(p)/100.+.5;
return texture(u_noiseTexture,fract(uv)).r;
}
float valueNoiseR(vec2 st){
vec2 i=floor(st);
vec2 f=fract(st);
float a=randomR(i);
float b=randomR(i+vec2(1.0,0.0));
float c=randomR(i+vec2(0.0,1.0));
float d=randomR(i+vec2(1.0,1.0));
vec2 u=f*f*(3.0-2.0*f);
float x1=mix(a,b,u.x);
float x2=mix(c,d,u.x);
return mix(x1,x2,u.y);
}
vec4 fbmR(vec2 n0,vec2 n1,vec2 n2,vec2 n3){
float amplitude=0.2;
vec4 total=vec4(0.);
for(int i=0;i<3;i++){
n0=rotate(n0,0.3);
n1=rotate(n1,0.3);
n2=rotate(n2,0.3);
n3=rotate(n3,0.3);
total.x +=valueNoiseR(n0)*amplitude;
total.y +=valueNoiseR(n1)*amplitude;
total.z +=valueNoiseR(n2)*amplitude;
total.z +=valueNoiseR(n3)*amplitude;
n0*=1.99;
n1*=1.99;
n2*=1.99;
n3*=1.99;
amplitude*=0.6;
}
return total;
}`,PAPER_GRAIN_SHAPE_GLSL=`float baseNoise=snoise(grain_uv*.5);
vec4 fbmVals=fbmR(
.002*grain_uv+10.,
.003*grain_uv,
.001*grain_uv,
rotate(.4*grain_uv,2.)
);
float grainDist=baseNoise*snoise(grain_uv*.2)- fbmVals.x-fbmVals.y;
float rawNoise=.75*baseNoise-fbmVals.w-fbmVals.z;
float noise=clamp(rawNoise,0.,1.);
shape +=u_intensity*2./u_colorsCount*(grainDist+.5);
shape +=u_noise*10./u_colorsCount*noise;
float aa=fwidth(shape);
shape=clamp(shape-.5/u_colorsCount,0.,1.);
float totalShape=smoothstep(0.,u_softness+2.*aa,clamp(shape*u_colorsCount,0.,1.));
float mixer=shape*(u_colorsCount-1.);`,PAPER_LENS_FRAGMENT_GLSL=`#version 300 es
precision mediump float;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_spread;
uniform float u_bias;
uniform float u_angle;
uniform float u_perspective;
uniform float u_count;
uniform float u_dispersion;
uniform float u_dispersionShift;
uniform float u_dispersionColor;
uniform float u_focusCenter;
uniform float u_focusEdges;
uniform float u_swirl;
uniform float u_noise;
uniform float u_noiseFrequency;
uniform float u_noiseOffset;
uniform float u_lensBulge;
uniform float u_lensCircle;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_imageX;
uniform float u_imageY;
in vec2 v_imageUV;
out vec4 fragColor;
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
float hash21(vec2 p){
p=fract(p*vec2(0.3183099,0.3678794))+ 0.1;
p +=dot(p,p+19.19);
return fract(p.x*p.y);
}
vec2 rotate(vec2 uv,float th){
return mat2(cos(th),sin(th),-sin(th),cos(th))*uv;
}
float valueNoise(vec2 st){
vec2 i=floor(st);
vec2 f=fract(st);
float a=hash21(i);
float b=hash21(i+vec2(1.,0.));
float c=hash21(i+vec2(0.,1.));
float d=hash21(i+vec2(1.,1.));
vec2 u=f*f*(3.-2.*f);
return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float getUvFrame(vec2 uv){
vec2 invAA=1./clamp(fwidth(uv),1e-5,.02);
vec2 lo=clamp(uv*invAA+.5,0.,1.);
vec2 hi=clamp((1.-uv)*invAA+.5,0.,1.);
return lo.x*hi.x*lo.y*hi.y;
}
vec4 sampleOverWhite(vec2 uv){
vec4 img=texture(u_image,uv);
float cover=img.a*getUvFrame(uv);
vec3 colorOverWhite=mix(vec3(1.),img.rgb,cover);
return vec4(colorOverWhite,cover);
}
vec3 hueColor(float hue){
vec3 rgb=clamp(abs(mod(hue*6.+vec3(0.,4.,2.),6.)- 3.)- 1.,0.,1.);
rgb=rgb*rgb*(3.-2.*rgb);
return rgb;
}
float boxInradius(){
return .5*min(u_imageAspectRatio,1.);
}
float boxOutradius(){
return .5*length(vec2(u_imageAspectRatio,1.));
}
float spreadReach(){
return .7*pow(u_spread,1.3+2.7*u_spread);
}
float innerCircleMask(float radius,float inradius){
return 1.-smoothstep(.5*inradius,1.1*inradius,radius);
}
float dispersionCurve(float t,float biasPow){
float mirroredT=u_bias<0.?1.-t:t;
float curved=pow(mirroredT,biasPow);
return u_bias<0.?1.-curved:curved;
}
vec2 getSpread(vec2 fromCenter,float radius,vec2 warpedUV,float edgeAA,float inradius,float outradius,float reach,out float outStrength){
float angleRad=radians(u_angle);
vec2 uniformDir=vec2(cos(angleRad),sin(angleRad));
float invInradius=1./inradius;
vec2 radialDir=fromCenter*invInradius;
float maxLen=(outradius+reach)*invInradius;
float radialLen=radius*invInradius;
if(radialLen>maxLen)radialDir*=maxLen/radialLen;
vec2 spreadDir=mix(uniformDir,radialDir,u_perspective);
float bandProximity=smoothstep(inradius*.8,inradius,radius);
float lensCircleMaxing=bandProximity*u_lensCircle*u_lensCircle*u_lensCircle;
spreadDir=mix(spreadDir,radialDir,lensCircleMaxing);
vec2 warpedAbs=abs(warpedUV-.5);
float inner=mix(1.,smoothstep(0.,mix(inradius,outradius,u_focusCenter),radius),u_focusCenter);
float boxDist=max(warpedAbs.x,warpedAbs.y)*2.;
float outer=mix(1.,1.-min(boxDist,1.),u_focusEdges);
float strength=inner*outer;
strength*=mix(1.,mix(.15,.03,max(-u_lensBulge,0.)),lensCircleMaxing);
vec2 outside=max(warpedAbs-.5,0.);
float margin=max(reach*length(spreadDir)*(1.-u_lensCircle),edgeAA);
strength*=1.-smoothstep(0.,margin,length(outside));
outStrength=strength;
vec2 axis=spreadDir*(reach*strength);
if(u_noise>0.){
float turn=(valueNoise(fromCenter*u_noiseFrequency*18.+u_noiseOffset*30.)- .5)*2.*u_noise;
float cs=cos(turn),sn=sin(turn);
axis=mat2(cs,-sn,sn,cs)*axis;
}
axis.x/=u_imageAspectRatio;
return axis;
}
vec2 lensWarp(vec2 fromCenter,float radius,float inradius,out float bulgeFade){
bulgeFade=1.;
if(u_lensBulge==0.&&u_lensCircle<=0.)return fromCenter;
if(radius<1e-5)return fromCenter;
float r=radius;
if(u_lensBulge!=0.){
float rn=radius/inradius;
float bulge=abs(u_lensBulge)*(u_lensBulge>0.?1.4:1.2);
if(u_lensBulge>0.)bulgeFade=1.-smoothstep(1.45,1.53,rn*bulge);
float map=u_lensBulge>0.
?tan(min(rn*bulge,1.53))/tan(bulge)
:atan(rn*tan(bulge))/bulge;
float bulgeScale=map/rn;
fromCenter*=bulgeScale;
r*=bulgeScale;
}
if(u_lensCircle>0.){
vec2 dir=fromCenter/max(r,1e-5);
vec2 halfBox=vec2(u_imageAspectRatio,1.)*.5;
float rBox=min(halfBox.x/max(abs(dir.x),1e-4),halfBox.y/max(abs(dir.y),1e-4));
float band=inradius*mix(.03,.2,.5*(u_lensBulge+1.));
float innerEdge=inradius-band;
float over=smoothstep(0.,1.,(r-innerEdge)/band);
float g=r +(rBox-inradius)*pow(over,14.);
fromCenter=dir*mix(r,g,u_lensCircle);
}
return fromCenter;
}
void main(){
vec2 uv=v_imageUV;
float invAspect=1./u_imageAspectRatio;
float inradius=boxInradius();
float outradius=boxOutradius();
float reach=spreadReach();
vec2 fromCenter=uv-.5;
fromCenter.x*=u_imageAspectRatio;
float radius=length(fromCenter);
float bulgeFade;
vec2 warpedFromCenter=lensWarp(fromCenter,radius,inradius,bulgeFade);
vec2 baseUV=vec2(warpedFromCenter.x*invAspect,warpedFromCenter.y)+ .5;
vec2 baseDerivative=fwidth(baseUV);
float edgeAA=clamp(2.*max(baseDerivative.x,baseDerivative.y),.001,.02);
float spreadStrength;
vec2 spreadAxis=getSpread(fromCenter,radius,baseUV,edgeAA,inradius,outradius,reach,spreadStrength);
vec2 grainUV=vec2(0.);
if(u_grainMixer>0.||u_grainOverlay>0.){
vec2 dudx=dFdx(v_imageUV);
vec2 dudy=dFdy(v_imageUV);
grainUV=(v_imageUV-.5)*(.8/vec2(length(dudx),length(dudy)))+ .5;
}
if(u_grainMixer>0.){
float grainSeed=valueNoise(grainUV);
vec2 jit=fract(grainSeed*vec2(157.31,113.57))*2.-1.;
spreadAxis +=jit*.3*u_grainMixer*length(spreadAxis);
}
float count=floor(u_count);
int countInteger=int(count);
float invCount=1./count;
float invSpan=1./max(count-1.,1.);
float hueBase=u_dispersionColor+.5;
float biasPower=1.+2.*abs(u_bias);
vec2 tapBias=.5-vec2(u_imageX,u_imageY);
float centerAmount=clamp(1.-u_dispersionShift,0.,1.);
float edgesAmount=clamp(1.+u_dispersionShift,0.,1.);
float dispersion=u_dispersion*mix(edgesAmount,centerAmount,innerCircleMask(radius,inradius));
float dispersionPower=pow(dispersion,.8);
float warpedRadius=length(warpedFromCenter);
float swirlAngle=u_swirl*.4*PI*spreadStrength*u_spread*min(1.,inradius/max(warpedRadius,1e-4));
vec3 colorSum=vec3(0.);
vec3 weightSum=vec3(0.);
float coverSum=0.;
for(int i=0;i<50;i++){
if(i>=countInteger)break;
float layer=float(i);
float hue=hueBase+layer*invCount;
float spread=layer*invSpan;
if(u_bias!=0.)spread=dispersionCurve(spread,biasPower);
float fanPos=1.-2.*spread;
vec2 tapUV=baseUV+spreadAxis*fanPos-.5;
if(u_swirl!=0.){
tapUV.x*=u_imageAspectRatio;
tapUV=rotate(tapUV,swirlAngle*fanPos);
tapUV.x*=invAspect;
}
vec4 tap=sampleOverWhite(tapUV+tapBias);
vec3 weight=1.-dispersionPower*hueColor(hue);
colorSum +=tap.rgb*weight;
weightSum +=weight;
coverSum +=tap.a;
}
vec3 color=colorSum/max(weightSum,1e-4);
float coverAvg=coverSum*invCount;
float ground=min(color.r,min(color.g,color.b));
float alpha=max(coverAvg,1.-ground);
vec3 premult=max(color -(1.-alpha),0.);
fragColor=vec4(premult,alpha)*bulgeFade;
if(u_grainOverlay>0.){
float grain=valueNoise(rotate(grainUV,1.)+ vec2(3.));
grain=mix(grain,valueNoise(rotate(grainUV,2.)+ vec2(-1.)),.5);
grain=pow(grain,1.3);
float grainV=grain*2.-1.;
float grainStrength=pow(u_grainOverlay*abs(grainV),.8)*fragColor.a;
fragColor.rgb=mix(fragColor.rgb,vec3(step(0.,grainV))*fragColor.a,.35*grainStrength);
}
}`,PAPER_NOISE_TEXTURE_R8_BASE64="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",CF_MOTION_MAX_MASKS=12,CF_MOTION_MAX_PATH=48,CF_MOTION_QUAD_VERTEX=`#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main(){
vUv=aPosition*0.5+0.5;
gl_Position=vec4(aPosition,0.0,1.0);
}`,CF_MOTION_FRAME_GLSL=`uniform int uFrameShape;
uniform float uFrameRadius;
uniform vec2 uFrameOffset;
uniform vec2 uFrameSize;
float cfFrameCoverage(vec2 fragCoord){
if(uFrameShape==0)return 1.0;
vec2 halfSize=uFrameSize*0.5;
vec2 p=fragCoord+uFrameOffset-halfSize;
float shortEdge=min(uFrameSize.x,uFrameSize.y);
if(uFrameShape==2)return clamp(shortEdge*0.5-length(p)+ 0.5,0.0,1.0);
float r=min(shortEdge*0.5,shortEdge*uFrameRadius);
vec2 q=abs(p)- halfSize+r;
float d=length(max(q,0.0))+ min(max(q.x,q.y),0.0)- r;
return clamp(0.5-d,0.0,1.0);
}`,CF_MOTION_REMOVE_BACKDROP_GLSL=`vec4 dispersionRemoveBackdrop(vec4 composite,vec3 background){
vec3 color=clamp(composite.rgb+background*(1.0-composite.a),0.0,1.0);
vec3 delta=color-background;
vec3 coverage=max(
delta/max(vec3(1.0)- background,vec3(1e-5)),
-delta/max(background,vec3(1e-5))
);
float alpha=clamp(max(coverage.r,max(coverage.g,coverage.b)),0.0,1.0);
return vec4(clamp(color-background*(1.0-alpha),0.0,alpha),alpha);
}`,CF_MOTION_PAPER_GRAIN_GLSL=`vec3 paperGrainShape(
vec2 grain_uv,
float u_intensity,
float u_noise,
float u_softness
){
float u_colorsCount=4.0;
float shape=0.0;
${PAPER_GRAIN_SHAPE_GLSL}
return vec3(totalShape,mixer,aa);
}
vec3 paperSpectrumStop(float angle){
vec3 color=0.5*(
uPaletteBase +
uPaletteAmp*cos(angle+uPalettePhase)+
uPalette2Amp*cos(2.0*angle)
);
color=clamp(color,0.0,1.0);
float luminance=dot(color,vec3(0.2125,0.7154,0.0721));
return mix(vec3(luminance),color,uChroma);
}
float paperGradientTransition(float mixer,float stopIndex,float softness,float aa){
float localT=clamp(mixer-stopIndex,0.0,1.0);
return smoothstep(0.5-0.5*softness-aa,0.5+0.5*softness+aa,localT);
}
vec3 paperSpectrumGradient(float mixer,float softness,float aa){
const float quarterTurn=1.5707963267948966;
float baseAngle=uPaletteShift+uPointerColor*cfPointerFalloff+2.0*quarterTurn;
vec3 gradient=paperSpectrumStop(baseAngle);
gradient=mix(gradient,paperSpectrumStop(baseAngle+quarterTurn),paperGradientTransition(mixer,0.0,softness,aa));
gradient=mix(gradient,paperSpectrumStop(baseAngle+2.0*quarterTurn),paperGradientTransition(mixer,1.0,softness,aa));
gradient=mix(gradient,paperSpectrumStop(baseAngle+3.0*quarterTurn),paperGradientTransition(mixer,2.0,softness,aa));
return gradient;
}
vec4 paperGrainSample(vec2 grainUv,float intensity,float amount,float softness){
vec3 paperShape=paperGrainShape(grainUv,intensity,amount,softness);
vec3 grainColor=paperSpectrumGradient(paperShape.y,softness,paperShape.z);
return vec4(grainColor,paperShape.x);
}`,CF_MOTION_MASK_GLSL=`const int DISPERSION_MAX_MASKS=12;
uniform int uMaskCount;
uniform vec2 uMaskCenter[12];
uniform vec4 uMaskAxes[12];
uniform float uMaskBlur[12];
uniform float uMaskEnabled;
uniform float uMaskPreview;
float dispersionMaskCoverage(vec2 fragCoord){
if(uMaskCount<=0)return 1.0;
vec2 screenPoint=fragCoord/max(iResolution.xy,vec2(1.0));
float shortEdge=max(min(iResolution.x,iResolution.y),1.0);
vec2 shortEdgeScale=iResolution.xy/shortEdge;
float remaining=1.0;
for(int index=0;index<DISPERSION_MAX_MASKS;index++){
if(index>=uMaskCount)break;
vec2 delta=(screenPoint-uMaskCenter[index])*shortEdgeScale;
vec4 axes=uMaskAxes[index];
vec2 localPoint=vec2(
delta.x*axes.x+delta.y*axes.y,
-delta.x*axes.y+delta.y*axes.x
);
float distanceToCenter=length(localPoint*axes.zw);
float feather=clamp(uMaskBlur[index],0.0,1.0);
float coverage=feather<=0.00001
?1.0-step(1.000001,distanceToCenter)
:1.0-smoothstep(1.0-feather,1.0+feather,distanceToCenter);
remaining*=1.0-coverage;
}
return 1.0-remaining;
}`,CF_MOTION_FORM_GLSL=`uniform float uForm;
uniform float uFormSize;
uniform float uFormRound;
uniform float uFormAngle;
uniform vec4 uPath[${48/2}];
uniform float uPathCount;
vec2 cfPathPoint(int i){
vec4 q=uPath[i/2];
return((i % 2==0?q.xy:q.zw)*2.0-1.0)*vec2(1.0,-1.0)*iResolution.xy/min(iResolution.x,iResolution.y);
}
vec2 cfPathUv(vec2 p){
vec2 a=cfPathPoint(0);
float m=1e9,run=0.0,wsum=0.0,asum=0.0,xsum=0.0;
for(int i=1;i<48;i++){
if(float(i)>=uPathCount)break;
vec2 b=cfPathPoint(i),ba=b-a,pa=p-a;
float len=max(length(ba),1e-5);
float h=clamp(dot(pa,ba)/(len*len),0.0,1.0);
float d=length(pa-ba*h);
if(d<m){float k=exp((d-m)*8.0);wsum*=k;asum*=k;xsum*=k;m=d;}
float w=exp((m-d)*8.0);
wsum +=w;
asum +=w*(run+h*len);
xsum +=w*(ba.x*pa.y-ba.y*pa.x)/len;
run +=len;
a=b;
}
float along=asum/wsum-0.5*run;
return vec2(sqrt(along*along+0.36),xsum/wsum);
}
float cfTriangle(vec2 p,float r){
const float k=1.7320508;
p.x=abs(p.x)- r;
p.y=p.y+r/k;
if(p.x+k*p.y>0.0)p=vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
p.x -=clamp(p.x,-2.0*r,0.0);
return -length(p)*sign(p.y);
}
float cfBox(vec2 p,vec2 b){
vec2 q=abs(p)- b;
return length(max(q,0.0))+ min(max(q.x,q.y),0.0);
}
float cfFormDistance(vec2 p,float R,float rr){
if(uForm<1.5)return length(p)- R;
if(uForm<2.5){float inr=0.606*R;float k=max(1.0-rr/inr,0.05);return cfTriangle(p/k,1.05*R)*k-rr;}
float inr=0.86*R;
float k=max(1.0-rr/inr,0.05);
return cfBox(p/k,vec2(inr))*k-rr;
}
vec2 cfFormUv(vec2 p){
if(uForm>3.5)return cfPathUv(p);
float c=cos(uFormAngle);
float s=sin(uFormAngle);
p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);
float R=uFormSize;
float rr=uFormRound*R*0.45;
if(uForm>1.5&&uForm<2.5)p.y +=0.3*R;
float a=atan(abs(p.x),-p.y);
float along=0.6*R*(a-1.5707963-0.5*sin(2.0*a));
return vec2(along,cfFormDistance(p,R,rr));
}`,CF_MOTION_SHEET_GLSL=`float dispersionCurveProfile(float u){
if(uCurveForm<0.5)return 0.0;
if(uCurveForm<1.5)return u*u;
if(uCurveForm<2.5)return -(u*u);
if(uCurveForm<3.5)return u*(u*u-1.1);
if(uCurveForm<4.5)return sin(u*1.7);
float c=exp(1.15*u);
return 0.5*(c+1.0/c)- 1.0;
}
float dispersionCurveSlope(float u){
if(uCurveForm<0.5)return 0.0;
if(uCurveForm<1.5)return 2.0*u;
if(uCurveForm<2.5)return -2.0*u;
if(uCurveForm<3.5)return 3.0*u*u-1.1;
if(uCurveForm<4.5)return 1.7*cos(u*1.7);
float c=exp(1.15*u);
return 0.575*(c-1.0/c);
}
struct DispersionSheetResult{
vec3 color;
float sheetW;
vec3 sheetAcc;
};
DispersionSheetResult marchDispersionSheet(vec2 viewUv,float timeElapsed){
vec3 rayDir=normalize(vec3(viewUv,1.0));
float paletteShift=uPaletteShift+uPointerColor*cfPointerFalloff;
vec3 accumulatedColor=vec3(0.0);
float totalDistance=0.0;
float sheetW=0.0;
vec3 sheetAcc=vec3(0.0);
for(int marchIndex=0;marchIndex<38;marchIndex++){
vec3 currentPos=rayDir*totalDistance;
currentPos.z -=2.0;
float wTime=timeElapsed*uWaveSpeed;
float waveHeight=(
sin(currentPos.x*uWave1Freq+wTime)*uWave1Amp +
sin(currentPos.z*uWave2Freq-wTime*0.6)*uWave2Amp +
sin(currentPos.x*uWave3FreqX-currentPos.z*uWave3FreqZ+wTime*1.6)*uWave3Amp
)*uWaveHeight;
waveHeight +=uCurveAmp*7.0*dispersionCurveProfile(currentPos.x/7.0);
float distToWave=abs(currentPos.y-waveHeight);
float distToWaveR=abs(currentPos.y -(waveHeight-uChannelSplit));
float distToWaveB=abs(currentPos.y -(waveHeight+uChannelSplit));
if(totalDistance>0.7){
float sheetBlend=0.15/(distToWave*distToWave+0.01);
float causticW=sheetBlend*sheetBlend;
sheetW +=causticW;
sheetAcc +=vec3(currentPos.x,currentPos.z,waveHeight)*causticW;
}
currentPos/=uFoldingOffset;
float stepSize=min(distToWave-0.080,0.0)+ uStepBase;
totalDistance +=stepSize;
if(totalDistance>=36.5)break;
float patternX=sin(currentPos.x+cos(currentPos.y)*cos(currentPos.z));
float patternY=sin(currentPos.z+sin(currentPos.y)*cos(currentPos.x+timeElapsed));
float basePattern=smoothstep(0.5-0.34*uPatternSoft,0.7+0.22*uPatternSoft,patternX*patternY);
basePattern=mix(basePattern,0.78,uPatternSoft*0.7);
float blendFactor=0.15/(distToWave*distToWave+0.01);
float mixedPattern=mix(basePattern,1.0,blendFactor);
vec3 channelMix=vec3(
mix(basePattern,1.0,0.15/(distToWaveR*distToWaveR+0.01)),
mixedPattern,
mix(basePattern,1.0,0.15/(distToWaveB*distToWaveB+0.01))
);
float glowIntensity=uGlowIntensity/(uGlowSpread+stepSize);
float distanceFade=smoothstep(36.5,7.3,totalDistance);
vec3 paletteColor=uPaletteBase+uPaletteAmp*cos(totalDistance*uPaletteFreq+uPalettePhase+paletteShift);
paletteColor +=uPalette2Amp*cos(2.0*(totalDistance*uPaletteFreq+paletteShift));
paletteColor=max(paletteColor,vec3(0.0));
paletteColor=mix(vec3(dot(paletteColor,vec3(1.0/3.0))),paletteColor,uChroma);
float shadeMix=uShading*clamp(blendFactor,0.0,1.0);
if(shadeMix>0.0){
vec3 wavePos=currentPos*uFoldingOffset;
float dWdx=(
cos(wavePos.x*uWave1Freq+wTime)*uWave1Freq*uWave1Amp +
cos(wavePos.x*uWave3FreqX-wavePos.z*uWave3FreqZ+wTime*1.6)*uWave3FreqX*uWave3Amp
)*uWaveHeight+uCurveAmp*dispersionCurveSlope(wavePos.x/7.0);
float dWdz=(
cos(wavePos.z*uWave2Freq-wTime*0.6)*uWave2Freq*uWave2Amp -
cos(wavePos.x*uWave3FreqX-wavePos.z*uWave3FreqZ+wTime*1.6)*uWave3FreqZ*uWave3Amp
)*uWaveHeight;
vec3 sheetNormal=normalize(vec3(-dWdx,1.0,-dWdz));
float lit=0.5+0.5*dot(sheetNormal,normalize(vec3(-0.4,0.85,-0.3)));
float shade=mix(1.0,0.28+1.25*lit,shadeMix);
paletteColor*=shade;
}
accumulatedColor +=glowIntensity*channelMix*distanceFade*paletteColor;
}
DispersionSheetResult result;
result.color=accumulatedColor;
result.sheetW=sheetW;
result.sheetAcc=sheetAcc;
return result;
}`,CF_MOTION_COMPOSE_GLSL=`float generateFineNoise(vec2 p){
vec3 p3=fract(vec3(p.xyx)*8.6231);
p3 +=dot(p3,p3.yzx+67.92);
return fract((p3.x+p3.y)*p3.z);
}
float dispersionEffectRegionMask(float area,vec3 lightColor){
float peak=max(lightColor.r,max(lightColor.g,lightColor.b));
float trough=min(lightColor.r,min(lightColor.g,lightColor.b));
float chroma=max(peak-trough,0.0);
float wholeWave=smoothstep(0.015,0.12,peak);
float core=smoothstep(0.14,0.65,peak);
float glow=smoothstep(0.045,0.20,peak)*(1.0-smoothstep(0.50,0.90,peak));
float bands=wholeWave*smoothstep(0.035,0.24,chroma);
float veil=smoothstep(0.008,0.075,peak)*(1.0-smoothstep(0.18,0.48,peak));
if(area<0.5)return wholeWave;
if(area<1.5)return core;
if(area<2.5)return glow;
if(area<3.5)return bands;
return veil;
}
vec4 composeDispersionSheet(
DispersionSheetResult sheet,
vec2 fragCoord,
float effectTime,
float grainDistribution,
float edgeFade
){
vec3 light=sheet.color*(1.0+uPointerGlow*cfPointerFalloff);
float areaMask=dispersionEffectRegionMask(uEffectArea,light);
float grainAmount=min(1.0,uGrainAmount+uPointerGrain*cfPointerFalloff);
if(grainAmount>0.0&&areaMask>0.0){
float driftPhase=effectTime*0.1;
vec2 drift=vec2(cos(driftPhase),sin(driftPhase))*(96.0*uGrainDrift);
float grainReferenceScale=720.0/max(min(iResolution.x,iResolution.y),1.0);
vec2 normalizedGrainCoord=fragCoord*grainReferenceScale;
vec2 grain_uv=normalizedGrainCoord*uGrainScale+drift;
float projectedSurfaceHit=1.0-exp(-0.035*max(sheet.sheetW,0.0));
float surfaceDistribution=pow(clamp(projectedSurfaceHit,0.0,1.0),0.75);
float distributionMask=mix(1.0,surfaceDistribution,grainDistribution);
float mappedGrainAmount=grainAmount;
float amountGate=smoothstep(0.0,0.05,mappedGrainAmount);
vec4 primaryGrain=paperGrainSample(grain_uv,uGrainDistortion*amountGate,mappedGrainAmount,uGrainSoftness);
vec4 secondaryGrain=paperGrainSample(grain_uv+vec2(173.17,-91.73),uGrainDistortion*amountGate,mappedGrainAmount,uGrainSoftness);
vec4 tertiaryGrain=paperGrainSample(grain_uv+vec2(-247.61,149.29),uGrainDistortion*amountGate,mappedGrainAmount,uGrainSoftness);
float secondaryDensity=smoothstep(0.48,0.82,mappedGrainAmount);
float tertiaryDensity=smoothstep(0.72,1.0,mappedGrainAmount);
float grainMask=areaMask*distributionMask;
float primaryOpacity=clamp(primaryGrain.a*grainMask*1.55,0.0,1.0);
float secondaryOpacity=clamp(secondaryGrain.a*grainMask*secondaryDensity*1.35,0.0,1.0);
float tertiaryOpacity=clamp(tertiaryGrain.a*grainMask*tertiaryDensity*1.20,0.0,1.0);
float grainOpacity=1.0 -(1.0-primaryOpacity)*(1.0-secondaryOpacity)*(1.0-tertiaryOpacity);
float grainWeight=primaryOpacity+secondaryOpacity+tertiaryOpacity;
vec3 grainColor=(
primaryGrain.rgb*primaryOpacity +
secondaryGrain.rgb*secondaryOpacity +
tertiaryGrain.rgb*tertiaryOpacity
)/max(grainWeight,1e-5);
vec3 paperOver=mix(light,grainColor,grainOpacity);
vec3 grainEmission=grainColor*grainOpacity;
vec3 luminousSurface=light +(vec3(1.0)- clamp(light,0.0,1.0))*grainEmission;
light=mix(paperOver,luminousSurface,grainDistribution);
}
float maskCoverage=dispersionMaskCoverage(fragCoord);
float appliedMaskCoverage=mix(1.0,maskCoverage,uMaskEnabled);
if(uMaskPreview<0.5){
light*=appliedMaskCoverage;
}
float luminance=dot(light,vec3(0.2125,0.7154,0.0721));
light=mix(vec3(luminance),light,uSaturationX);
vec3 balanceStops=vec3(
0.45*uColorBalance.x+0.25*uColorBalance.y,
-0.25*uColorBalance.x+0.25*uColorBalance.y,
-0.25*uColorBalance.x-0.45*uColorBalance.y
);
light*=exp2(balanceStops);
if(edgeFade>0.0){
vec2 screen=fragCoord/max(iResolution.xy,vec2(1.0));
vec2 edge=min(screen,1.0-screen);
float fade=smoothstep(0.0,edgeFade,edge.x)*smoothstep(0.0,edgeFade,edge.y);
light*=fade;
}
float dither=(generateFineNoise(fragCoord+vec2(12.34,56.78))- 0.5)/128.0;
light +=vec3(dither*(uMaskPreview<0.5?appliedMaskCoverage:1.0));
float lum=clamp(max(light.r,max(light.g,light.b)),0.0,1.0);
float keyed=mix(lum,lum*lum*(3.0-2.0*lum),0.5);
float alpha=mix(keyed,1.0,uOpaque);
float bgLum=dot(uBg,vec3(0.2125,0.7154,0.0721));
float sourceGain=mix(keyed,1.0,bgLum*uOpaque);
vec3 rgb=light*sourceGain+uBg*(1.0-keyed)*uOpaque;
if(uMaskPreview>=0.5&&uMaskCount>0){
float maskOverlayAlpha=0.35*maskCoverage;
rgb=mix(rgb,vec3(0.92,0.12,0.12),maskOverlayAlpha);
alpha=max(alpha,maskOverlayAlpha);
}
vec4 composite=vec4(rgb,alpha);
return uRemoveBackdrop>0.5?dispersionRemoveBackdrop(composite,uBg):composite;
}`,CF_MOTION_FIELD_FRAGMENT=`#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform vec2 uViewOffset;
uniform float uZoom;
uniform float iTime;
uniform float uTimeScale;
uniform float uWaveSpeed;
uniform float uWaveHeight;
uniform float uWave1Freq;
uniform float uWave1Amp;
uniform float uWave2Freq;
uniform float uWave2Amp;
uniform float uWave3FreqX;
uniform float uWave3FreqZ;
uniform float uWave3Amp;
uniform float uFoldingOffset;
uniform float uStepBase;
uniform float uGlowIntensity;
uniform float uGlowSpread;
uniform float uOpaque;
uniform float uRemoveBackdrop;
uniform vec3 uBg;
uniform float uYShift;
uniform float uTiltX;
uniform float uCurveForm;
uniform float uCurveAmp;
uniform float uShading;
uniform vec3 uPalettePhase;
uniform vec3 uPaletteBase;
uniform vec3 uPaletteAmp;
uniform vec3 uPalette2Amp;
uniform float uPaletteFreq;
uniform float uPaletteShift;
uniform float uChroma;
uniform float uSaturationX;
uniform vec2 uColorBalance;
uniform float uEdgeFade;
uniform float uPatternSoft;
uniform float uChannelSplit;
uniform float uEffectArea;
uniform float uGrainAmount;
uniform float uGrainDistribution;
uniform float uGrainScale;
uniform float uGrainSoftness;
uniform float uGrainDistortion;
uniform float uGrainDrift;
uniform sampler2D u_noiseTexture;
uniform float uPremultiply;
uniform vec3 uPointer;
uniform float uPointerReach;
uniform float uPointerPull;
uniform float uPointerColor;
uniform float uPointerGrain;
uniform float uPointerGlow;
float cfPointerFalloff=0.0;
out vec4 cfFragColor;
${CF_MOTION_REMOVE_BACKDROP_GLSL}
${CF_MOTION_MASK_GLSL}
${CF_MOTION_FRAME_GLSL}
${PAPER_GRAIN_NOISE_GLSL}
${CF_MOTION_PAPER_GRAIN_GLSL}
${CF_MOTION_FORM_GLSL}
${CF_MOTION_SHEET_GLSL}
${CF_MOTION_COMPOSE_GLSL}
void main(){
vec2 fragCoord=gl_FragCoord.xy+uViewOffset;
vec2 sheetCoord=fragCoord;
if(uPointer.z>0.001){
vec2 toPointer=(fragCoord-uPointer.xy)/min(iResolution.x,iResolution.y);
cfPointerFalloff=uPointer.z*exp(-dot(toPointer,toPointer)/(uPointerReach*uPointerReach));
sheetCoord=uPointer.xy +(fragCoord-uPointer.xy)*(1.0+uPointerPull*cfPointerFalloff);
}
vec2 uv;
if(uForm>0.5){
uv=cfFormUv((2.0*sheetCoord-iResolution.xy)/min(iResolution.x,iResolution.y))*uZoom;
}else{
uv=(2.0*sheetCoord-iResolution.xy)/iResolution.y*uZoom;
uv.y +=uYShift;
uv.y +=uTiltX*uv.x;
}
DispersionSheetResult sheet=marchDispersionSheet(uv,iTime*uTimeScale);
vec4 color=composeDispersionSheet(sheet,fragCoord,iTime,uGrainDistribution,uEdgeFade);
color=clamp(color,0.0,1.0);
if(uPremultiply>0.5)color.rgb*=color.a;
cfFragColor=color*cfFrameCoverage(gl_FragCoord.xy);
}`;function cfLensFragment(){return`#version 300 es
${PAPER_LENS_FRAGMENT_GLSL.replace(/^#version 300 es\s*/u,"").replace("uniform sampler2D u_image;",`uniform sampler2D u_image;
uniform highp vec4 uViewWindow;`).replace("texture(u_image,uv)","texture(u_image,(uv-uViewWindow.xy)/uViewWindow.zw)").replace("img.a*getUvFrame(uv)","img.a").replace("float rn=radius/inradius;","float rn=radius/(u_lensBulge>0.?boxOutradius():inradius);").replace("fromCenter=dir*mix(r,g,u_lensCircle);","fromCenter=dir*mix(r,g,u_lensCircle*(1.-smoothstep(inradius,inradius*1.015,r)));").replace("void main(){","void paperLensMain(){")}
precision highp float;
uniform float uRemoveBackdrop;
uniform vec3 uBg;
${CF_MOTION_REMOVE_BACKDROP_GLSL}
${CF_MOTION_FRAME_GLSL}
void main(){
paperLensMain();
if(uRemoveBackdrop>0.5){
fragColor=dispersionRemoveBackdrop(fragColor,uBg);
}
fragColor*=cfFrameCoverage(gl_FragCoord.xy);
}`}const CF_MOTION_LENS_FRAGMENT=cfLensFragment(),CF_MOTION_LENS_VERTEX=`#version 300 es
precision highp float;
in vec2 aPosition;
uniform highp vec4 uViewWindow;
out vec2 v_imageUV;
void main(){
vec2 uv=aPosition*0.5+0.5;
v_imageUV=uv*uViewWindow.zw+uViewWindow.xy;
gl_Position=vec4(aPosition,0.0,1.0);
}`,CF_MOTION_COPY_FRAGMENT=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 cfFragColor;
${CF_MOTION_FRAME_GLSL}
void main(){
cfFragColor=texture(uTexture,vUv)*cfFrameCoverage(gl_FragCoord.xy);
}`;function cfRequire(e,o){if(e===null)throw new Error(`Waylume Motion could not create ${o}.`);return e}function cfCompileShader(e,o,t){const a=cfRequire(e.createShader(o),"a shader");if(e.shaderSource(a,t),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS)&&!e.isContextLost()){const n=e.getShaderInfoLog(a)??"unknown error";throw e.deleteShader(a),new Error(`Waylume Motion shader failed to compile: ${n}`)}return a}function cfCreateProgram(e,o,t){const a=cfCompileShader(e,e.VERTEX_SHADER,o),n=cfCompileShader(e,e.FRAGMENT_SHADER,t),r=cfRequire(e.createProgram(),"a shader program");if(e.attachShader(r,a),e.attachShader(r,n),e.bindAttribLocation(r,0,"aPosition"),e.linkProgram(r),e.deleteShader(a),e.deleteShader(n),!e.getProgramParameter(r,e.LINK_STATUS)&&!e.isContextLost()){const i=e.getProgramInfoLog(r)??"unknown error";throw e.deleteProgram(r),new Error(`Waylume Motion program failed to link: ${i}`)}return{program:r,uniforms:new Map}}function cfUniform(e,o,t){return o.uniforms.has(t)||o.uniforms.set(t,e.getUniformLocation(o.program,t)),o.uniforms.get(t)??null}function cfCreateQuad(e){const o=cfRequire(e.createBuffer(),"a quad buffer");return e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),o}function cfDrawQuad(e,o){e.bindBuffer(e.ARRAY_BUFFER,o),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.drawArrays(e.TRIANGLES,0,3)}function cfMaxSize(e){const o=e.getParameter(e.MAX_VIEWPORT_DIMS),t=Number(e.getParameter(e.MAX_RENDERBUFFER_SIZE))||4096,a=o?Math.min(o[0]??t,o[1]??t):t;return Math.max(1,Math.min(t,a))}function cfCreateTarget(e,o,t){const a=cfRequire(e.createTexture(),"a render texture");e.bindTexture(e.TEXTURE_2D,a),e.texStorage2D(e.TEXTURE_2D,1,e.RGBA8,o,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.MIRRORED_REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.MIRRORED_REPEAT);const n=cfRequire(e.createFramebuffer(),"a framebuffer");return e.bindFramebuffer(e.FRAMEBUFFER,n),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a,0),e.bindFramebuffer(e.FRAMEBUFFER,null),{framebuffer:n,height:t,texture:a,width:o}}function cfDeleteTarget(e,o){e.deleteFramebuffer(o.framebuffer),e.deleteTexture(o.texture)}const CF_NOISE_SIZE=128;function cfDecodeNoise(e){const o=atob(e||PAPER_NOISE_TEXTURE_R8_BASE64),t=CF_NOISE_SIZE,a=new Uint8Array(t*t).fill(128);if(o.length<t*t)return console.warn("Waylume: the grain noise texture is missing."),a;for(let n=0;n<t;n+=1)for(let r=0;r<t;r+=1)a[n*t+r]=o.charCodeAt((t-1-n)*t+r);return a}function cfCreateNoiseTexture(e,o){const t=cfDecodeNoise(o),a=cfRequire(e.createTexture(),"the noise texture");e.bindTexture(e.TEXTURE_2D,a);const n=cfRequire(e.createBuffer(),"the noise upload buffer");return e.bindBuffer(e.PIXEL_UNPACK_BUFFER,n),e.bufferData(e.PIXEL_UNPACK_BUFFER,t,e.STATIC_DRAW),e.texStorage2D(e.TEXTURE_2D,1,e.R8,CF_NOISE_SIZE,CF_NOISE_SIZE),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texSubImage2D(e.TEXTURE_2D,0,0,0,CF_NOISE_SIZE,CF_NOISE_SIZE,e.RED,e.UNSIGNED_BYTE,0),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.bindBuffer(e.PIXEL_UNPACK_BUFFER,null),e.deleteBuffer(n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),a}const CF_LOOP_RADIANS=20*Math.PI,CF_DEFAULT_LOOP_SECONDS=60,cfModeFraming={central:{glowSpreadScale:1,tilt:0,wave1AmpScale:1,wave1FreqScale:1,waveHeightScale:1,yShift:0,zoom:1},diagonal:{glowSpreadScale:1,tilt:.34,wave1AmpScale:1,wave1FreqScale:1,waveHeightScale:1,yShift:0,zoom:1},edge:{glowSpreadScale:.9,tilt:0,wave1AmpScale:1,wave1FreqScale:1,waveHeightScale:.5,yShift:.62,zoom:.92},halo:{glowSpreadScale:.85,tilt:0,wave1AmpScale:1.2,wave1FreqScale:1.3,waveHeightScale:1.7,yShift:0,zoom:1.55},ripple:{glowSpreadScale:1,tilt:0,wave1AmpScale:1.6,wave1FreqScale:2.2,waveHeightScale:.85,yShift:0,zoom:1}},cfCurveIndex={arch:2,cradle:5,drape:4,line:0,scurve:3,valley:1},cfAreaIndex={all:0,bands:3,core:1,glow:2,veil:4},cfShapeIndex={circle:2,rect:0,rounded:1},cfFormIndex={flow:0,path:4,ring:1,square:3,triangle:2},cfSpectra={aurora:{amp:[.78,1.02,1.08],amp2:[0,0,0],base:[.78,1.02,1.08],chroma:1,phase:[2.1,1.05,0]},dusk:{amp:[.58,.34,.44],amp2:[0,0,0],base:[.72,.56,.56],chroma:.95,phase:[0,1,2.7]},ice:{amp:[.35,.55,.75],amp2:[0,0,0],base:[.78,.95,1.1],chroma:.9,phase:[2.4,2,1.5]},mono:{amp:[1,1,1],amp2:[0,0,0],base:[1,1,1],chroma:0,phase:[0,1,2]},porcelain:{amp:[.31,.24,.05],amp2:[0,0,0],base:[.93,.98,1.05],chroma:1,phase:[Math.PI/2,Math.PI/2,Math.PI*1.5]},prism:{amp:[1,1,1],amp2:[0,0,0],base:[1,1,1],chroma:1,phase:[0,1,2]},sunset:{amp:[1.08,.96,.82],amp2:[0,0,0],base:[1.08,.96,.82],chroma:1,phase:[0,1.05,2.35]}},CF_LENS_KEYS=["angle","bias","dispersion","dispersionColor","dispersionShift","focusCenter","focusEdges","grainMixer","grainOverlay","imageX","imageY","lensBulge","lensCircle","noise","noiseFrequency","noiseOffset","perspective","spread","swirl"];function cfClamp01(e){return Math.min(1,Math.max(0,e))}function cfCustomPalette(e){const o=[0,0,0],t=[0,0,0],a=[0,0,0],n=[0,0,0];for(let r=0;r<3;r+=1){const[i,s,c,f]=e.map(C=>(C[r]??0)*2),l=((i??0)-(c??0))/2,v=((s??0)-(f??0))/2;o[r]=Math.hypot(l,v),t[r]=((i??0)-(s??0)+(c??0)-(f??0))/4,a[r]=((i??0)+(s??0)+(c??0)+(f??0))/4,n[r]=Math.atan2(-v,l)}return{amp:o,amp2:t,base:a,chroma:1,phase:n}}const CF_PACE_COMPRESSION=15;function cfLoopCycles(e,o){const t=Math.min(900,Math.max(40,250*2**((60-Math.min(100,Math.max(0,e)))/25))),a=Number.isFinite(o)&&o>0?o:CF_DEFAULT_LOOP_SECONDS;return Math.min(200,Math.max(1,Math.round(a*CF_PACE_COMPRESSION/t)))}function cfLoopTime(e,o){const t=(o.loopProgress%1+1)%1,a=cfLoopCycles(e.speed,o.durationSeconds);return(t+cfClamp01(e.phase/100))*a%1*CF_LOOP_RADIANS}function cfSetFieldUniforms(e,o,t,a){const n=f=>cfUniform(e,o,f),r=cfModeFraming[t.mode]??cfModeFraming.central,i=t.spectrum==="custom"?cfCustomPalette(t.customColors):cfSpectra[t.spectrum]??cfSpectra.prism,s=cfClamp01(t.softness/100);e.uniform1f(n("iTime"),a),e.uniform1f(n("uTimeScale"),1),e.uniform1f(n("uWaveSpeed"),.5);const c=t.form&&t.form!=="flow"&&t.form!=="path"?.55:1;e.uniform1f(n("uWaveHeight"),t.wobble/21*r.waveHeightScale*c),e.uniform1f(n("uWave1Freq"),3*r.wave1FreqScale),e.uniform1f(n("uWave1Amp"),t.secondaryMotion/100*.10526*r.wave1AmpScale),e.uniform1f(n("uWave2Freq"),.4),e.uniform1f(n("uWave2Amp"),-(t.refraction/80)*.26667),e.uniform1f(n("uWave3FreqX"),-.7),e.uniform1f(n("uWave3FreqZ"),-.7),e.uniform1f(n("uWave3Amp"),t.refraction/80*.26667),e.uniform1f(n("uChannelSplit"),t.chromaSplit/100*.12),e.uniform1f(n("uFoldingOffset"),20),e.uniform1f(n("uStepBase"),.104+s*.014),e.uniform1f(n("uPatternSoft"),s),e.uniform1f(n("uGlowIntensity"),t.glow/72*.011*(1+.3*(s-.44))),e.uniform1f(n("uGlowSpread"),4*2**((36-t.height)/24)*r.glowSpreadScale),e.uniform1f(n("uZoom"),r.zoom),e.uniform1f(n("uYShift"),(50-t.position)/100*1.6+r.yShift),e.uniform1f(n("uTiltX"),(t.bend-50)/50*.45+r.tilt),e.uniform1f(n("uCurveForm"),cfCurveIndex[t.curve]??0),e.uniform1f(n("uCurveAmp"),t.form==="path"?0:cfClamp01(t.curveDepth/100)**1.2*2.4),e.uniform1f(n("uShading"),cfClamp01(t.shading/100)),e.uniform1f(n("uPaletteFreq"),t.spread/58*3),e.uniform3f(n("uPalettePhase"),i.phase[0],i.phase[1],i.phase[2]),e.uniform3f(n("uPaletteBase"),i.base[0],i.base[1],i.base[2]),e.uniform3f(n("uPaletteAmp"),i.amp[0],i.amp[1],i.amp[2]),e.uniform3f(n("uPalette2Amp"),i.amp2[0],i.amp2[1],i.amp2[2]),e.uniform1f(n("uChroma"),i.chroma),e.uniform1f(n("uPaletteShift"),(t.lightTravel-52)/100*Math.PI*2),e.uniform1f(n("uSaturationX"),.55+cfClamp01(t.saturation/88)*.45),e.uniform2f(n("uColorBalance"),t.balanceX,t.balanceY),e.uniform1f(n("uEdgeFade"),(t.inset/40)**1.6*.25)}function cfSetPointerUniforms(e,o,t,a,n){const r=f=>cfUniform(e,o,f),i=t.pointer,s=i&&i.enabled&&a&&a.presence>.001?a:null;if(e.uniform3f(r("uPointer"),s?s.x*n[0]:0,s?(1-s.y)*n[1]:0,s?cfClamp01(s.presence):0),!s)return;const c=Math.max(-100,Math.min(100,i.pull))/100;e.uniform1f(r("uPointerReach"),.04+cfClamp01(i.reach/100)*.56),e.uniform1f(r("uPointerPull"),c*(c>0?1.2:.75)),e.uniform1f(r("uPointerColor"),cfClamp01(i.color/100)*Math.PI),e.uniform1f(r("uPointerGrain"),t.grainEnabled===!1?0:cfClamp01(i.grain/100)*.6),e.uniform1f(r("uPointerGlow"),cfClamp01(i.glow/100)*1.4)}function cfFollowPointer(e,o,t,a){const n=Math.max(0,Math.min(.25,t)),r=1-Math.exp(-n/(.02+cfClamp01(a/100)**1.5*.5)),i=1-Math.exp(-n/.18);e.presence<.01&&o.presence>0&&(e.x=o.x,e.y=o.y);const s=o.x-e.x,c=o.y-e.y,f=o.presence-e.presence;return e.x+=s*r,e.y+=c*r,e.presence+=f*i,Math.abs(f)<.002&&(e.presence=o.presence),Math.abs(s)+Math.abs(c)>5e-4||Math.abs(f)>.002}function cfSetFormUniforms(e,o,t,a){const n=l=>cfUniform(e,o,l),r=(a%1+1)%1,i=Math.round(t.formSpin)*r;e.uniform1f(n("uForm"),cfFormIndex[t.form]??0),e.uniform1f(n("uFormSize"),.2+cfClamp01(t.formSize/100)*.9),e.uniform1f(n("uFormRound"),cfClamp01(t.formRound/100)),e.uniform1f(n("uFormAngle"),t.form==="path"?0:t.formRotate/180*Math.PI+i*Math.PI*2);const s=t.form==="path"&&t.path?t.path:[],c=Math.min(48,Math.floor(s.length/2)),f=new Float32Array(96);for(let l=0;l<c*2;l+=1)f[l]=Number(s[l])||0;e.uniform4fv(n("uPath"),f),e.uniform1f(n("uPathCount"),c)}function cfSetEffectUniforms(e,o,t){const a=n=>cfUniform(e,o,n);e.uniform1f(a("uEffectArea"),cfAreaIndex[t.effectArea]??0),e.uniform1f(a("uGrainAmount"),t.grainEnabled===!1?0:t.grainAmount/100),e.uniform1f(a("uGrainDistribution"),t.surfaceGrain?1:0),e.uniform1f(a("uGrainScale"),1.6*(.5+t.grainScale/100)),e.uniform1f(a("uGrainSoftness"),t.grainSoftness/100),e.uniform1f(a("uGrainDistortion"),t.grainDistortion/100),e.uniform1f(a("uGrainDrift"),t.grainDrift/100)}function cfSetMaskUniforms(e,o,t,a){const n=f=>cfUniform(e,o,f),r=Math.min(12,t.masks.length),i=new Float32Array(24),s=new Float32Array(48),c=new Float32Array(12);for(let f=0;f<12;f+=1){const l=t.masks[f];if(!l){i.set([.5,.5],f*2),s.set([1,0,1,1],f*4);continue}const v=l.rotation*Math.PI/180;i.set([(l.centerX+1)/2,(1-l.centerY)/2],f*2),s.set([Math.cos(v),Math.sin(v),200/l.width,200/l.height],f*4),c[f]=l.blur/100}e.uniform1i(n("uMaskCount"),r),e.uniform2fv(n("uMaskCenter[0]"),i),e.uniform4fv(n("uMaskAxes[0]"),s),e.uniform1fv(n("uMaskBlur[0]"),c),e.uniform1f(n("uMaskEnabled"),t.masksEnabled?1:0),e.uniform1f(n("uMaskPreview"),a?1:0)}function cfSetFrameUniforms(e,o,t,a){e.uniform1i(cfUniform(e,o,"uFrameShape"),a?cfShapeIndex[t.frameShape]??0:0),e.uniform1f(cfUniform(e,o,"uFrameRadius"),cfClamp01(t.cornerRadius/100)),e.uniform2f(cfUniform(e,o,"uFrameOffset"),a?.offsetX??0,a?.offsetY??0),e.uniform2f(cfUniform(e,o,"uFrameSize"),a?.width??1,a?.height??1)}function cfBeginPass(e,o,t,a){e.bindFramebuffer(e.FRAMEBUFFER,o),e.viewport(0,0,t.width,t.height),e.disable(e.BLEND),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(a.program)}function cfDrawFieldPass(e,o,t,a,n,r,i){const s=o.field,{scale:c,view:f}=i,l=r.composite==="over-backdrop",v=r.background;cfBeginPass(e,t,a,s),e.uniform3f(cfUniform(e,s,"iResolution"),f?f.width*c:a.width,f?f.height*c:a.height,1),e.uniform2f(cfUniform(e,s,"uViewOffset"),f?f.offsetX*c:0,f?f.offsetY*c:0),cfSetFieldUniforms(e,s,n,cfLoopTime(n,r)),cfSetFormUniforms(e,s,n,r.loopProgress),cfSetPointerUniforms(e,s,n,r.pointer,[f?f.width*c:a.width,f?f.height*c:a.height]),cfSetEffectUniforms(e,s,n),cfSetMaskUniforms(e,s,n,r.maskPreview===!0),cfSetFrameUniforms(e,s,n,i.box),e.uniform1f(cfUniform(e,s,"uOpaque"),r.composite==="transparent"?0:1),e.uniform1f(cfUniform(e,s,"uRemoveBackdrop"),l&&!n.lens.enabled?1:0),e.uniform1f(cfUniform(e,s,"uPremultiply"),l?0:1),e.uniform3f(cfUniform(e,s,"uBg"),v[0],v[1],v[2]),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,o.noise),e.uniform1i(cfUniform(e,s,"u_noiseTexture"),0),cfDrawQuad(e,o.quad)}function cfDrawLensPass(e,o,t,a,n,r,i,s){const c=o.lens,f=i.background;cfBeginPass(e,t,a,c),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n),e.uniform1i(cfUniform(e,c,"u_image"),0),e.uniform4f(cfUniform(e,c,"uViewWindow"),0,0,1,1),e.uniform1f(cfUniform(e,c,"uRemoveBackdrop"),i.composite==="over-backdrop"?1:0),e.uniform3f(cfUniform(e,c,"uBg"),f[0],f[1],f[2]),e.uniform1f(cfUniform(e,c,"u_imageAspectRatio"),a.width/a.height);for(const l of CF_LENS_KEYS)e.uniform1f(cfUniform(e,c,`u_${l}`),r.lens[l]);e.uniform1f(cfUniform(e,c,"u_count"),Math.min(50,Math.round(r.lens.count))),cfSetFrameUniforms(e,c,r,s),cfDrawQuad(e,o.quad)}function cfDrawCopyPass(e,o,t,a,n,r){const i=o.copy;cfBeginPass(e,null,t,i),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(cfUniform(e,i,"uTexture"),0),cfSetFrameUniforms(e,i,n,r),cfDrawQuad(e,o.quad)}function createCfMotion(e,o={}){const t=e.getContext("webgl2",{alpha:!0,antialias:!1,depth:!1,powerPreference:"high-performance",premultipliedAlpha:!0,preserveDrawingBuffer:o.preserveDrawingBuffer===!0,stencil:!1});if(!t)return null;let a=null,n=null,r=null;const i=cfMaxSize(t),s=()=>(a??(a={copy:cfCreateProgram(t,CF_MOTION_QUAD_VERTEX,CF_MOTION_COPY_FRAGMENT),field:cfCreateProgram(t,CF_MOTION_QUAD_VERTEX,CF_MOTION_FIELD_FRAGMENT),lens:cfCreateProgram(t,CF_MOTION_LENS_VERTEX,CF_MOTION_LENS_FRAGMENT),noise:cfCreateNoiseTexture(t,o.noiseTexture),quad:cfCreateQuad(t)}),a),c=(v,C,A)=>v&&v.width===C&&v.height===A?v:(v&&cfDeleteTarget(t,v),cfCreateTarget(t,C,A));return{dispose:()=>{t.isContextLost()||(a&&(t.deleteProgram(a.copy.program),t.deleteProgram(a.field.program),t.deleteProgram(a.lens.program),t.deleteTexture(a.noise),t.deleteBuffer(a.quad)),n&&cfDeleteTarget(t,n),r&&cfDeleteTarget(t,r)),a=null,n=null,r=null},isLost:()=>t.isContextLost(),maxSize:()=>i,render:(v,C)=>{if(t.isContextLost())return;const A=Math.max(1,Math.round(C.width)),g=Math.max(1,Math.round(C.height));e.width!==A&&(e.width=A),e.height!==g&&(e.height=g);const D=s(),b=Math.min(1,Math.max(.1,C.internalScale??1)),d={height:Math.max(1,Math.round(g*b)),width:Math.max(1,Math.round(A*b))},Q=v.lens.enabled,w=d.width===A&&d.height===g,h=!Q&&w,k=!Q&&C.view?C.view:null,B=k??{height:g,offsetX:0,offsetY:0,width:A};if(h||(n=c(n,d.width,d.height)),cfDrawFieldPass(t,D,h?null:n?.framebuffer??null,d,v,C,{box:h?B:null,scale:b,view:k}),h||!n)return;let F=n.texture;if(Q){if(w||(r=c(r,d.width,d.height)),cfDrawLensPass(t,D,w?null:r?.framebuffer??null,d,F,v,C,w?B:null),w||!r)return;F=r.texture}cfDrawCopyPass(t,D,{height:g,width:A},F,v,B)},reset:()=>{a=null,n=null,r=null},surface:e}}function mountCfMotion(e,o){const t=document.createElement("canvas");t.setAttribute("aria-hidden","true"),t.style.cssText="display:block;position:absolute;max-width:none;pointer-events:none;",e.appendChild(t);const a=createCfMotion(t,{noiseTexture:o.noise});if(!a)return t.remove(),{destroy:()=>{},setPaused:()=>{}};let n=!1,r=!1,i=!1,s=!0,c=typeof document>"u"||document.visibilityState!=="hidden",f=0;const l=Math.max(.5,o.durationSeconds);let v=((o.startSeconds||0)%l+l)%l;const C=typeof o.pace=="number"&&o.pace>0?Math.min(4,o.pace):1;let A=null,g=1,D=1,b=1,d=1,Q=1,w=1,h=0;const k=o.background?"opaque":"transparent",B=o.background??[0,0,0],F=o.params.lens.enabled,W=o.respectReducedMotion&&typeof window.matchMedia=="function"?window.matchMedia("(prefers-reduced-motion: reduce)"):null,y=!!(o.params.pointer&&o.params.pointer.enabled),I={presence:0,x:.5,y:.5},M={presence:0,x:.5,y:.5};let S=!1;const L=u=>{const m=e.getBoundingClientRect(),P=o.aspectRatio>0?o.aspectRatio:m.width/Math.max(1,m.height),p=Math.max(m.width,m.height*P),x=p/P,T=u.clientX>=m.left&&u.clientX<=m.right&&u.clientY>=m.top&&u.clientY<=m.bottom;I.x=Math.min(1,Math.max(0,(u.clientX-m.left-(m.width-p)/2)/p)),I.y=Math.min(1,Math.max(0,(u.clientY-m.top-(m.height-x)/2)/x)),I.presence=T?1:0,S=!0,E()},R=()=>{I.presence=0,S=!0,E()},z=u=>{u.pointerType!=="mouse"&&R()},G=u=>2*Math.round(u/4),N=()=>{if(n||r)return;const u=w/Math.max(1,Q),m=Math.max(1,Math.round(g*u)),P=Math.max(1,Math.round(D*u)),p=Math.max(m,Math.round(b*Q*u)),x=Math.max(P,Math.round(d*Q*u));a.render(o.params,{background:[B[0],B[1],B[2]],composite:k,durationSeconds:l,height:D,internalScale:u,loopProgress:v/l,pointer:y&&M.presence>.001?{presence:M.presence,x:M.x,y:M.y}:void 0,view:F?void 0:{height:x/u,offsetX:G(p-m)/u,offsetY:G(x-P)/u,width:p/u},width:g})},_=()=>!n&&!r&&!i&&c&&s&&!(W&&W.matches),Y=u=>{if(f=0,!_()){A=null;return}if(A!==null){const m=u-A;v=(v+Math.min(m,250)/1e3*C)%l,h=m>34?h+1:Math.max(0,h-1),h>24&&w>.5&&(w=Math.max(.5,w-.125),h=0)}if(y&&(S||M.presence>.001)){const m=A===null?.016666666666666666:(u-A)/1e3;S=cfFollowPointer(M,I,m,o.params.pointer.smoothing)}A=u,N(),f=window.requestAnimationFrame(Y)},E=()=>{f||!_()||(f=window.requestAnimationFrame(Y))},V=()=>{const u=Math.min(window.devicePixelRatio||1,Math.max(.5,o.maxPixelRatio)),m=e.getBoundingClientRect(),P=Math.max(1,m.width),p=Math.max(1,m.height),x=o.aspectRatio>0?o.aspectRatio:P/p,T=Math.max(P,p*x),X=T/x,Z=F?T:P,O=F?X:p;t.style.width=`${Z}px`,t.style.height=`${O}px`,t.style.left=`${(P-Z)/2}px`,t.style.top=`${(p-O)/2}px`;const ee=a.maxSize(),U=Math.min(1,ee/Math.max(T*u,X*u));g=Math.max(1,Math.round(Z*u*U)),D=Math.max(1,Math.round(O*u*U)),b=T*U,d=X*U,Q=u,N()},J=typeof ResizeObserver=="function"?new ResizeObserver(V):null;J?.observe(e);const K=o.pauseOffscreen&&typeof IntersectionObserver=="function"?new IntersectionObserver(u=>{s=u.some(m=>m.isIntersecting),E()}):null;K?.observe(e);const j=()=>{c=document.visibilityState!=="hidden",E()};document.addEventListener("visibilitychange",j),y&&(window.addEventListener("pointermove",L,{passive:!0}),window.addEventListener("pointerdown",L,{passive:!0}),window.addEventListener("pointerup",z,{passive:!0}),window.addEventListener("pointercancel",R,{passive:!0}),document.documentElement.addEventListener("pointerleave",R));const q=()=>{N(),E()};W?.addEventListener?.("change",q);const H=u=>{u.preventDefault(),r=!0},$=()=>{r=!1,a.reset(),N(),E()};if(t.addEventListener("webglcontextlost",H),t.addEventListener("webglcontextrestored",$),getComputedStyle(e).position==="absolute"){const u=e.offsetParent;(!u||u===document.documentElement||u===document.body)&&getComputedStyle(document.body).position==="static"&&(console.warn("Waylume: no positioned parent found (add position: relative to the hero section), so it renders as a block with the studio aspect ratio."),e.style.position="relative",e.style.top="",e.style.left="",e.style.width="100%",e.style.height="auto",e.style.aspectRatio=String(o.aspectRatio>0?o.aspectRatio:16/9))}return e.getBoundingClientRect().height<1&&typeof console<"u"&&console.warn("Waylume: the container has no height. Give it a height, or place it inside a positioned (position: relative) section with a height."),V(),E(),{destroy:()=>{n=!0,f&&window.cancelAnimationFrame(f),J?.disconnect(),K?.disconnect(),document.removeEventListener("visibilitychange",j),window.removeEventListener("pointermove",L),window.removeEventListener("pointerdown",L),window.removeEventListener("pointerup",z),window.removeEventListener("pointercancel",R),document.documentElement.removeEventListener("pointerleave",R),W?.removeEventListener?.("change",q),t.removeEventListener("webglcontextlost",H),t.removeEventListener("webglcontextrestored",$),a.dispose(),t.remove()},setPaused:u=>{i=u,u||E()}}}
return mountCfMotion;
})();
