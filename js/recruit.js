/* ============================================
   Recruit Page — Interactive Card Logic
   ============================================ */
(function() {
  'use strict';

  var cards = document.querySelectorAll('.rc-pos-card');
  var actionsBar = document.getElementById('rc-actions');
  var detailArea = document.getElementById('rc-detail-area');
  var applyArea = document.getElementById('rc-apply-area');
  var applyPosName = document.getElementById('rc-apply-pos-name');
  var actionBtns = actionsBar ? actionsBar.querySelectorAll('.rc-action-btn') : [];
  var details = detailArea ? detailArea.querySelectorAll('.rc-detail') : [];

  var selectedPos = null;
  var currentView = null; // 'detail' or 'apply'

  // Position name map
  var posNames = {
    manga: '漫画家',
    production: 'マンガ製作担当',
    sales: '営業'
  };

  // --- Card Click ---
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      var pos = this.getAttribute('data-pos');

      // Toggle: clicking same card again deselects
      if (selectedPos === pos) {
        resetAll();
        return;
      }

      selectedPos = pos;
      currentView = null;

      // Update card active states
      cards.forEach(function(c) { c.classList.remove('is-active'); });
      this.classList.add('is-active');

      // Show action buttons
      actionsBar.style.display = '';

      // Reset action button states
      actionBtns.forEach(function(btn) { btn.classList.remove('is-active'); });

      // Hide detail & apply areas
      hideAllDetails();
      applyArea.style.display = 'none';
      detailArea.style.display = 'none';

      // Scroll to actions
      setTimeout(function() {
        actionsBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });

  // --- Action Button Click ---
  actionBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var action = this.getAttribute('data-action');
      if (!selectedPos) return;

      // Update button states
      actionBtns.forEach(function(b) { b.classList.remove('is-active'); });
      this.classList.add('is-active');

      if (action === 'detail') {
        currentView = 'detail';
        applyArea.style.display = 'none';
        showDetail(selectedPos);
      } else if (action === 'apply') {
        currentView = 'apply';
        hideAllDetails();
        detailArea.style.display = 'none';
        showApply(selectedPos);
      }
    });
  });

  function showDetail(pos) {
    detailArea.style.display = '';
    hideAllDetails();
    var target = detailArea.querySelector('[data-detail="' + pos + '"]');
    if (target) {
      target.classList.add('is-visible');
      setTimeout(function() {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  function showApply(pos) {
    if (applyPosName) {
      applyPosName.textContent = posNames[pos] || pos;
    }
    applyArea.style.display = '';
    setTimeout(function() {
      applyArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function hideAllDetails() {
    details.forEach(function(d) { d.classList.remove('is-visible'); });
  }

  function resetAll() {
    selectedPos = null;
    currentView = null;
    cards.forEach(function(c) { c.classList.remove('is-active'); });
    actionsBar.style.display = 'none';
    detailArea.style.display = 'none';
    applyArea.style.display = 'none';
    hideAllDetails();
    actionBtns.forEach(function(b) { b.classList.remove('is-active'); });
  }
})();
