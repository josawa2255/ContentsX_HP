/* ============================================
   ContentsX HP — 下層ページ共通の小さな動き
   読み込み: company.html / news.html / news-detail.html
   2026-10-13: 旧トップ用の処理（フローギャラリー・漫画ショーケース・新作情報・
   漫画ビューア・セクションナビ・数字カウントアップ）は、該当する要素が
   どのページにも無くなったため削除。必要になったら git 履歴から戻す。
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');

  // ===== ヘッダースクロールエフェクト（クラス切替のみ。rAFで間引く） =====
  let headerScrolled = false;
  let headerTicking = false;
  window.addEventListener('scroll', () => {
    if (headerTicking) return;
    headerTicking = true;
    requestAnimationFrame(() => {
      const shouldBeScrolled = window.pageYOffset > 100;
      if (shouldBeScrolled !== headerScrolled) {
        headerScrolled = shouldBeScrolled;
        header.classList.toggle('header--scrolled', shouldBeScrolled);
      }
      headerTicking = false;
    });
  }, { passive: true });

  // ===== セクション見出しのフェードイン =====
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.section-title, .section-label').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
  });

  // ===== ページ内リンクのスムーススクロール（ヘッダー高さ分オフセット） =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        const targetPos = target.getBoundingClientRect().top + window.pageYOffset - header.offsetHeight;
        window.scrollTo({ top: targetPos, behavior: 'smooth' });
      }
    });
  });
});
