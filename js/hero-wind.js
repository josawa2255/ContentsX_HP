/**
 * Hero 風揺れエフェクト (Three.js + GLSL シェーダ)
 *
 * 既存の .hero-bizchar-img active 状態を canvas overlay で置き換え、
 * Y座標に応じて画面下側ほど強い水平変位（風）を与える。
 * マスク無しで「スカート相当の領域だけ揺れる」効果を出す。
 *
 * パフォーマンス:
 *  - 1 RTT (Plane) のみ、軽量シェーダ
 *  - DPR は 1.5 でクランプして塗り過ぎ防止
 *  - active な画像が無い間は requestAnimationFrame を停止
 *  - prefers-reduced-motion / モバイル(<=768px) はスキップ
 */
(function() {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth <= 768) return; // モバイルはスキップ（OPもスキップ済み）

  var canvas = document.getElementById('heroBizcharCanvas');
  var bizchar = document.getElementById('heroBizchar');
  if (!canvas || !bizchar) return;

  var imgs = Array.from(bizchar.querySelectorAll('.hero-bizchar-img'));
  if (imgs.length === 0) return;

  // Three.js を CDN から動的ロード（小さく抑えるため core のみ）
  function loadThree(cb) {
    if (window.THREE) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.min.js';
    s.async = true;
    s.onload = cb;
    s.onerror = function() { console.warn('[hero-wind] Three.js load failed, falling back to static image'); };
    document.head.appendChild(s);
  }

  loadThree(function() {
    if (!window.THREE) {
      console.warn('[hero-wind] THREE未ロード');
      return;
    }
    console.log('[hero-wind] Three.js loaded, init wind effect');
    init();
  });

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

    // テクスチャ事前ロード
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

    var uniforms = {
      uTex:       { value: null },
      uTime:      { value: 0 },
      uIntensity: { value: 3.0 }, // 強めに（後で微調整）
      uAspect:    { value: 1.0 },
      uTexAspect: { value: 1.5 } // 1200/800
    };

    var vertex = [
      'varying vec2 vUv;',
      'void main(){',
      '  vUv = uv;',
      '  gl_Position = vec4(position, 1.0);',
      '}'
    ].join('\n');

    // フラグメント: 風揺れ
    //   - 下側ほど強い水平変位（スカート相当）
    //   - 上側にも控えめに横揺れ（髪相当）
    //   - 画面アスペクトに合わせて UV を「cover」相当に補正
    var fragment = [
      'precision mediump float;',
      'uniform sampler2D uTex;',
      'uniform float uTime;',
      'uniform float uIntensity;',
      'uniform float uAspect;',
      'uniform float uTexAspect;',
      'varying vec2 vUv;',
      '',
      '// object-fit: cover 相当の UV 計算（中央クロップ）',
      'vec2 coverUv(vec2 uv){',
      '  float r = uAspect / uTexAspect;',
      '  vec2 result = uv;',
      '  if (r > 1.0) {',
      '    // canvas が画像より横長 → 縦をクロップ',
      '    result.y = (uv.y - 0.5) / r + 0.5;',
      '  } else {',
      '    // canvas が画像より縦長 → 横をクロップ',
      '    result.x = (uv.x - 0.5) * r + 0.5;',
      '  }',
      '  return result;',
      '}',
      '',
      'void main(){',
      '  vec2 uv = coverUv(vUv);',
      '',
      '  // Y 座標ベースの風強度プロファイル',
      '  // テクスチャUVは上が0、下が1なので注意（vUv はWebGLで通常下=0だがTHREE.TextureLoader経由は flipY:true で上=0）',
      '  // 下半身（uv.y > 0.5）: 強, 上半身（uv.y < 0.3）: 控えめ',
      '  float skirtArea = smoothstep(0.45, 0.95, uv.y);  // 下が強い（uv.y=1が下端）',
      '  float hairArea  = smoothstep(0.35, 0.0, uv.y) * 0.5;',
      '  float windStr   = (skirtArea + hairArea) * uIntensity;',
      '',
      '  // 二重サイン波で複雑な波形（自然な風感）— 振幅を大きく',
      '  float wave1 = sin(uv.y * 6.0 + uTime * 2.0) * 0.025;',
      '  float wave2 = sin(uv.y * 13.0 - uTime * 1.2) * 0.012;',
      '  float displacement = (wave1 + wave2) * windStr;',
      '',
      '  uv.x += displacement;',
      '',
      '  // クロップ範囲外（黒）防止',
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
    var running = false;
    var currentStep = null;

    function frame() {
      uniforms.uTime.value = (performance.now() - startTime) / 1000;
      var rect = bizchar.getBoundingClientRect();
      uniforms.uAspect.value = rect.width / rect.height;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true;
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
      if (step === currentStep && running) return;
      currentStep = step;
      var tex = textures[step];
      if (!tex) { stop(); return; }
      uniforms.uTex.value = tex;
      // 各画像のアスペクト
      if (activeImg.naturalWidth > 0) {
        uniforms.uTexAspect.value = activeImg.naturalWidth / activeImg.naturalHeight;
      }
      sizeCanvas();
      console.log('[hero-wind] active step:', step, 'tex loaded:', tex.image && tex.image.complete);
      start();
    }

    // .active 切替を監視（JS が classList.toggle するタイミング）
    var observer = new MutationObserver(applyActive);
    imgs.forEach(function(img) {
      observer.observe(img, { attributes: true, attributeFilter: ['class'] });
    });

    // Phase 2 突入で停止
    window.addEventListener('hero-phase2-start', function() {
      // 0.6s フェード分の余裕を持って停止
      setTimeout(stop, 800);
    });

    applyActive();
  }
})();
