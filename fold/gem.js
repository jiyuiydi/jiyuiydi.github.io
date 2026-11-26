// The hero gem: one medium, eight faces, each a way of looking at it.
//
// The gem is a truncated octahedron (8 hexagons, 6 squares) with its hexagon-to-hexagon edges
// bevelled, so 26 planes in all, then stretched along one axis into a longer stone. Nothing is a mesh: the fragment shader intersects each pixel's
// ray with the planes directly, which gives the exact thickness the light travels through. From
// that it does refraction, a few internal reflections, colour absorption by depth, and light
// scattered in from a lamp behind the gem, which is what makes it glow from inside. Milky
// clouds come from noise read at the same few points the glow is sampled at, so they cost little.
//
// The 8 hexagons carry the labels, etched into the surface. The gem tumbles, settles with one
// hexagon square to the camera, and that face's item in the list beside it comes forward.
// Hovering pauses it; a click or Enter turns it. With reduced motion it only turns when asked,
// and without WebGL2 the list is shown on its own.
(() => {
  const fig = document.getElementById('gem');
  if (!fig) return;
  const stage = fig.querySelector('.gem-stage');
  const canvas = fig.querySelector('canvas');
  const items = [...fig.querySelectorAll('.gem-list li')];
  const labels = items.map(li => li.textContent.trim());
  if (labels.length !== 8) return;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) return;

  // ---- Geometry ------------------------------------------------------------------------------
  const S2 = Math.SQRT2, S3 = Math.sqrt(3);
  const BEVEL = 1.0;               // plane distance of the edge bevels; 1.06 would be no bevel
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); };
  const STRETCH = 1.45;            // how much longer the gem is along its object z axis
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const planes = [];
  // Hexagons first, so a plane's index below 8 is its label's index.
  for (let i = 0; i < 8; i++) {
    const s = [i & 1 ? -1 : 1, i & 2 ? -1 : 1, i & 4 ? -1 : 1];
    planes.push([...s.map(c => c / S3), S3 / 2]);
  }
  for (let a = 0; a < 3; a++) for (const sg of [1, -1]) {
    const n = [0, 0, 0]; n[a] = sg; planes.push([...n, 1]);
  }
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) for (const sa of [1, -1]) for (const sb of [1, -1]) {
    const n = [0, 0, 0]; n[a] = sa / S2; n[b] = sb / S2; planes.push([...n, BEVEL]);
  }
  // Stretch along z: a plane n.p = d becomes (S^-1 n).p = d, renormalised.
  for (const p of planes) {
    const m = Math.hypot(p[0], p[1], p[2] / STRETCH);
    p[0] /= m; p[1] /= m; p[2] = p[2] / STRETCH / m; p[3] /= m;
  }
  // Make it less regular: tilt every plane a little and slide it in or out. Moving whole planes
  // keeps every face flat and the stone convex, and moves the corners by up to about a tenth of
  // its length. A new stone each visit; put a number in SEED to keep one you like.
  const SEED = null;
  const JITTER_TILT = 0.13;        // radians
  const JITTER_SHIFT = 0.09;       // units; the stone is about 2.9 long
  const LABELLED_JITTER = 0.35;    // the labelled faces get this share of it
  const rng = (s => () => {        // mulberry32
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  })(SEED ?? (Math.random() * 2 ** 32) >>> 0);
  const jitter = regular => regular.map((p, f) => {
    const k = f < 8 ? LABELLED_JITTER : 1;
    const n = p.slice(0, 3);
    const r = normalize([rng() - 0.5, rng() - 0.5, rng() - 0.5]);
    const side = normalize(r.map((c, i) => c - dot(r, n) * n[i]));   // a direction along the face
    const tilted = normalize(n.map((c, i) => c + side[i] * Math.tan(k * JITTER_TILT * rng())));
    return [...tilted, p[3] + (rng() * 2 - 1) * k * JITTER_SHIFT];
  });

  // A stone's corners: every point where three planes meet that's inside all the others. The
  // farthest sets the shader's bounding sphere and how wide the camera's view is.
  function cornersOf(planes) {
    let radius = 0;
    const corners = planes.map(() => []);    // each face's corners
    for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
      const [a, b, c] = [planes[i], planes[j], planes[k]];
      const bc = cross(b, c), det = dot(a, bc);
      if (Math.abs(det) < 1e-9) continue;
      const ca = cross(c, a), ab = cross(a, b);
      const x = [0, 1, 2].map(m => (a[3] * bc[m] + b[3] * ca[m] + c[3] * ab[m]) / det);
      if (!planes.every(p => dot(p, x) <= p[3] + 1e-6)) continue;
      radius = Math.max(radius, Math.hypot(...x));
      corners[i].push(x); corners[j].push(x); corners[k].push(x);
    }
    return { radius, corners };
  }

  // Each labelled face's text frame. v is "up": +z laid onto the face, so the gem rests standing on
  // its long axis; u = v x n keeps the text unmirrored. The label is centred on the face's corners.
  const framesOf = (planes, corners) => planes.slice(0, 8).map((p, i) => {
    const n = p.slice(0, 3);
    const v = normalize([-n[2] * n[0], -n[2] * n[1], 1 - n[2] * n[2]]);
    const pts = corners[i];
    return { u: cross(v, n), v, centre: [0, 1, 2].map(m => pts.reduce((s, x) => s + x[m], 0) / pts.length) };
  });

  // The largest scale at which each label's text box, centred on its face, stays a margin inside
  // every other plane: for a box of half-extents (w, h) * s along (u, v) about c, the worst corner
  // against plane j is n.c + s (w |n.u| + h |n.v|) <= d - margin, which solves for s directly.
  const LABEL_MARGIN = 0.035, LABEL_MAX = 0.55;
  const fit = (planes, frames, extents) => frames.map(({ u, v, centre }, i) => {
    const [w, h] = extents[i];
    let s = LABEL_MAX;
    planes.forEach((p, j) => {
      if (j === i) return;
      const spread = w * Math.abs(dot(p, u)) + h * Math.abs(dot(p, v));
      if (spread > 1e-9) s = Math.min(s, (p[3] - LABEL_MARGIN - dot(p, centre)) / spread);
    });
    return Math.max(s, 0.05);
  });

  // Draw stones until one leaves every label room: the longest label, at no less than MIN_LABEL of
  // the size the regular stone gives it. Most draws pass within a few tries; the regular stone is
  // the fallback.
  const MIN_LABEL = 0.75, LONGEST = [0.9, 0.62];
  const regularFrames = framesOf(planes, cornersOf(planes).corners);
  const floor = MIN_LABEL * Math.min(...fit(planes, regularFrames, Array(8).fill(LONGEST)));
  let stone = null;
  for (let attempt = 0; attempt < 40 && !stone; attempt++) {
    const p = jitter(planes), { radius, corners } = cornersOf(p), frames = framesOf(p, corners);
    if (Math.min(...fit(p, frames, Array(8).fill(LONGEST))) >= floor) stone = { planes: p, radius, frames };
  }
  if (stone) planes.splice(0, planes.length, ...stone.planes);
  const { radius, frames } = stone ?? { radius: cornersOf(planes).radius, frames: regularFrames };
  const RADIUS2 = (radius * 1.01) ** 2;
  const fitLabels = extents => fit(planes, frames, extents);

  // ---- Shaders -------------------------------------------------------------------------------
  const VERT = `#version 300 es
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const FRAG = `#version 300 es
  precision highp float;
  precision highp int;
  #define NP ${planes.length}
  #define NH 8
  uniform vec4 uPlanes[NP];
  uniform vec4 uU[NH];      // (text right, label half-size)
  uniform vec3 uV[NH];      // text up
  uniform vec3 uC[NH];      // label centre
  uniform mat3 uM;          // object to world
  uniform vec2 uRes;
  uniform float uTanHalf;
  uniform float uCam;
  uniform vec3 uBg;         // the page background, linear
  uniform int uActive;
  uniform float uActiveAmt;
  uniform sampler2D uLabels;
  out vec4 outColor;

  const float IOR = 1.6;
  const float F0 = 0.0533;                       // ((IOR - 1) / (IOR + 1))^2
  const vec3 SIGMA = vec3(0.32, 1.25, 2.9);       // absorption per unit: red passes, blue doesn't
  const vec3 SCATTER = vec3(1.0, 0.42, 0.16);
  const float EXPOSURE = 0.9;
  const vec3 CLOUD = vec3(1.0, 0.9, 0.78);       // the milky inclusions
  const float CLOUD_EXT = 2.2;                   // how much they hide what is behind them

  float softbox(vec3 d, vec3 c, vec2 sz) {
    float k = dot(d, c);
    if (k <= 0.0) return 0.0;
    vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), c));
    vec3 b = cross(c, t);
    vec2 l = abs(vec2(dot(d, t), dot(d, b)) / k);
    return (1.0 - smoothstep(sz.x * 0.55, sz.x, l.x)) * (1.0 - smoothstep(sz.y * 0.55, sz.y, l.y));
  }

  // A studio around the gem: the page colour, two lamps in front, and a big warm one behind it.
  vec3 env(vec3 d) {
    vec3 c = uBg * mix(0.25, 0.6, smoothstep(-0.7, 0.7, d.y));
    c += vec3(4.0, 3.8, 3.4) * softbox(d, normalize(vec3(-0.6, 0.7, 0.45)), vec2(0.6, 0.4));
    c += vec3(2.6) * softbox(d, normalize(vec3(0.9, 0.1, 0.3)), vec2(0.08, 0.7));
    c += vec3(2.2, 1.8, 1.4) * softbox(d, normalize(vec3(0.15, 0.3, -1.0)), vec2(0.5, 0.35));
    c += vec3(0.5, 0.3, 0.15) * (1.0 - smoothstep(-0.9, -0.2, d.y));
    return c;
  }

  // From a point inside, along d: how far to the surface, and through which plane.
  float exitT(vec3 p, vec3 d, out int idx) {
    float t = 1e4; idx = 0;
    for (int i = 0; i < NP; i++) {
      float dn = dot(uPlanes[i].xyz, d);
      if (dn > 1e-5) {
        float ti = (uPlanes[i].w - dot(uPlanes[i].xyz, p)) / dn;
        if (ti < t) { t = ti; idx = i; }
      }
    }
    return max(t, 0.0);
  }

  // The label etched on face f at p: x is its text, y the dark halo round the text.
  vec2 label(int f, vec3 p) {
    int g = min(f, NH - 1);
    float x = dot(p - uC[g], uU[g].xyz) / uU[g].w;
    float y = dot(p - uC[g], uV[g]) / uU[g].w;
    vec2 uv = vec2((float(g % 4) + 0.5 + 0.5 * x) / 4.0, (float(g / 4) + 0.5 - 0.5 * y) / 2.0);
    vec2 s = texture(uLabels, uv).rg;
    return (f < NH && abs(x) < 1.0 && abs(y) < 1.0) ? s : vec2(0.0);
  }

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1) * 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // Wisps fixed in the stone's core, drawn out along its length, thinning to nothing well before the
  // surface: density 0 to 1.
  const vec3 CORE = vec3(0.72, 0.72, 0.72 * ${STRETCH});
  float cloud(vec3 p) {
    vec3 q = p * vec3(2.6, 2.6, 1.4);
    float n = 0.65 * vnoise(q + 3.1) + 0.35 * vnoise(q * 2.3 - 1.7);
    return smoothstep(0.3, 0.66, n) * (1.0 - smoothstep(0.45, 1.0, length(p / CORE)));
  }

  // Veils: flat sheets of fine inclusions through the core, like the feathers and healed fractures
  // in quartz. A ray crosses each at one point, so the pattern there can be fine and sharp at the
  // cost of one plane test. Ridged noise makes it threads rather than blobs, a coarser noise breaks
  // it into patches, and it fades out toward the sheet's rim so no edge shows.
  const int NV = 4;
  const vec4 VEILS[NV] = vec4[NV](
    vec4(normalize(vec3(0.3, 0.8, 0.4)), 0.12),
    vec4(normalize(vec3(-0.7, 0.2, 0.5)), -0.18),
    vec4(normalize(vec3(0.5, -0.4, 0.9)), 0.04),
    vec4(normalize(vec3(0.15, 0.6, -0.8)), -0.08));
  float veil(vec3 p, float k) {
    float r = 1.0 - abs(2.0 * vnoise(p * 9.0 + k * 7.3) - 1.0);
    r = 0.7 * r + 0.3 * (1.0 - abs(2.0 * vnoise(p * 23.0 - k * 3.1) - 1.0));
    float patchy = smoothstep(0.35, 0.7, vnoise(p * 2.4 + k * 11.0));
    return smoothstep(0.72, 0.95, r) * patchy * (1.0 - smoothstep(0.35, 0.95, length(p / CORE)));
  }

  float hg(float c) {                            // Henyey-Greenstein, mildly forward
    const float g = 0.3;
    return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  }

  vec3 knee(vec3 c) {                            // soft shoulder above 0.8, so lamps don't clip hard
    return mix(c, 1.0 - 0.2 * exp(-(c - 0.8) / 0.2), step(0.8, c));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
    mat3 Mt = transpose(uM);
    vec3 ro = Mt * vec3(0.0, 0.0, uCam);
    vec3 rd = Mt * normalize(vec3(uv * uTanHalf, -1.0));
    float pix = 2.0 * uTanHalf * uCam / uRes.y;

    // Nothing to do outside the sphere every corner lies within.
    vec3 pc = ro + rd * max(0.0, -dot(ro, rd));
    if (dot(pc, pc) > ${(RADIUS2 + 0.05).toFixed(3)}) { outColor = vec4(0.0); return; }

    float tN = -1e4, tF = 1e4; int iN = 0; bool hit = true;
    for (int i = 0; i < NP; i++) {
      vec3 n = uPlanes[i].xyz;
      float dn = dot(n, rd), s = uPlanes[i].w - dot(n, ro);
      if (abs(dn) < 1e-6) { if (s < 0.0) hit = false; continue; }
      float t = s / dn;
      if (dn < 0.0) { if (t > tN) { tN = t; iN = i; } } else tF = min(tF, t);
    }
    hit = hit && tN < tF;

    // Coverage, for a smooth silhouette: how far inside or outside the gem the ray runs, measured
    // midway between where it enters and leaves the planes. That point is where a ray that just
    // grazes the gem passes nearest it, wherever along the view that part of the stone lies.
    vec3 pm = ro + rd * (0.5 * (tN + tF));
    float sd = -1e4;
    for (int i = 0; i < NP; i++) sd = max(sd, dot(uPlanes[i].xyz, pm) - uPlanes[i].w);
    float alpha = clamp(0.5 - sd / pix, 0.0, 1.0);
    if (alpha <= 0.0) { outColor = vec4(0.0); return; }

    vec3 col;
    if (!hit) {
      col = mix(uBg, vec3(1.0), 0.35);           // a sliver of silhouette the ray just misses
    } else {
      vec3 p = ro + rd * tN;
      vec3 n = uPlanes[iN].xyz;
      float F = F0 + (1.0 - F0) * pow(1.0 - clamp(-dot(rd, n), 0.0, 1.0), 5.0);
      vec3 refl = env(uM * reflect(rd, n));

      vec3 d = refract(rd, n, 1.0 / IOR);
      vec3 thr = vec3(1.0 - F);
      vec3 acc = vec3(0.0);
      vec3 L = Mt * normalize(vec3(0.2, 0.75, -0.6));   // the lamp behind and above
      vec3 q = p;
      for (int b = 0; b < 3; b++) {
        int ie;
        float t = exitT(q, d, ie);
        if (b == 0) {
          // Subsurface: light from the lamp scattered toward the eye along the first path. Samples
          // are jittered per pixel so they dither rather than band.
          float ph = hg(dot(d, L));
          float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float seg = 0.25 * t;
          vec3 litSum = vec3(0.0);
          for (int s = 0; s < 4; s++) {
            float ts = (float(s) + jit) * seg;
            int il;
            vec3 lit = exp(-SIGMA * exitT(q + d * ts, L, il));
            litSum += lit;
            acc += thr * exp(-SIGMA * ts) * SCATTER * ph * 0.35 * lit * seg;
          }
          // Clouds: sampled only where the path crosses the core ellipsoid, lit by the light the
          // glow samples found, seen through the amber in front of them, and hiding what's behind.
          vec3 qc = q / CORE, dc = d / CORE;
          float A = dot(dc, dc), B = dot(qc, dc), C = dot(qc, qc) - 1.0, disc = B * B - A * C;
          if (disc > 0.0) {
            float h = sqrt(disc), s0 = max((-B - h) / A, 0.0), s1 = min((-B + h) / A, t);
            if (s1 > s0) {
              // Milky: the clouds scatter the glow around them back out, so they're less
              // tinted by the amber in front of them than a clear path would be.
              float cseg = 0.25 * (s1 - s0), tau = 0.0;
              vec3 light = 1.8 * ph * 0.25 * litSum + 0.45 + 0.2 * uBg;
              for (int s = 0; s < 4; s++) {
                float ts = s0 + (float(s) + jit) * cseg;
                float dens = cloud(q + d * ts);
                acc += thr * exp(-0.45 * SIGMA * ts - CLOUD_EXT * tau) * CLOUD * dens * light * cseg;
                tau += dens * cseg;
              }
              thr *= exp(-CLOUD_EXT * tau);
            }
          }
          // Veils, lit like frosted sheets, with a glint when one turns to mirror the lamp.
          float hide = 1.0;
          for (int v = 0; v < NV; v++) {
            vec3 vn = VEILS[v].xyz;
            float dn = dot(vn, d);
            float sv = (VEILS[v].w - dot(vn, q)) / (abs(dn) < 1e-4 ? 1e-4 : dn);
            if (sv > 0.0 && sv < t) {
              float dens = veil(q + d * sv, float(v));
              float glint = pow(max(dot(reflect(d, dn < 0.0 ? vn : -vn), L), 0.0), 12.0);
              float grazing = min(1.0 / max(abs(dn), 0.2), 2.5);
              acc += thr * hide * exp(-0.5 * SIGMA * sv) * CLOUD * dens * (0.9 + 0.5 * uBg + 4.0 * glint) * 0.55 * grazing;
              hide *= 1.0 - 0.6 * dens;
            }
          }
          thr *= hide;
        }
        thr *= exp(-SIGMA * t);
        vec3 x = q + d * t;
        vec3 ne = uPlanes[ie].xyz;
        if (b == 0) acc += thr * label(ie, x).r * vec3(0.9, 0.8, 0.7) * 0.6;   // a label seen from behind
        vec3 dout = refract(d, -ne, IOR);
        if (dot(dout, dout) > 0.0) {
          float Fi = F0 + (1.0 - F0) * pow(1.0 - clamp(dot(dout, ne), 0.0, 1.0), 5.0);
          acc += thr * (1.0 - Fi) * env(uM * dout);
          thr *= Fi;
        }                                         // else total internal reflection: all of it stays
        d = reflect(d, ne);
        q = x;
      }
      acc += thr * env(uM * d) * 0.3;
      col = acc + refl * F;

      // Bright facet edges.
      float me = 1e4;
      for (int i = 0; i < NP; i++) if (i != iN) me = min(me, uPlanes[i].w - dot(uPlanes[i].xyz, p));
      col += (1.0 - smoothstep(0.0, pix * 1.8, me)) * (0.25 * refl + vec3(0.45));

      // The etched label, brighter on the face that has settled toward the camera.
      vec2 lb = label(iN, p);
      float act = iN == uActive ? uActiveAmt : 0.0;
      col *= 1.0 - lb.g * (0.3 + 0.35 * act);
      col = mix(col, vec3(1.25, 1.2, 1.12) * (0.85 + 0.35 * act), lb.r * (0.55 + 0.4 * act));
    }
    col = pow(knee(max(col * EXPOSURE, 0.0)), vec3(1.0 / 2.2));
    outColor = vec4(col * alpha, alpha);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('gem:', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('gem:', gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);
  const loc = name => gl.getUniformLocation(prog, name);
  const uni = Object.fromEntries(['uM', 'uRes', 'uTanHalf', 'uCam', 'uBg', 'uActive', 'uActiveAmt', 'uLabels'].map(n => [n, loc(n)]));
  gl.uniform4fv(loc('uPlanes'), planes.flat());
  const CAM = 4.5;                 // the view just fits the stone's farthest corner, however it turns
  gl.uniform1f(uni.uTanHalf, 1.03 * radius / Math.sqrt(CAM * CAM - radius * radius));
  gl.uniform1f(uni.uCam, CAM);
  gl.uniform1i(uni.uLabels, 0);
  gl.bindVertexArray(gl.createVertexArray());

  // ---- Labels --------------------------------------------------------------------------------
  // One 512px square per face, 4 x 2. Red is the text, green a blurred halo that darkens the
  // glass behind it so the text reads on any colour.
  function atlas() {
    const C = 512, cv = document.createElement('canvas');
    cv.width = C * 4; cv.height = C * 2;
    const g = cv.getContext('2d');
    const family = getComputedStyle(document.body).fontFamily;
    const wrap = (text, maxW) => {
      const lines = [];
      for (const w of text.split(/\s+/)) {
        const tryLine = lines.length ? lines[lines.length - 1] + ' ' + w : w;
        if (lines.length && g.measureText(tryLine).width <= maxW) lines[lines.length - 1] = tryLine;
        else lines.push(w);
      }
      return lines;
    };
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const extents = [];              // each label's text half-extents, as fractions of half a square
    labels.forEach((text, i) => {
      const cx = (i % 4) * C + C / 2, cy = Math.floor(i / 4) * C + C / 2;
      const maxW = C * 0.82;
      let size = 100, lines;
      for (; size > 32; size -= 4) {
        g.font = `600 ${size}px ${family}`;
        lines = wrap(text, maxW);
        if (lines.length * size * 1.12 <= C * 0.6 && lines.every(l => g.measureText(l).width <= maxW)) break;
      }
      const lh = size * 1.12, y0 = cy - (lines.length - 1) * lh / 2;
      const widest = Math.max(...lines.map(l => g.measureText(l).width));
      extents[i] = [(widest / 2 + size * 0.1) / (C / 2), (lines.length * lh / 2) / (C / 2)];
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#0f0'; g.lineWidth = size * 0.3; g.lineJoin = 'round';
      g.shadowColor = '#0f0'; g.shadowBlur = size * 0.4;
      lines.forEach((l, k) => g.strokeText(l, cx, y0 + k * lh));
      g.shadowBlur = 0; g.fillStyle = '#f00';
      lines.forEach((l, k) => g.fillText(l, cx, y0 + k * lh));
      g.restore();
    });
    return { cv, extents };
  }
  const { cv: labelCanvas, extents } = atlas();
  const scales = fitLabels(extents);
  gl.uniform4fv(loc('uU'), frames.flatMap((f, i) => [...f.u, scales[i]]));
  gl.uniform3fv(loc('uV'), frames.flatMap(f => f.v));
  gl.uniform3fv(loc('uC'), frames.flatMap(f => f.centre));
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, labelCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);

  // ---- Page colour ---------------------------------------------------------------------------
  function readBg() {
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) ?? ['247', '245', '240'];
    gl.uniform3fv(uni.uBg, m.slice(0, 3).map(c => Math.pow(Number(c) / 255, 2.2)));
  }
  readBg();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(readBg));
  new MutationObserver(() => requestAnimationFrame(readBg))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  // ---- Rotation ------------------------------------------------------------------------------
  // Quaternions as [x, y, z, w], object to world.
  const qmul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qaxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
  const qconj = q => [-q[0], -q[1], -q[2], q[3]];
  const qmat = ([x, y, z, w]) => [       // column-major mat3
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
  function qfromRows([[m00, m01, m02], [m10, m11, m12], [m20, m21, m22]]) {
    const tr = m00 + m11 + m22;
    let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
    return normalize(q);
  }
  // The orientation that turns face i square to the camera with its text upright.
  const facing = i => qfromRows([frames[i].u, frames[i].v, planes[i].slice(0, 3)]);
  const randomUnit = () => normalize([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
  const easeInOut = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

  const TUMBLE = 2600, REST = 3600;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let face = Math.floor(Math.random() * 8);
  let rest = { q: facing(face), start: performance.now(), left: REST };
  let tumble = null;
  let hovered = false;
  let shown = rest.q;

  function settle(now) {
    rest = { q: facing(face), start: now, left: REST };
    tumble = null;
    items.forEach((li, i) => li.classList.toggle('active', i === face));
  }
  function turn(now) {
    let next;
    do next = Math.floor(Math.random() * 8); while (next === face);
    face = next;
    items.forEach(li => li.classList.remove('active'));
    if (reduce.matches) { settle(now); return; }
    const q0 = shown, qt = facing(next);
    let d = qmul(qt, qconj(q0));
    if (d[3] < 0) d = d.map(c => -c);
    const half = Math.acos(Math.min(1, d[3])), sh = Math.sin(half);
    const axis = sh > 1e-4 ? [d[0] / sh, d[1] / sh, d[2] / sh] : randomUnit();
    tumble = {
      q0, axis, start: now, actFrom: rest ? activeAmt(now) : 0,
      total: 2 * half + 2 * Math.PI,              // the short way round, plus one full turn
      wobAxis: normalize(cross(axis, randomUnit())),
      wobAmp: 0.45 + Math.random() * 0.4,
    };
    rest = null;
  }
  function activeAmt(now) {
    if (rest) return smooth((now - rest.start) / 600);
    return tumble ? Math.max(0, tumble.actFrom * (1 - (now - tumble.start) / 300)) : 0;
  }
  function orientation(now) {
    if (tumble) {
      const p = Math.min(1, (now - tumble.start) / TUMBLE), e = easeInOut(p);
      return qmul(qaxis(tumble.wobAxis, tumble.wobAmp * Math.sin(Math.PI * e)),
        qmul(qaxis(tumble.axis, tumble.total * e), tumble.q0));
    }
    if (reduce.matches) return rest.q;
    const tau = (now - rest.start) / 1000, k = smooth(tau / 0.9);   // a slow sway while it rests
    const sway = qmul(qaxis([1, 0, 0], 0.05 * k * Math.sin(tau * 0.9)), qaxis([0, 1, 0], 0.07 * k * Math.sin(tau * 0.7 + 1)));
    return qmul(sway, rest.q);
  }

  stage.addEventListener('click', () => { if (rest) turn(performance.now()); });
  stage.addEventListener('pointerenter', () => { hovered = true; });
  stage.addEventListener('pointerleave', () => { hovered = false; });

  // ---- Frames --------------------------------------------------------------------------------
  let visible = true, raf = 0, last = performance.now();
  function frame(now) {
    raf = 0;
    const dt = Math.min(100, now - last); last = now;
    if (tumble && now - tumble.start >= TUMBLE) settle(now);
    if (rest && !reduce.matches && !hovered) { rest.left -= dt; if (rest.left <= 0) turn(now); }
    shown = orientation(now);

    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uni.uRes, w, h);
    gl.uniformMatrix3fv(uni.uM, false, qmat(shown));
    gl.uniform1i(uni.uActive, face);
    gl.uniform1f(uni.uActiveAmt, activeAmt(now));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (visible) raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }).observe(canvas);

  fig.classList.add('live');
  settle(performance.now());
  raf = requestAnimationFrame(frame);
})();
