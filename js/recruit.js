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

  var posSection = document.getElementById('positions');

  var selectedPos = null;
  var currentView = null;

  // Position name map
  var posNames = {
    manga: '漫画家',
    production: 'マンガ製作担当',
    sales: '営業'
  };

  // Position hero image map
  var posImages = {
    manga: "url('material/images/recruit/manga.webp')",
    production: "url('material/images/recruit/production.webp')",
    sales: "url('material/images/recruit/sales.webp')"
  };

  // Switch positions section background with fade
  function switchPosBg(bgUrl) {
    if (!posSection) return;
    posSection.classList.add('rc-positions--fade');
    setTimeout(function() {
      if (bgUrl) {
        posSection.style.backgroundImage = bgUrl;
        posSection.classList.add('rc-positions--has-bg');
      } else {
        posSection.style.backgroundImage = '';
        posSection.classList.remove('rc-positions--has-bg');
      }
      posSection.classList.remove('rc-positions--fade');
    }, 300);
  }

  // --- Hero nav pill click → scroll to positions & select card ---
  var heroPills = document.querySelectorAll('.rc-hero-nav .rc-pill[data-pos]');
  heroPills.forEach(function(pill) {
    pill.addEventListener('click', function(e) {
      e.preventDefault();
      var pos = this.getAttribute('data-pos');
      // Find matching card and click it
      var matchCard = document.querySelector('.rc-pos-card[data-pos="' + pos + '"]');
      if (matchCard) {
        // Scroll to positions section first
        setTimeout(function() {
          var rect = posSection.getBoundingClientRect();
          var offset = window.pageYOffset + rect.top - 70;
          window.scrollTo({ top: offset, behavior: 'smooth' });
          // Then simulate card click after scroll
          setTimeout(function() {
            matchCard.click();
          }, 400);
        }, 50);
      }
    });
  });

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

      // Switch positions background
      if (posImages[pos]) {
        switchPosBg(posImages[pos]);
      }

      // Show action buttons
      actionsBar.style.display = '';

      // Reset action button states
      actionBtns.forEach(function(btn) { btn.classList.remove('is-active'); });

      // Hide detail & apply areas
      hideAllDetails();
      applyArea.style.display = 'none';
      detailArea.style.display = 'none';

      // Scroll to show full positions section with background
      setTimeout(function() {
        var rect = posSection.getBoundingClientRect();
        var offset = window.pageYOffset + rect.top - 70;
        window.scrollTo({ top: offset, behavior: 'smooth' });
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
        var name = posNames[selectedPos] || selectedPos;
        window.location.href = 'contact.html?position=' + encodeURIComponent(name);
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
    // Reset positions background
    switchPosBg(null);
  }
})();
