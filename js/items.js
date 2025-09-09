document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.actions-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Close other dropdowns
      document.querySelectorAll('.actions-dropdown').forEach(function (drop) {
        if (drop !== btn.parentNode) drop.classList.remove('open');
      });
      btn.parentNode.classList.toggle('open');
    });
  });

  document.addEventListener('click', function () {
    document.querySelectorAll('.actions-dropdown').forEach(function (drop) {
      drop.classList.remove('open');
    });
  });
  
  // Keyboard support for accessibility
  document.querySelectorAll('.actions-btn').forEach(function (btn) {
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
});