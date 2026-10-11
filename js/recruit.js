/* ============================================
   Recruit Page（HERO → 募集職種 → 選考 → エントリー → TOPICS）
   - 見出し・カード・ステップの登場は js/sitewide-motion.js（下層ページ共通）
   - ここでは採用ページ固有の3つだけを扱う:
     1) HERO の X を背景画像が届いてから描く
     2) 職種カード → 募集要項の開閉
     3) スクロール量で動く演出（募集職種の日差し・選考の線）。監視は1か所にまとめる
   JSが無い／動きを減らす設定のときは、どれも最終状態で表示される。
   ============================================ */
(function() {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // --- 1) Hero: Xの書き順アニメーションは背景画像が届いてから始める ---
  // 画像が未読込なら .is-waiting で描画を止め、読込後（または失敗・4秒経過）に外して再生する。
  var xHero = document.querySelector('.rc-xhero');
  var xHeroImg = xHero && xHero.querySelector('.rc-xhero__band');
  if (xHeroImg) {
    var probe = new Image();
    probe.src = xHeroImg.getAttribute('href');
    if (!probe.complete) {
      xHero.classList.add('is-waiting');
      var release = function() { xHero.classList.remove('is-waiting'); };
      probe.addEventListener('load', release);
      probe.addEventListener('error', release);
      setTimeout(release, 4000);
    }
  }

  // --- 2) 職種カード → 募集要項 ---
  // カードは #detail-xxx へのリンク。JSがあるときはその職種のグループ（漫画家/漫画制作は2件）だけを開く。
  var req = document.querySelector('[data-rc-req]');
  var cards = document.querySelectorAll('.rc-op-card[data-req]');
  if (req && cards.length) {
    var details = req.querySelectorAll('.rc-detail');
    var closeBtn = req.querySelector('[data-rc-req-close]');
    var openGroup = null;
    req.classList.add('is-enhanced');
    if (closeBtn) closeBtn.hidden = false;

    var scrollToEl = function(el) {
      el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    };
    var setOpen = function(group) {
      openGroup = group;
      req.classList.toggle('is-open', !!group);
      details.forEach(function(d) { d.classList.toggle('is-open', d.getAttribute('data-group') === group); });
      cards.forEach(function(c) { c.setAttribute('aria-expanded', String(c.getAttribute('data-req') === group)); });
    };

    cards.forEach(function(card) {
      card.addEventListener('click', function(e) {
        e.preventDefault();
        var group = this.getAttribute('data-req');
        if (group === openGroup) { setOpen(null); return; }
        setOpen(group);
        var first = req.querySelector('.rc-detail.is-open');
        if (first) {
          if (history.replaceState) history.replaceState(null, '', '#' + first.id);
          scrollToEl(first);
        }
      });
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        var card = document.querySelector('.rc-op-card[data-req="' + openGroup + '"]');
        setOpen(null);
        if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
        if (card) { card.focus({ preventScroll: true }); scrollToEl(card); }
      });
    }

    // /recruit#detail-sales のような直リンク（JSON-LD の url もこの形）では該当職種を開いて見せる
    var fromHash = function() {
      var target = location.hash && req.querySelector('.rc-detail' + location.hash.replace(/[^#\w-]/g, ''));
      if (!target) return;
      setOpen(target.getAttribute('data-group'));
      scrollToEl(target);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  // --- 3) スクロール量で動く演出（ここだけでスクロールを監視する） ---
  // 各シーンは「画面内のときだけ」計算する。値は CSS 変数に渡し、見た目は CSS 側で決める。
  // 変数は子要素のない要素に置く（sitewide-motion.js が style の変化を監視しているため、毎フレームの負担を増やさない）。
  // スクロールを止める・吸着させる処理は入れない。戻りスクロールでも同じ式で逆に戻るだけ。
  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;

  var clamp01 = function(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  var scenes = [];

  // 日差し（募集職種だけ）: セクションの上端が画面の下端に入ってから、画面の上から22%に来るまでで 0→1
  var light = document.querySelector('[data-rc-light]');
  var veil = document.querySelector('[data-rc-light-veil]');
  var opSection = light && light.closest('.rc-op');
  if (opSection) {
    scenes.push({
      el: opSection,
      read: function(rect, vh) { return clamp01((vh - rect.top) / (vh * 0.78)); },
      write: function(p) {
        light.style.setProperty('--rcop-p', p.toFixed(3));
        if (veil) veil.style.setProperty('--rcop-p', p.toFixed(3));
      }
    });
  }

  // 選考の線: 線の上端が画面の65%の高さを越えたところから伸び始め、下端が同じ高さに来ると伸び切る
  var flow = document.querySelector('[data-rc-flow]');
  if (flow) {
    var steps = flow.querySelectorAll('.rc-sel__step');
    var markers = flow.querySelectorAll('.rc-sel__marker');
    var track = flow.querySelector('.rc-sel__track');
    var progress = flow.querySelector('.rc-sel__progress');
    scenes.push({
      el: flow,
      read: function(rect, vh) {
        var line = vh * 0.65;
        var t = track.getBoundingClientRect();
        var p = clamp01((line - t.top) / Math.max(1, t.height));
        // 線の先端を越えたマーカーは「到達」
        var reached = [];
        markers.forEach(function(m) {
          var r = m.getBoundingClientRect();
          reached.push(r.top + r.height / 2 <= Math.max(line, t.top + t.height * p) + 1);
        });
        return { p: p, reached: reached };
      },
      write: function(v) {
        progress.style.setProperty('--rcsel-p', v.p.toFixed(3));
        steps.forEach(function(s, i) { s.classList.toggle('is-reached', v.reached[i]); });
      }
    });
  }
  if (!scenes.length) return;

  var raf = 0;
  var update = function() {
    raf = 0;
    var vh = window.innerHeight;
    // 先に全部読み、あとでまとめて書く（レイアウトの読み書きを交互にしない）
    var values = scenes.map(function(s) { return s.active ? s.read(s.el.getBoundingClientRect(), vh) : null; });
    scenes.forEach(function(s, i) { if (values[i] !== null) s.write(values[i]); });
  };
  var schedule = function() { if (!raf) raf = window.requestAnimationFrame(update); };

  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      scenes.forEach(function(s) { if (s.el === entry.target) s.active = entry.isIntersecting; });
    });
    schedule();
  }, { rootMargin: '25% 0px 25% 0px' });

  // 初期値を描いてから、段差をならす transition を有効にする（読込直後に動いて見えないように）
  scenes.forEach(function(s) {
    s.active = true;
    io.observe(s.el);
  });
  update();
  scenes.forEach(function(s) { s.active = false; });
  window.requestAnimationFrame(function() {
    if (opSection) opSection.classList.add('is-scrubbing');
    if (flow) flow.classList.add('is-scrubbing');
  });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  // 途中で「動きを減らす」に切り替えたら、最終状態に戻して監視をやめる
  var stop = function() {
    if (!reduceMotion.matches) return;
    io.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    scenes.forEach(function(s) { s.el.classList.remove('is-scrubbing'); });
    if (light) light.style.removeProperty('--rcop-p');
    if (veil) veil.style.removeProperty('--rcop-p');
    if (flow) {
      flow.querySelector('.rc-sel__progress').style.removeProperty('--rcsel-p');
      flow.querySelectorAll('.rc-sel__step').forEach(function(s) { s.classList.add('is-reached'); });
    }
  };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', stop);
  else if (reduceMotion.addListener) reduceMotion.addListener(stop);
})();
