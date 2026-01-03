// Language switcher functionality
(function() {
  'use strict';

  // Get current language from URL or localStorage
  function getCurrentLang() {
    const path = window.location.pathname;
    if (path.startsWith('/ko/')) {
      return 'ko';
    }
    const savedLang = localStorage.getItem('preferred-lang');
    return savedLang || 'en';
  }

  // Set language preference
  function setLang(lang) {
    localStorage.setItem('preferred-lang', lang);
    const currentPath = window.location.pathname;
    
    // Remove /ko/ prefix if exists
    let newPath = currentPath.replace(/^\/ko\//, '/');
    
    // Add /ko/ prefix for Korean
    if (lang === 'ko' && !newPath.startsWith('/ko/')) {
      newPath = '/ko' + newPath;
    }
    
    // Remove /ko/ prefix for English
    if (lang === 'en' && newPath.startsWith('/ko/')) {
      newPath = newPath.replace(/^\/ko\//, '/');
    }
    
    // Redirect to new path
    if (newPath !== currentPath) {
      window.location.href = newPath;
    } else {
      // Same path, just update UI
      updateUI(lang);
    }
  }

  // Update UI elements with translations
  function updateUI(lang) {
    // Update active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
      if (btn.dataset.lang === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update HTML lang attribute
    document.documentElement.lang = lang;

    // Update elements with data-i18n attribute
    // Note: This requires translations to be loaded
    // For now, we'll handle this via Jekyll's data files
  }

  // Get language-specific URL
  function getLangUrl(lang, currentPath) {
    if (lang === 'ko') {
      // Add /ko/ prefix
      if (currentPath === '/' || currentPath === '') {
        return '/ko/';
      }
      if (!currentPath.startsWith('/ko/')) {
        return '/ko' + currentPath;
      }
      return currentPath;
    } else {
      // Remove /ko/ prefix for English
      if (currentPath.startsWith('/ko/')) {
        return currentPath.replace(/^\/ko\//, '/');
      }
      return currentPath;
    }
  }

  // Fix back links in project pages
  function fixBackLinks() {
    const currentLang = getCurrentLang();
    const backLinks = document.querySelectorAll('a[href="/works/"], a[href="/ko/works/"]');
    
    backLinks.forEach(link => {
      if (currentLang === 'ko') {
        link.href = '/ko/works/';
        if (link.textContent.includes('back')) {
          link.textContent = '← 뒤로';
        }
      } else {
        link.href = '/works/';
        if (link.textContent.includes('뒤로')) {
          link.textContent = '← back';
        }
      }
    });
  }

  // Initialize
  function init() {
    const currentLang = getCurrentLang();
    updateUI(currentLang);

    // Update language button hrefs based on current path
    const currentPath = window.location.pathname;
    document.querySelectorAll('.lang-btn').forEach(btn => {
      const lang = btn.dataset.lang;
      const langUrl = getLangUrl(lang, currentPath);
      btn.href = langUrl;
    });

    // Fix back links
    fixBackLinks();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

