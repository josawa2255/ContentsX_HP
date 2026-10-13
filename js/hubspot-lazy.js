/* HubSpot 追跡コードの遅延読み込み（初回のユーザー操作か4秒経過で読み込む）。
   2026-10-13: index / company / recruit / news-detail に同じ埋め込みがあったのを1本にまとめた。 */
(function(){
  var loaded = false;
  function loadHS(){
    if (loaded) return; loaded = true;
    var s = document.createElement('script');
    s.id = 'hs-script-loader';
    s.async = true;
    s.defer = true;
    s.src = '//js-na2.hs-scripts.com/48367061.js';
    document.head.appendChild(s);
    ['scroll','mousemove','touchstart','keydown','click'].forEach(function(ev){
      window.removeEventListener(ev, loadHS, {passive:true});
    });
  }
  ['scroll','mousemove','touchstart','keydown','click'].forEach(function(ev){
    window.addEventListener(ev, loadHS, {passive:true, once:true});
  });
  setTimeout(loadHS, 4000);
})();
