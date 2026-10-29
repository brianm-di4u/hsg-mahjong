// Bathhouse Mahjong: WebGL board renderer (three.js r169 from vendor/three.min.js, loaded first).
//
// The game in index.html owns every rule and all state. This file turns "tile i sits at (x, y, z),
// shows face f, is lifted, dimmed, selected or hinted" into real 3D tiles (layered resin bodies,
// painted faces from a canvas atlas, soft shadows, a tilted camera), and answers two questions:
// which tile is under this pixel, and where is tile i on screen. When WebGL is missing, create()
// returns null and the game keeps its 2D canvas renderer.
(function () {
'use strict';
const T = window.THREE;

// Tile proportions in world units: one tile is 1 wide (x), 1.3 deep (z, north is -z) and TH thick (y).
const UW = 1, UD = 1.3, TH = 0.56;
const GAP = 0.035;                 // seam between neighbouring tiles
const RAD = 0.085;                 // edge rounding

// A rounded box with smooth normals: a box surface sampled densely near its edges, each vertex pushed
// out from the inner (un-rounded) box by RAD. Origin at the centre of the bottom.
function roundedTile(w, h, d, r, arcSeg) {
  const axis = (half) => {
    const v = [-half];
    for (let k = 1; k <= arcSeg; k++) v.push(-half + r * (1 - Math.cos((k / arcSeg) * Math.PI / 2)));
    for (let k = arcSeg; k >= 1; k--) v.push(half - r * (1 - Math.cos((k / arcSeg) * Math.PI / 2)));
    v.push(half);
    return v.filter((x, i, a) => i === 0 || Math.abs(x - a[i - 1]) > 1e-6);
  };
  const hx = w / 2, hy = h / 2, hz = d / 2, ix = hx - r, iy = hy - r, iz = hz - r;
  const pos = [], nor = [], idx = [];
  const faces = [ // [axis of normal, sign, u axis, v axis]
    [0, 1, 2, 1], [0, -1, 2, 1], [1, 1, 0, 2], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 0, 1],
  ];
  const half = [hx, hy, hz], inner = [ix, iy, iz];
  for (const [n, s, ua, va] of faces) {
    const us = axis(half[ua]), vs = axis(half[va]);
    const base = pos.length / 3;
    for (const v of vs) for (const u of us) {
      const p = [0, 0, 0]; p[n] = s * half[n]; p[ua] = u; p[va] = v;
      const c = [Math.max(-inner[0], Math.min(inner[0], p[0])), Math.max(-inner[1], Math.min(inner[1], p[1])), Math.max(-inner[2], Math.min(inner[2], p[2]))];
      let dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2]; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
      pos.push(c[0] + dx * r, c[1] + dy * r + hy, c[2] + dz * r); nor.push(dx, dy, dz);
    }
    const nu = us.length;
    for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a = base + j * nu + i, b = a + 1, c2 = a + nu, e = c2 + 1;
      // keep outward winding: the cross product of the u and v axes points along +n for these faces
      const flip = (s > 0) !== ((ua + 1) % 3 === va);
      if (flip) idx.push(a, c2, b, b, c2, e); else idx.push(a, b, c2, b, e, c2);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

// A soft studio room baked into a PMREM environment, so the clearcoat has something to reflect:
// a big warm window up and to the north-west, a cooler bounce panel, dim walls.
function studioEnvironment(renderer) {
  const scene = new T.Scene();
  const room = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x2a2b2c, side: T.BackSide }));
  scene.add(room);
  const panel = (color, k, x, y, z, sx, sy, rx, ry) => {
    const m = new T.Mesh(new T.PlaneGeometry(sx, sy), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side: T.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); scene.add(m);
  };
  // The camera looks down from the south, so the flat tops mirror the north half of the ceiling: keep that dim,
  // and put the bright window low in the north-west, where only bevels and edges catch it.
  panel(0xfff1dc, 1.2, -4.9, 1.2, -2.2, 3, 2.2, 0, Math.PI / 2);   // west window
  panel(0xd8f0ff, 0.9, 4.9, 1, 2, 3, 3, 0, -Math.PI / 2);          // cool bounce
  panel(0xfff6ea, 0.5, 0, 1.5, 4.9, 6, 2, 0, Math.PI);             // front fill
  const pm = new T.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.035);
  pm.dispose(); room.geometry.dispose();
  return rt.texture;
}

const VERT_HEAD = `
attribute float aFace;
attribute vec4 aState;
varying vec3 vLocal;
varying vec3 vLocalN;
varying float vFace;
varying vec4 vState;
`;
const FRAG_HEAD = `
uniform sampler2D uAtlas;
uniform vec4 uCell;          // cols, rows, cell w / atlas w, cell h / atlas h
uniform float uBack;         // atlas index of the tile back
uniform vec3 uBand[6];
uniform float uBandEnd[6];   // height fraction (from the top) where each band ends
uniform vec3 uSelCol;
uniform vec3 uHintCol;
uniform vec3 uHalf;          // half extents of the tile body
varying vec3 vLocal;
varying vec3 vLocalN;
varying float vFace;
varying vec4 vState;
vec4 atlasAt(float idx, vec2 uv) {
  idx = floor(idx + 0.5); // interpolated varyings arrive as 23.9999 for 24: round, or the cell flips per pixel
  float col = mod(idx, uCell.x), row = floor(idx / uCell.x);
  vec2 p = vec2((col + uv.x) * uCell.z, 1.0 - (row + uv.y) * uCell.w);
  vec4 c = texture2D(uAtlas, p);
  // the atlas is uploaded as plain RGBA8 (mipmap generation of sRGB8 textures is unreliable on some drivers),
  // so decode sRGB here
  return vec4(mix(c.rgb / 12.92, pow((c.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, c.rgb)), c.a);
}
`;

function makeMaterial(atlasTex) {
  const mat = new T.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22,
    envMapIntensity: 0.35, specularIntensity: 0.35,
  });
  const u = {
    uAtlas: { value: atlasTex }, uCell: { value: new T.Vector4(8, 6, 1 / 8, 1 / 6) }, uBack: { value: 42 },
    uBand: { value: [0, 1, 2, 3, 4, 5].map(() => new T.Color(1, 1, 1)) }, uBandEnd: { value: [0.45, 0.6, 0.75, 0.9, 1, 1] },
    uSelCol: { value: new T.Color(0xffc24a) }, uHintCol: { value: new T.Color(0x4fc3ff) },
    uHalf: { value: new T.Vector3((UW - GAP) / 2, TH / 2, (UD - GAP) / 2) },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vLocal = position; vLocalN = normal; vFace = aFace; vState = aState;`);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <map_fragment>', `
      // ---- tile surface: painted face on top, back art underneath, layered resin bands on the sides
      vec3 hl = uHalf;
      float hTop = 1.0 - vLocal.y / (2.0 * hl.y);       // 0 at the top surface, 1 at the bottom
      vec2 fuv = vec2((vLocal.x + hl.x) / (2.0 * hl.x), (vLocal.z + hl.z) / (2.0 * hl.z));
      vec3 surf;
      float rim = 0.0;
      if (vLocalN.y > 0.55) {
        surf = atlasAt(vFace, clamp(fuv, 0.0, 1.0)).rgb;
      } else if (vLocalN.y < -0.55) {
        surf = atlasAt(uBack, vec2(1.0 - fuv.x, fuv.y)).rgb;
      } else {
        surf = uBand[5];
        for (int k = 5; k >= 0; k--) if (hTop < uBandEnd[k]) surf = uBand[k];
        // a thin bright seam where two resin layers meet, like polished laminate
        float seam = 0.0;
        for (int k = 0; k < 5; k++) seam = max(seam, 1.0 - smoothstep(0.0, 0.012, abs(hTop - uBandEnd[k])));
        surf = mix(surf, vec3(1.0), seam * 0.35) * 0.86;
        rim = 1.0;
      }
      // blocked tiles: darker and a little greyer, so free tiles stand out
      float dim = vState.x;
      float lum = dot(surf, vec3(0.299, 0.587, 0.114));
      surf = mix(surf, vec3(lum), dim * 0.35) * (1.0 - 0.36 * dim);
      diffuseColor.rgb *= surf;
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        // outline glow: the sides and a band around the top edge
        vec2 ed = abs(vLocal.xz) / uHalf.xz;
        float edge = max(rim, smoothstep(0.80, 0.98, max(ed.x, ed.y)));
        totalEmissiveRadiance += uSelCol * vState.y * (0.25 + 0.75 * edge) * 0.9;
        totalEmissiveRadiance += uHintCol * vState.z * (0.2 + 0.8 * edge) * 0.9;
        totalEmissiveRadiance += vec3(0.06) * vState.w;
      }`);
  };
  mat.customProgramCacheKey = () => 'mj-tile-v1';
  return mat;
}

// Polished stone for the slab under the board, painted once on a canvas: a warm base, cloudy patches and
// branching veins (seeded, so every load looks the same). Cream marble by day, dark verde at night.
function marbleCanvas(dark) {
  const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const c = cv.getContext('2d');
  let seed = 1923; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  c.fillStyle = dark ? '#16302D' : '#1F4A43'; c.fillRect(0, 0, N, N); // deep verde: the tiles are the brightest thing on the table
  for (let k = 0; k < 70; k++) { // soft clouds in the stone
    const x = rnd() * N, y = rnd() * N, r = 80 + rnd() * 240;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dark ? 'rgba(60,110,100,.22)' : (k % 3 ? 'rgba(70,120,108,.30)' : 'rgba(20,50,44,.35)')); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const vein = (x, y, a, len, w, alpha) => {
    c.beginPath(); c.moveTo(x, y);
    for (let i = 0; i < len; i++) {
      a += (rnd() - 0.5) * 0.5; x += Math.cos(a) * 9; y += Math.sin(a) * 9; c.lineTo(x, y);
      if (w > 0.8 && rnd() < 0.04) vein(x, y, a + (rnd() - 0.5) * 1.6, len * 0.4 | 0, w * 0.55, alpha * 0.8);
    }
    c.lineWidth = w * 3; c.strokeStyle = dark ? 'rgba(150,190,170,' + alpha * 0.18 + ')' : 'rgba(200,230,214,' + alpha * 0.2 + ')'; c.stroke();
  };
  c.filter = 'blur(5px)';
  for (let k = 0; k < 14; k++) vein(rnd() * N, rnd() * N, rnd() * Math.PI * 2, 60 + rnd() * 80, 1 + rnd() * 2.2, 0.25 + rnd() * 0.3);
  c.filter = 'none';
  
  return cv;
}

function supported() {
  if (!T || !T.WebGLRenderer) return false;
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
// The GPU's name when the browser shares it, and whether it is a software rasteriser (SwiftShader, llvmpipe,
// Microsoft Basic Render): those draw this scene at a few frames a second, so the game prefers flat tiles there.
function probe() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false, software: false, name: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return { ok: true, name, software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) };
  } catch (e) { return { ok: false, software: false, name: '' }; }
}

function create(opts) {
  if (!supported()) return null;
  const canvas = opts.canvas;
  let renderer;
  try {
    // MSAA only on low-density screens: at 2x and up the pixels are small enough, and phones need the fill rate
    renderer = new T.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 1.75, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;

  const scene = new T.Scene();
  scene.environment = studioEnvironment(renderer);
  // Two cameras. 'classic' (the default) is an oblique orthographic projection: the view looks straight down and
  // every unit of height shifts a tile up and to the left on screen, the way printed and 2D mahjong boards draw
  // stacks. The board stays square with no keystone, the south and east resin sides show, every free face is
  // fully visible, and the lighting and shadows are still real 3D. 'tilted' is a narrow perspective camera.
  const perspCam = new T.PerspectiveCamera(13, 1, 0.5, 1500);
  const orthoCam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  let camera = orthoCam;

  const hemi = new T.HemisphereLight(0xfff4e4, 0x30504c, 0.55); scene.add(hemi);
  const key = new T.DirectionalLight(0xfff2e0, 2.1);
  key.castShadow = true; key.shadow.mapSize.set(opts.mobile ? 1024 : 2048, opts.mobile ? 1024 : 2048);
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key); scene.add(key.target);
  const fill = new T.DirectionalLight(0xe8f4ff, 0.55); scene.add(fill); scene.add(fill.target);

  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ color: 0x0a1a18, opacity: 0.38 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // The slab: marble top with a brass rim, sized to the board, so the tiles' shadows land on something solid.
  const SLAB_T = 0.22, RIM = 0.1;
  const slabTex = new T.CanvasTexture(marbleCanvas(false)); slabTex.colorSpace = T.SRGBColorSpace; slabTex.wrapS = slabTex.wrapT = T.RepeatWrapping;
  slabTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const slabMat = new T.MeshPhysicalMaterial({ map: slabTex, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.4 });
  const rimMat = new T.MeshStandardMaterial({ color: 0xc9a23f, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 });
  const slab = new T.Mesh(new T.BufferGeometry(), slabMat), rim = new T.Mesh(new T.BufferGeometry(), rimMat);
  slab.receiveShadow = true; rim.receiveShadow = true; rim.castShadow = true; // the slab casting onto itself would only add acne
  scene.add(slab); scene.add(rim);
  let slabDark = null;
  function buildSlab() {
    const w = bounds.maxX - bounds.minX + 0.36, d = bounds.maxZ - bounds.minZ + 0.36;
    slab.geometry.dispose(); rim.geometry.dispose();
    slab.geometry = roundedTile(w, SLAB_T, d, 0.08, 3); slab.position.set(0, -SLAB_T, 0);
    rim.geometry = roundedTile(w + RIM * 2, SLAB_T * 0.9, d + RIM * 2, 0.07, 3); rim.position.set(0, -SLAB_T - 0.02, 0);
    // one marble sheet stretched over the whole top (no repeats, so no seams)
    const pos = slab.geometry.attributes.position, uv = new Float32Array(pos.count * 2), k = Math.max(w, d);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / k + 0.5; uv[i * 2 + 1] = pos.getZ(i) / k + 0.5; }
    slab.geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
    ground.position.y = -SLAB_T - 0.04;
  }

  const atlasTex = new T.Texture();
  const mat = makeMaterial(atlasTex);
  const geo = roundedTile(UW - GAP, TH, UD - GAP, RAD, opts.mobile ? 3 : 4);
  let mesh = null, n = 0, aFace = null, aState = null, base = [];
  const bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, maxY: TH };
  const view = { w: 1, h: 1, dpr: 1, zoom: 1, panX: 0, panY: 0, pitch: 24, yaw: 9, mode: 'classic' };
  const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(), tmpV = new T.Vector3(), tmpS = new T.Vector3();
  const xf = []; // per-tile transform from the game: {dx, dy, dz, rot, scale}

  function setBoard(pos) {
    if (mesh) { scene.remove(mesh); mesh.dispose(); }
    n = pos.length;
    mesh = new T.InstancedMesh(geo, mat, n);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    aFace = new T.InstancedBufferAttribute(new Float32Array(n), 1); aFace.setUsage(T.DynamicDrawUsage);
    aState = new T.InstancedBufferAttribute(new Float32Array(n * 4), 4); aState.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('aFace', aFace); geo.setAttribute('aState', aState);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    base = pos.map(([x, y, z]) => [(x + 1) * UW / 2, z * TH, (y + 1) * UD / 2]);
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, maxL = 0;
    for (const [x, y, z] of base) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); maxL = Math.max(maxL, y); }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    for (const b of base) { b[0] -= cx; b[2] -= cz; }
    Object.assign(bounds, { minX: minX - cx - UW / 2, maxX: maxX - cx + UW / 2, minZ: minZ - cz - UD / 2, maxZ: maxZ - cz + UD / 2, maxY: maxL + TH });
    for (let i = 0; i < n; i++) xf[i] = { show: true, dx: 0, dy: 0, dz: 0, rot: 0, rotX: 0, scale: 1 };
    scene.add(mesh);
    buildSlab();
    placeLights();
    fit();
  }

  function placeLights() {
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    // low from the north-west: its mirror direction stays far from the south-east camera, so the glossy tops
    // never flash white, and the longer shadows separate the layers
    const kd = 30 + span * 2; key.position.set(-0.5 * kd, 0.78 * kd, -0.38 * kd); key.target.position.set(0, 0, 0);
    const sc = key.shadow.camera; const r = span * 0.75 + 2;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.5; sc.far = kd * 2 + span; sc.updateProjectionMatrix();
    fill.position.set(span * 0.4 + 3, 6, span * 0.6 + 6); fill.target.position.set(0, 0, 0);
    renderer.shadowMap.needsUpdate = true;
  }

  function setAtlas(cv, cols, rows, backIdx, cellW, cellH) {
    atlasTex.image = cv; atlasTex.colorSpace = T.NoColorSpace;
    atlasTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // Mipmaps built here by repeated halving: some drivers (SwiftShader among them) generate garbage mip levels
    // for large canvas textures.
    const mips = [cv]; let src = cv;
    while (src.width > 1 || src.height > 1) {
      const m = document.createElement('canvas'); m.width = Math.max(1, src.width >> 1); m.height = Math.max(1, src.height >> 1);
      const c = m.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(src, 0, 0, m.width, m.height);
      mips.push(m); src = m;
    }
    atlasTex.mipmaps = mips; atlasTex.generateMipmaps = false; atlasTex.minFilter = T.LinearMipmapLinearFilter; atlasTex.needsUpdate = true;
    const u = mat.userData.u; u.uCell.value.set(cols, rows, cellW / cv.width, cellH / cv.height); u.uBack.value = backIdx;
  }
  // bands: [[endFraction, '#hex'], ...] from the top surface down
  function setStyle(st) {
    const u = mat.userData.u;
    for (let k = 0; k < 6; k++) { const b = st.bands[Math.min(k, st.bands.length - 1)]; u.uBand.value[k].set(b[1]).convertSRGBToLinear(); u.uBandEnd.value[k] = k < st.bands.length ? b[0] : 1; }
    u.uSelCol.value.set(st.select || '#FFC24A'); u.uHintCol.value.set(st.hint || '#4FC3FF');
    hemi.color.set(st.dark ? 0xe4e0f4 : 0xfff8ec); hemi.groundColor.set(st.dark ? 0x1a1630 : 0x5a6e6a); hemi.intensity = st.dark ? 0.95 : 1.15;  // three.js divides light by pi: these are about 0.3 and 0.6 of full white
    key.intensity = st.dark ? 2.2 : 2.4; key.color.set(st.dark ? 0xfff6ec : 0xfffaf2);
    fill.color.set(st.dark ? 0x7fd6ff : 0xf2f8ff); fill.intensity = st.dark ? 0.55 : 0.4;
    ground.material.opacity = st.dark ? 0.55 : 0.38;
    if (slabDark !== !!st.dark) { slabDark = !!st.dark; slabTex.image = marbleCanvas(slabDark); slabTex.needsUpdate = true; }
    rimMat.color.set(st.dark ? 0x7fd6ff : 0xc9a23f); rimMat.roughness = st.dark ? 0.25 : 0.32;
    renderer.shadowMap.needsUpdate = true;
  }

  function resize(w, h, dpr) {
    view.w = w; view.h = h; view.dpr = dpr;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    perspCam.aspect = w / h; perspCam.updateProjectionMatrix();
    fit();
  }
  function setView(v) { Object.assign(view, v); fit(); }

  // Point the camera at the board from the south-east and above, then move and dolly it until the board's
  // bounding box fills the viewport (minus padding). Zoom dollies in; pan slides along the camera plane.
  const fitState = { target: new T.Vector3(), dist: 20, pxPerUnit: 40 };
  function corners() {
    const out = [];
    for (const x of [bounds.minX - 0.3, bounds.maxX + 0.3]) for (const z of [bounds.minZ - 0.3, bounds.maxZ + 0.3]) for (const y of [-0.25, bounds.maxY + 0.15]) out.push(new T.Vector3(x, y, z));
    return out;
  }
  // The camera only pitches (no yaw or roll), so the board's rows stay level on screen. The classic mahjong look,
  // with higher layers offset up and to the left and the south and east sides of every tile showing, comes from
  // an off-axis lens: the eye sits a little east of the target and the projection is shifted back so the target
  // stays centred (view.yaw sets how far, in degrees).
  const lookDir = new T.Vector3();
  function placeCamera(target, dist) {
    const p = view.pitch * Math.PI / 180, yw = view.yaw * Math.PI / 180;
    lookDir.set(0, Math.cos(p), Math.sin(p));
    camera.position.copy(target).addScaledVector(lookDir, dist);
    camera.position.x += dist * Math.tan(yw) * 0.75;
    camera.up.set(0, 0, -1); camera.lookAt(tmpS.copy(camera.position).sub(lookDir)); camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    tmpV.copy(target).project(camera);
    const e = camera.projectionMatrix.elements; e[8] += tmpV.x; e[9] += tmpV.y;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  // Oblique orthographic: height y (world) shifts the image by (-ob, +ob) * y in world units, i.e. up and left.
  const OB = 0.3, CAM_H = 60;
  function placeOrtho(tx, tz, hh) {
    const asp = view.w / view.h, cam = orthoCam;
    cam.left = -hh * asp; cam.right = hh * asp; cam.top = hh; cam.bottom = -hh; cam.near = 0.1; cam.far = CAM_H + 20;
    cam.position.set(tx, CAM_H, tz); cam.up.set(0, 0, -1); cam.lookAt(tx, 0, tz); cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    // shear in view space: view z = height - CAM_H, so height = z + CAM_H; screen x -= OB * height, screen y += OB * height
    const S = new T.Matrix4().set(1, 0, -OB, -OB * CAM_H, 0, 1, OB, OB * CAM_H, 0, 0, 1, 0, 0, 0, 0, 1);
    cam.projectionMatrix.multiply(S); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  function fitOrtho() {
    const pad = view.w < 520 ? 4 : 24, asp = view.w / view.h;
    const fx = 1 - 2 * pad / view.w, fy = 1 - 2 * pad / view.h;
    let tx = 0, tz = 0, hh = 10; const cs = corners();
    for (let it = 0; it < 6; it++) {
      placeOrtho(tx, tz, hh);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of cs) { tmpV.copy(c).project(orthoCam); x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x); y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y); }
      tx += (x0 + x1) / 2 * hh * asp; tz -= (y0 + y1) / 2 * hh;   // screen up is world -z (north)
      hh *= Math.max((x1 - x0) / (2 * fx), (y1 - y0) / (2 * fy));
    }
    const h = hh / view.zoom, wpp = (2 * h) / view.h;
    placeOrtho(tx - view.panX * wpp, tz - view.panY * wpp, h);
    fitState.pxPerUnit = 1 / wpp;
    renderer.shadowMap.needsUpdate = true;
  }
  function fit() {
    if (!n) return;
    camera = view.mode === 'tilted' ? perspCam : orthoCam;
    if (camera === orthoCam) { fitOrtho(); return; }
    const pad = view.w < 520 ? 4 : 24;
    const fx = 1 - 2 * pad / view.w, fy = 1 - 2 * pad / view.h;
    const target = new T.Vector3(0, bounds.maxY * 0.3, 0); let dist = 20;
    const cs = corners(); const right = new T.Vector3(), up = new T.Vector3();
    const tanH = Math.tan(camera.fov * Math.PI / 360);
    for (let it = 0; it < 10; it++) {
      placeCamera(target, dist);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of cs) { tmpV.copy(c).project(camera); x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x); y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y); }
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      const hh = dist * tanH, hw = hh * camera.aspect;
      target.addScaledVector(right, (x0 + x1) / 2 * hw).addScaledVector(up, (y0 + y1) / 2 * hh);
      dist *= Math.max((x1 - x0) / (2 * fx), (y1 - y0) / (2 * fy));
    }
    fitState.target.copy(target); fitState.dist = dist;
    // zoom and pan
    const d = dist / view.zoom;
    const hh = d * tanH; const wpp = (2 * hh) / view.h; // world units per CSS pixel at the target
    placeCamera(target, d);
    right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
    const t2 = target.clone().addScaledVector(right, -view.panX * wpp).addScaledVector(up, view.panY * wpp);
    placeCamera(t2, d);
    fitState.pxPerUnit = 1 / wpp;
    renderer.shadowMap.needsUpdate = true;
  }
  // board size on screen at zoom 1, for pan limits
  function boardPx() {
    const z = view.zoom, px = view.panX, py = view.panY;
    view.zoom = 1; view.panX = 0; view.panY = 0; fit();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of corners()) { const p = toScreen(c); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    view.zoom = z; view.panX = px; view.panY = py; fit();
    return { w: x1 - x0, h: y1 - y0 };
  }

  function toScreen(v) { tmpV.copy(v).project(camera); return [(tmpV.x + 1) / 2 * view.w, (1 - tmpV.y) / 2 * view.h, tmpV.z]; }

  // per-frame tile data from the game
  function update(tiles) {
    if (!mesh) return;
    const fa = aFace.array, sa = aState.array;
    for (let i = 0; i < n; i++) {
      const t = tiles[i], b = base[i];
      xf[i] = t;
      if (!t.show) { tmpM.makeScale(0, 0, 0); mesh.setMatrixAt(i, tmpM); continue; }
      tmpE.set(t.rotX || 0, t.yaw || 0, t.rot || 0, 'YXZ'); tmpQ.setFromEuler(tmpE);
      const s = t.scale == null ? 1 : t.scale;
      // rotate around the tile's centre, not its bottom
      tmpV.set(0, TH / 2, 0).applyQuaternion(tmpQ).multiplyScalar(s);
      const px = b[0] + (t.dx || 0), py = b[1] + (t.dy || 0) + TH / 2 - tmpV.y, pz = b[2] + (t.dz || 0);
      tmpM.compose(tmpS.set(px - tmpV.x, py, pz - tmpV.z), tmpQ, tmpV.set(s, s, s));
      mesh.setMatrixAt(i, tmpM);
      fa[i] = t.face;
      sa[i * 4] = t.dim || 0; sa[i * 4 + 1] = t.sel || 0; sa[i * 4 + 2] = t.hint || 0; sa[i * 4 + 3] = t.hover || 0;
    }
    mesh.instanceMatrix.needsUpdate = true; aFace.needsUpdate = true; aState.needsUpdate = true;
  }
  function render(shadowsMoved) {
    if (shadowsMoved) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }

  // ---- picking and projection
  const ray = new T.Ray(), ndc = new T.Vector2();
  function tileBox(i, out) {
    const b = base[i], t = xf[i] || {};
    const cx = b[0], cy = b[1] + (t.pdy || 0), cz = b[2]; // rest position (plus the selection lift): animations never move hit boxes
    out.min.set(cx - UW / 2 + GAP / 2, cy, cz - UD / 2 + GAP / 2); out.max.set(cx + UW / 2 - GAP / 2, cy + TH, cz + UD / 2 - GAP / 2);
    return out;
  }
  const box = new T.Box3(), hit = new T.Vector3();
  function pick(px, py, present) {
    ndc.set(px / view.w * 2 - 1, -(py / view.h) * 2 + 1);
    ray.origin.set(ndc.x, ndc.y, -1).unproject(camera);  // near plane to far plane: right for both cameras
    ray.direction.set(ndc.x, ndc.y, 1).unproject(camera).sub(ray.origin).normalize();
    let best = -1, bestD = 1e9;
    for (let i = 0; i < n; i++) {
      if (!present(i)) continue;
      if (ray.intersectBox(tileBox(i, box), hit)) { const d = hit.distanceToSquared(ray.origin); if (d < bestD) { bestD = d; best = i; } }
    }
    return best;
  }
  // screen-space info for tile i: top-face centre and its four corners (NW, NE, SE, SW), in CSS px
  function project(i) {
    tileBox(i, box);
    const y = box.max.y, c = [];
    for (const [x, z] of [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.max.x, box.max.z], [box.min.x, box.max.z]]) c.push(toScreen(tmpS.set(x, y, z)));
    const ctr = toScreen(tmpS.set((box.min.x + box.max.x) / 2, y, (box.min.z + box.max.z) / 2));
    // the south and east faces too, so rings can wrap the whole visible tile
    const lo = [[box.max.x, box.max.z], [box.min.x, box.max.z], [box.max.x, box.min.z]].map(([x, z]) => toScreen(tmpS.set(x, box.min.y, z)));
    return { x: ctr[0], y: ctr[1], quad: c.map((p) => [p[0], p[1]]), low: lo.map((p) => [p[0], p[1]]) };
  }
  function worldToScreen(x, y, z) { return toScreen(tmpS.set(x, y, z)); }
  function setSlab(on) { slab.visible = rim.visible = on; renderer.shadowMap.needsUpdate = true; }
  function tileBase(i) { return base[i]; }
  function boardTop() { return bounds.maxY; }
  function tilePx() { return (UW - GAP) * fitState.pxPerUnit; }

  // Render a layout (with the given faces) into a 2D canvas, for the layout picker. The caller must set the real
  // board again afterwards (setBoard), since this replaces it.
  function snapshot(pos, faces, cv2d, o = {}) {
    const keep = { w: view.w, h: view.h, dpr: view.dpr, zoom: view.zoom, panX: view.panX, panY: view.panY, pitch: view.pitch, yaw: view.yaw, mode: view.mode };
    if (o.mode) view.mode = o.mode;
    if (o.pitch != null) view.pitch = o.pitch; if (o.yaw != null) view.yaw = o.yaw;
    const slabWas = slab.visible; if (o.slab === false) slab.visible = rim.visible = false;
    const w = cv2d.clientWidth || 240, h = cv2d.clientHeight || 130, dpr = Math.min(2, window.devicePixelRatio || 1);
    setBoard(pos);
    update(pos.map((p, i) => ({ show: true, face: faces[i] })));
    Object.assign(view, { zoom: 1.08, panX: 0, panY: 0 });
    resize(w, h, dpr);
    render(true);
    cv2d.width = Math.round(w * dpr); cv2d.height = Math.round(h * dpr);
    const c2 = cv2d.getContext('2d');
    if (o.under) { c2.save(); c2.scale(dpr, dpr); o.under(c2, w, h); c2.restore(); }
    c2.drawImage(renderer.domElement, 0, 0, cv2d.width, cv2d.height);
    slab.visible = rim.visible = slabWas;
    Object.assign(view, { zoom: keep.zoom, panX: keep.panX, panY: keep.panY, pitch: keep.pitch, yaw: keep.yaw, mode: keep.mode });
    resize(keep.w, keep.h, keep.dpr);
  }
  // Compile the shaders (and upload the atlas) ahead of the first game, e.g. while the title screen is idle.
  function warm() {
    if (!mesh) setBoard([[0, 0, 0]]);
    try { renderer.compile(scene, camera); } catch (e) { /* compile is only a head start */ }
  }
  function dispose() {
    if (mesh) { scene.remove(mesh); mesh.dispose(); }
    geo.dispose(); mat.dispose(); atlasTex.dispose(); renderer.dispose();
  }
  return {
    renderer, scene, get camera() { return camera; }, setBoard, setAtlas, setStyle, resize, setView, update, render, warm, snapshot, setSlab, pick, project, worldToScreen, tileBase, boardTop, tilePx, boardPx, dispose,
    get info() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, gl: renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl1' }; },
    TH, UW, UD, view,
  };
}

window.MJ3D = { supported, probe, create, TH, UW, UD };
})();
