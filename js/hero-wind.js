/**
 * Hero 風揺れエフェクト (Three.js + GLSL シェーダ + Verlet スプリングチェーン)
 *
 * スカートを縦8段のスプリング鎖で物理シミュレートし、
 * 慣性・遅延付きで「布が遅れて揺れて戻る」リアル挙動を再現する Live2D 風実装。
 *  - JS 側: Verlet 統合 + 親追従スプリング、突風ノイズで駆動
 *  - GLSL 側: チェーン配列を補間して uv.x にディスプレース
 *
 * パフォーマンス:
 *  - 1 RTT (Plane) のみ、軽量シェーダ
 *  - 物理は 8 ノードのみ → 1 フレーム数十演算で完了
 *  - DPR は 1.5 でクランプ
 *  - active な画像が無い間は requestAnimationFrame を停止
 *  - prefers-reduced-motion / モバイル(<=768px) はスキップ
 */
(function() {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth <= 768) return;

  var canvas = document.getElementById('heroBizcharCanvas');
  var bizchar = document.getElementById('heroBizchar');
  if (!canvas || !bizchar) return;

  var imgs = Array.from(bizchar.querySelectorAll('.hero-bizchar-img'));
  if (imgs.length === 0) return;

  function loadThree(cb) {
    if (window.THREE) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js';
    s.async = true;
    s.onload = cb;
    s.onerror = function() { console.warn('[hero-wind] Three.js load failed'); };
    document.head.appendChild(s);
  }

  loadThree(function() {
    if (!window.THREE) { console.warn('[hero-wind] THREE未ロード'); return; }
    console.log('[hero-wind] Three.js loaded, init wind effect');
    init();
  });

  // --- スカート Verlet 物理パラメータ ---
  var CHAIN_N      = 8;       // 鎖の段数（必ずシェーダ内 array サイズと合わせる）
  var SKIRT_TOP    = 0.51;    // 腰位置 (画像 uv.y)
  var SKIRT_BOTTOM = 0.64;    // 裾位置 (画像 uv.y)
  var DAMPING      = 0.93;    // 速度減衰（1=減衰なし、0=即停止）
  var STIFFNESS    = 0.22;    // 親への追従バネ強度
  var WIND_AMP     = 0.0055;  // 1 段あたりの風入力（uv 単位）

  function init() {
    var THREE = window.THREE;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    function sizeCanvas() {
      var rect = bizchar.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
    }
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var loader = new THREE.TextureLoader();
    var textures = {};
    imgs.forEach(function(img) {
      var step = img.dataset.step;
      var tex = loader.load(img.src);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      textures[step] = tex;
    });

    // チェーン状態（pos/prev は uv 単位の水平変位）
    var chain = [];
    for (var i = 0; i < CHAIN_N; i++) chain.push({ pos: 0, prev: 0 });
    var chainArr = new Float32Array(CHAIN_N);

    var uniforms = {
      uTex:         { value: null },
      uTime:        { value: 0 },
      uIntensity:   { value: 1.0 },
      uAspect:      { value: 1.0 },
      uTexAspect:   { value: 1.5 },
      uChain:       { value: chainArr },
      uSkirtTop:    { value: SKIRT_TOP },
      uSkirtBottom: { value: SKIRT_BOTTOM }
    };

    var vertex = [
      'varying vec2 vUv;',
      'void main(){',
      '  vUv = uv;',
      '  gl_Position = vec4(position, 1.0);',
      '}'
    ].join('\n');

    var fragment = [
      'precision mediump float;',
      'uniform sampler2D uTex;',
      'uniform float uTime;',
      'uniform float uIntensity;',
      'uniform float uAspect;',
      'uniform float uTexAspect;',
      'uniform float uChain[8];',
      'uniform float uSkirtTop;',
      'uniform float uSkirtBottom;',
      'varying vec2 vUv;',
      '',
      'vec2 coverUv(vec2 uv){',
      '  float r = uAspect / uTexAspect;',
      '  vec2 result = uv;',
      '  if (r > 1.0) {',
      '    result.y = (uv.y - 0.5) / r + 0.5;',
      '  } else {',
      '    result.x = (uv.x - 0.5) * r + 0.5;',
      '  }',
      '  return result;',
      '}',
      '',
      '// チェーン配列を線形補間して uv.y 位置の水平変位を返す',
      'float chainDispAt(float y){',
      '  float t  = clamp((y - uSkirtTop) / (uSkirtBottom - uSkirtTop), 0.0, 1.0);',
      '  float fi = t * 7.0;   // CHAIN_N - 1',
      '  float disp = 0.0;',
      '  for (int i = 0; i < 8; i++) {',
      '    float w = max(0.0, 1.0 - abs(float(i) - fi));',
      '    disp += uChain[i] * w;',
      '  }',
      '  return disp;',
      '}',
      '',
      'void main(){',
      '  vec2 uv = coverUv(vUv);',
      '',
      '  // スカートマスク（腰0.51〜裾0.64、その下は急速に0）',
      '  float skirtMask = smoothstep(0.51, 0.64, uv.y) * (1.0 - smoothstep(0.64, 0.68, uv.y));',
      '  float dispX = chainDispAt(uv.y) * skirtMask * uIntensity;',
      '',
      '  uv.x += dispX;',
      '  uv = clamp(uv, 0.001, 0.999);',
      '',
      '  gl_FragColor = texture2D(uTex, uv);',
      '}'
    ].join('\n');

    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true
    });
    var geometry = new THREE.PlaneGeometry(2, 2);
    var mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    var rafId = null;
    var startTime = performance.now();
    var lastT = null;
    var running = false;
    var currentStep = null;

    // 風入力（時間のみ依存・複数周波数の合成）
    function windAt(t) {
      return (
        Math.sin(t * 0.7)             * 0.55 +
        Math.sin(t * 1.6 + 1.3)       * 0.30 +
        Math.sin(t * 3.1 + 2.7)       * 0.15
      );
    }

    // チェーン物理ステップ（1フレーム）
    function stepChain(t) {
      if (lastT === null) lastT = t;
      var dt = Math.min(0.040, t - lastT);
      lastT = t;
      // 60fps 想定でステップを正規化（dt変動への耐性）
      var sub = Math.max(1, Math.round(dt / 0.016));
      var w = windAt(t);

      for (var s = 0; s < sub; s++) {
        // i=0 は腰（pin）
        chain[0].pos = 0;
        chain[0].prev = 0;
        for (var i = 1; i < CHAIN_N; i++) {
          var hemRatio = i / (CHAIN_N - 1);          // 0..1
          // 各ノードの目標位置 = 親の位置 + 風入力（裾ほど強い）
          var target = chain[i-1].pos + w * WIND_AMP * hemRatio;
          // Verlet 風: 速度（前回比）+ 目標へのバネ
          var velocity = (chain[i].pos - chain[i].prev) * DAMPING;
          var force    = (target - chain[i].pos) * STIFFNESS;
          var newPos   = chain[i].pos + velocity + force;
          chain[i].prev = chain[i].pos;
          chain[i].pos  = newPos;
        }
      }

      for (var k = 0; k < CHAIN_N; k++) chainArr[k] = chain[k].pos;
    }

    function frame() {
      var now = performance.now();
      var t = (now - startTime) / 1000;
      uniforms.uTime.value = t;
      var rect = bizchar.getBoundingClientRect();
      uniforms.uAspect.value = rect.width / rect.height;

      stepChain(t);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true;
      lastT = null;
      bizchar.classList.add('has-wind');
      canvas.classList.add('active');
      frame();
    }
    function stop() {
      if (!running) return;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      canvas.classList.remove('active');
      bizchar.classList.remove('has-wind');
    }

    function applyActive() {
      var activeImg = bizchar.querySelector('.hero-bizchar-img.active');
      if (!activeImg) { stop(); return; }
      var step = activeImg.dataset.step;
      if (step !== 'logo') { stop(); currentStep = step; return; }
      if (step === currentStep && running) return;
      currentStep = step;
      var tex = textures[step];
      if (!tex) { stop(); return; }
      uniforms.uTex.value = tex;
      if (activeImg.naturalWidth > 0) {
        uniforms.uTexAspect.value = activeImg.naturalWidth / activeImg.naturalHeight;
      }
      sizeCanvas();
      console.log('[hero-wind] active step:', step);
      start();
    }

    var observer = new MutationObserver(applyActive);
    imgs.forEach(function(img) {
      observer.observe(img, { attributes: true, attributeFilter: ['class'] });
    });

    window.addEventListener('hero-phase2-start', function() {
      setTimeout(stop, 800);
    });

    applyActive();
  }
})();
