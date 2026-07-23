// Two-pass "gooey dot-matrix" field. Pass 1 renders an animated sine-warp scalar
// field to a low-res render target; pass 2 reads it and draws smooth-min metaball
// dots on a grid.
//
// This lives here rather than inside a component because two surfaces use it (the
// hero and the admin sign-in) with different palettes. Copying the GLSL would mean
// two shaders that drift apart the first time either is tuned.

export interface DotFieldConfig {
  pixelSize: number;
  gooeyness: number;
  contrast: number;
  bias: number;
  /** 1 = dark dots on a light floor. */
  invert: 0 | 1;
  amplitude: number;
  timeSpeed: number;
  bg: [number, number, number];
  fg: [number, number, number];
  /** Soft drifting haze behind the dots. Set cloudStrength 0 to disable. */
  cloud: [number, number, number];
  cloudStrength: number;
  /** Vertical travelling wave in dot radius. Set waveAmplitude 0 to disable. */
  waveFrequency: number;
  waveAmplitude: number;
  waveTimeSpeed: number;
  revealDuration: number;
  maxDpr: number;
}

/**
 * Gate. WebGL on a marketing surface is a nice-to-have, never a requirement:
 * skip it for reduced-motion, touch/small screens and data-saver.
 */
export function dotFieldAllowed(minWidth = 860): boolean {
  const motionOk = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deviceOk = matchMedia('(pointer: fine)').matches && window.innerWidth >= minWidth;
  const conn = (navigator as any).connection;
  return motionOk && deviceOk && !(conn && conn.saveData);
}

const passthru = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fieldFrag = /* glsl */ `
  precision highp float;
  uniform float uTime; uniform float uAmplitude; uniform float uReveal;
  varying vec2 vUv;
  void main(){
    vec2 c = 2.0 * vUv - 1.0;
    float ds = uAmplitude * uReveal;
    c += ds * 0.4 * sin(c.yx + vec2(1.2, 3.4) + uTime);
    c += ds * 0.2 * sin(5.2 * c.yx + vec2(3.5, 0.4) + uTime);
    c += ds * 0.3 * sin(3.5 * c.yx + vec2(1.2, 3.1) + uTime);
    c += ds * 1.6 * sin(0.4 * c.yx + vec2(0.8, 2.4) + uTime);
    float L = length(c);
    float v = 0.0;
    for (int i = 0; i < 4; i++){ v = mix(v, float(i) / 3.0, cos(float(i) * L)); }
    gl_FragColor = vec4(clamp(v, 0.0, 1.0), 0.0, 0.0, 1.0);
  }
`;

const screenFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uFieldTex; uniform vec2 uFieldRes; uniform vec2 uResolution; uniform float uReveal;
  uniform float uPixelSize; uniform float uGooeyness; uniform float uContrast; uniform float uBias; uniform int uInvert;
  uniform vec3 uBg; uniform vec3 uFg; uniform vec3 uCloud; uniform float uCloudStrength;
  uniform float uWaveTime; uniform float uWaveFrequency; uniform float uWaveAmplitude;
  varying vec2 vUv;

  float lumaToRadius(float luma, float pixelSize, float biasOffset){
    float v = clamp((luma - 0.5 + uBias + biasOffset) * uContrast + 0.5, 0.0, 1.0);
    if (uInvert == 1) v = 1.0 - v;
    return v * pixelSize * 0.6 + pixelSize * 0.05;
  }
  float smin(float a, float b, float k){
    if (k <= 0.001) return min(a, b);
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  void main(){
    vec2 pixelCoord = vUv * uResolution;
    vec2 baseCellIndex = floor(pixelCoord / uPixelSize);
    float minDist = 1.0e5;
    float smoothK = uGooeyness * 1.5;
    const int R = 1;
    for (int dx = -R; dx <= R; dx++){
      for (int dy = -R; dy <= R; dy++){
        vec2 cellIndex = baseCellIndex + vec2(float(dx), float(dy));
        if (mod(cellIndex.x + cellIndex.y, 2.0) > 0.5) continue;
        vec2 cellCenter = (cellIndex + 0.5) * uPixelSize;
        vec2 fieldUv = (cellIndex + 0.5) / uFieldRes;
        float luma = texture2D(uFieldTex, fieldUv).r;
        float cellY = cellCenter.y / uResolution.y;
        float wavePhase = cellY * uWaveFrequency * 6.2831853 - uWaveTime;
        float waveBias = sin(wavePhase) * uWaveAmplitude;
        float dist = length(pixelCoord - cellCenter);
        float radius = lumaToRadius(luma, uPixelSize, waveBias);
        minDist = smin(minDist, dist - radius, smoothK * uPixelSize);
      }
    }
    float aa = max(fwidth(minDist), 0.0001);
    float shape = 1.0 - smoothstep(-aa, aa, minDist);
    float cloudLuma = texture2D(uFieldTex, vUv).r;
    float cloud = smoothstep(0.12, 0.9, cloudLuma) * uCloudStrength;
    vec3 base = mix(uBg, uCloud, cloud);
    vec3 color = mix(base, uFg, shape);
    gl_FragColor = vec4(color * uReveal + uBg * (1.0 - uReveal), 1.0);
  }
`;

/** Boots the field on `canvas`, sized to its parent. Returns a dispose function. */
export async function initDotField(canvas: HTMLCanvasElement, CFG: DotFieldConfig): Promise<() => void> {
  const THREE = await import('three');
  const host = canvas.parentElement as HTMLElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(CFG.maxDpr, window.devicePixelRatio || 1));

  const camera = new THREE.Camera();
  const quad = new THREE.PlaneGeometry(2, 2);

  const fieldMat = new THREE.ShaderMaterial({
    vertexShader: passthru,
    fragmentShader: fieldFrag,
    uniforms: { uTime: { value: 0 }, uAmplitude: { value: CFG.amplitude }, uReveal: { value: 0 } },
  });

  const screenMat = new THREE.ShaderMaterial({
    vertexShader: passthru,
    fragmentShader: screenFrag,
    uniforms: {
      uFieldTex: { value: null }, uFieldRes: { value: new THREE.Vector2(1, 1) },
      uResolution: { value: new THREE.Vector2(1, 1) }, uReveal: { value: 0 },
      uPixelSize: { value: CFG.pixelSize }, uGooeyness: { value: CFG.gooeyness },
      uContrast: { value: CFG.contrast }, uBias: { value: CFG.bias }, uInvert: { value: CFG.invert },
      uBg: { value: new THREE.Vector3(...CFG.bg) }, uFg: { value: new THREE.Vector3(...CFG.fg) },
      uCloud: { value: new THREE.Vector3(...CFG.cloud) }, uCloudStrength: { value: CFG.cloudStrength },
      uWaveTime: { value: 0 }, uWaveFrequency: { value: CFG.waveFrequency }, uWaveAmplitude: { value: CFG.waveAmplitude },
    },
  });

  const fieldScene = new THREE.Scene(); fieldScene.add(new THREE.Mesh(quad, fieldMat));
  const screenScene = new THREE.Scene(); screenScene.add(new THREE.Mesh(quad, screenMat));
  const fieldRT = new THREE.WebGLRenderTarget(2, 2);

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    const dpr = renderer.getPixelRatio();
    const rw = Math.floor(w * dpr), rh = Math.floor(h * dpr);
    screenMat.uniforms.uResolution.value.set(rw, rh);
    const cellsX = Math.ceil(rw / CFG.pixelSize) + 1;
    const cellsY = Math.ceil(rh / CFG.pixelSize) + 1;
    fieldRT.setSize(cellsX, cellsY);
    screenMat.uniforms.uFieldRes.value.set(cellsX, cellsY);
  };
  resize();
  window.addEventListener('resize', resize);

  let last = performance.now(), elapsed = 0;
  let raf = 0, running = true, t = 0, wt = 0, looping = false;

  // Only burn frames while the field is actually on screen.
  const io = new IntersectionObserver((es) => { running = es[0].isIntersecting; if (running) start(); }, { threshold: 0 });
  io.observe(host);

  function start() { if (!looping) { looping = true; loop(); } } // one RAF chain, ever

  function loop() {
    if (!running) { looping = false; cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05); last = now; elapsed += dt;
    t += dt * CFG.timeSpeed; wt += dt * CFG.waveTimeSpeed;
    const rev = Math.min(1, elapsed / CFG.revealDuration);
    const reveal = rev * rev * (3 - 2 * rev); // smoothstep ease-in
    fieldMat.uniforms.uTime.value = t;
    fieldMat.uniforms.uReveal.value = reveal;
    screenMat.uniforms.uReveal.value = reveal;
    screenMat.uniforms.uWaveTime.value = wt;
    screenMat.uniforms.uFieldTex.value = fieldRT.texture;
    renderer.setRenderTarget(fieldRT); renderer.render(fieldScene, camera);
    renderer.setRenderTarget(null); renderer.render(screenScene, camera);
  }
  start();
  canvas.classList.add('is-live');

  // The gate (dotFieldAllowed) is only read at boot. If the visitor turns on
  // Reduce Motion mid-session, tear the field down so the rAF loop stops — WCAG
  // 2.3.3 / 2.2.2. Closes KNOWN_BUGS BUG-14 for the "reduce motion" direction.
  const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  function onMotionChange() { if (motionMq.matches) dispose(); }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    running = false; cancelAnimationFrame(raf); io.disconnect();
    motionMq.removeEventListener('change', onMotionChange);
    window.removeEventListener('resize', resize);
    quad.dispose(); fieldMat.dispose(); screenMat.dispose(); fieldRT.dispose(); renderer.dispose();
    canvas.classList.remove('is-live');
  };
  motionMq.addEventListener('change', onMotionChange);

  return dispose;
}
