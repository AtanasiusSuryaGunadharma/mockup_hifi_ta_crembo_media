/**
 * _sidebar-fix.js
 * Crembo Media - Auto-fix sidebar active state & open parent group
 * Include this at the END of every admin/anggota dashboard page <body>
 */
(function () {
  'use strict';

  var path = window.location.pathname.split('/').pop() || 'index.html';
  var search = window.location.search;

  // Map pages to their canonical filename (handles query params)
  function getLinkFilename(href) {
    if (!href) return '';
    return href.split('?')[0].split('#')[0].split('/').pop();
  }

  // Remove all active from ALL menu links first
  var allLinks = Array.from(document.querySelectorAll('.menu-link'));
  allLinks.forEach(function (link) {
    link.classList.remove('active');
  });

  // Find matching links and activate them
  var activated = false;
  allLinks.forEach(function (link) {
    var linkFile = getLinkFilename(link.getAttribute('href'));
    if (linkFile && linkFile === path) {
      link.classList.add('active');
      activated = true;

      // Auto-open parent menu-group
      var group = link.closest('.menu-group');
      if (group) {
        group.classList.add('open');
        // Update toggle marker text
        var toggleBtn = group.querySelector('.group-toggle, .menu-toggle');
        if (toggleBtn) {
          var marker = toggleBtn.querySelector('span');
          if (marker) marker.textContent = '-';
        }
      }
    }
  });

  // Setup toggle for all group buttons (idempotent)
  var groups = Array.from(document.querySelectorAll('.menu-group'));
  groups.forEach(function (group) {
    var btn = group.querySelector('.group-toggle, .menu-toggle');
    if (!btn || btn._sidebarFixed) return;
    btn._sidebarFixed = true;

    btn.addEventListener('click', function () {
      group.classList.toggle('open');
      var marker = btn.querySelector('span');
      if (marker) marker.textContent = group.classList.contains('open') ? '-' : '+';
    });
  });

  // Mobile sidebar toggle — find the button regardless of id
  var mobileBtns = Array.from(document.querySelectorAll(
    '#mobileSidebarBtn, #mobileMenuBtn, .mobile-toggle, .mobile-menu'
  ));
  var sidebar = document.getElementById('sidebar');

  mobileBtns.forEach(function (btn) {
    if (!btn || btn._mobileSidebarFixed) return;
    btn._mobileSidebarFixed = true;
    btn.addEventListener('click', function () {
      if (sidebar) sidebar.classList.toggle('show');
    });
  });

  // Close sidebar when clicking outside (mobile)
  document.addEventListener('click', function (e) {
    if (!sidebar) return;
    if (!sidebar.classList.contains('show')) return;
    if (sidebar.contains(e.target)) return;
    var isMobileBtn = mobileBtns.some(function (btn) { return btn && btn.contains(e.target); });
    if (!isMobileBtn) sidebar.classList.remove('show');
  });

})();
