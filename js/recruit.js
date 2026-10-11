/* ============================================
   Recruit Page（HERO → 募集職種 → 選考 → エントリー → TOPICS）
   - 見出し・カード・ステップの登場は js/sitewide-motion.js（下層ページ共通）
   - ここでは採用ページ固有の3つだけを扱う:
     1) HERO の X を背景画像が届いてから描く
     2) 職種カード「詳細を見る」→ カード一覧の直下に募集要項を開閉
     3) スクロール量で動く演出（募集職種の日差しだけ）
   選考の線・エントリーの紙飛行機は CSS だけで描く（sitewide-motion.js の登場に連動）。
   背景は .rc-stage__bg の共通の1枚で、職種を選んでも切り替えない。
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

  // --- 2) 職種カード「詳細を見る」→ 募集要項 ---
  // カードは #detail-xxx へのリンク（JSが無ければ全件表示の募集要項へ移動するだけ）。
  // JSがあるときは、その職種のグループ（漫画家 / 漫画制作は「漫画家」「マンガ製作担当」の2件）だけを同じ場所に開く。
  // 同じカードをもう一度押す・「募集要項を閉じる」・Esc で閉じる。開閉は role="status" で読み上げる。
  var req = document.querySelector('[data-rc-req]');
  var cards = document.querySelectorAll('.rc-op-card[data-req]');
  if (req && cards.length) {
    var details = req.querySelectorAll('.rc-detail');
    var closeBtns = req.querySelectorAll('[data-rc-req-close]');
    var status = document.querySelector('[data-rc-req-status]');
    var openGroup = null;
    req.classList.add('is-enhanced');
    closeBtns.forEach(function(btn) { btn.hidden = false; });

    var isJa = function() { return !(window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en'); };
    var cardTitle = function(group) {
      var t = document.querySelector('.rc-op-card[data-req="' + group + '"] .rc-op-card__title');
      return t ? t.textContent.trim() : '';
    };
    var announce = function(text) { if (status) status.textContent = text; };
    // 固定ヘッダーに隠れる・画面の下の方にある場合だけ動かす（scroll-margin-top で着地位置を決める）
    var scrollToEl = function(el, force) {
      var top = el.getBoundingClientRect().top;
      if (!force && top >= 88 && top <= window.innerHeight * 0.6) return;
      el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    };
    var setOpen = function(group) {
      openGroup = group;
      req.classList.toggle('is-open', !!group);
      details.forEach(function(d) { d.classList.toggle('is-open', d.getAttribute('data-group') === group); });
      cards.forEach(function(c) { c.setAttribute('aria-expanded', String(c.getAttribute('data-req') === group)); });
    };
    var close = function(focusCard) {
      var card = document.querySelector('.rc-op-card[data-req="' + openGroup + '"]');
      var name = cardTitle(openGroup);
      setOpen(null);
      announce(isJa() ? name + 'の募集要項を閉じました' : 'Closed the ' + name + ' requirements');
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      // Safariはクリック中に閉じたボタンのフォーカスを後からbodyへ戻すことがある。
      // 閉じた表示が確定した次フレームで、選択元へ戻す。
      if (card && focusCard) {
        window.requestAnimationFrame(function() {
          card.focus({ preventScroll: true });
          scrollToEl(card);
        });
      }
    };

    cards.forEach(function(card) {
      card.addEventListener('click', function(e) {
        e.preventDefault();
        var group = this.getAttribute('data-req');
        if (group === openGroup) { close(false); return; }
        setOpen(group);
        announce(isJa() ? cardTitle(group) + 'の募集要項を開きました' : 'Opened the ' + cardTitle(group) + ' requirements');
        var first = req.querySelector('.rc-detail.is-open');
        if (first) {
          if (history.replaceState) history.replaceState(null, '', '#' + first.id);
          scrollToEl(window.matchMedia('(max-width: 899px)').matches ? req : first);
        }
      });
      // リンクを「開閉ボタン」として使っているので、Space でも押せるようにする
      card.addEventListener('keydown', function(e) {
        if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); this.click(); }
      });
    });
    closeBtns.forEach(function(btn) { btn.addEventListener('click', function() { close(true); }); });
    req.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && openGroup) close(true);
    });

    // /recruit#detail-sales のような直リンク（JSON-LD の url もこの形）では該当職種を開いて見せる
    var fromHash = function() {
      var target = location.hash && req.querySelector('.rc-detail' + location.hash.replace(/[^#\w-]/g, ''));
      if (!target) return;
      setOpen(target.getAttribute('data-group'));
      scrollToEl(target, true);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  // --- 3) スクロール量で動く演出（日差しだけ。ここだけでスクロールを監視する） ---
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
  };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', stop);
  else if (reduceMotion.addListener) reduceMotion.addListener(stop);
})();
