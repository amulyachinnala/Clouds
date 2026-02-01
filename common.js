(function(){
  const OVERLAY_ID = 'loadingOverlay';
  const SESSION_KEY = 'lemoney_loading_active';
  const FADE_MS = 1000; // matches CSS transition

  function createOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    const img = document.createElement('img');
    img.id = 'loadingGif';
    img.src = 'Graphics/loading.gif';
    img.alt = 'Loading';
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    return overlay;
  }

  function showOverlay() {
    const overlay = createOverlay();
    overlay.classList.remove('overlay-fade-out');
    // ensure visible (in case JS hid it previously)
    overlay.style.display = 'flex';
    document.body.classList.add('no-scroll');
  }

  function hideOverlay(afterMs = FADE_MS) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.add('overlay-fade-out');
    setTimeout(() => {
      // remove overlay from DOM to avoid interfering with page layout
      try { overlay.style.display = 'none'; } catch(e){}
      document.body.classList.remove('no-scroll');
    }, afterMs + 50);
  }

  function showThenNavigateToHome() {
    // set flag so home page shows the brief overlay on load
    sessionStorage.setItem(SESSION_KEY, '1');
    showOverlay();
    setTimeout(() => { window.location.href = 'home.html'; }, 600);
  }

  // Attach click handlers to logo images
  function attachLogoHandlers() {
    const logos = document.querySelectorAll('.brand-text-img, .brand-avatar-img');
    logos.forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        // if already on home, show overlay briefly but don't navigate
        const onHome = window.location.pathname.endsWith('home.html') || window.location.pathname === '/' || window.location.pathname.endsWith('\\');
        if (onHome) {
          showOverlay();
          setTimeout(() => hideOverlay(800), 900);
        } else {
          showThenNavigateToHome();
        }
      });
    });
  }

  // On page load, if navigated here via overlay flag, show overlay then fade
  function onLoadCheck() {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      sessionStorage.removeItem(SESSION_KEY);
      showOverlay();
      setTimeout(() => hideOverlay(FADE_MS), 900);
    }
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    attachLogoHandlers();
    onLoadCheck();
  });

})();
