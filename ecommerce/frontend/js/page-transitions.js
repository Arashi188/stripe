// =============================================
// Page Transitions & Animation System
// =============================================
(function() {
    'use strict';

    var EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
    var EXIT_DURATION = 250;
    var ENTER_DURATION = 300;

    // ── Progress bar ──
    var progressBar = document.createElement('div');
    progressBar.id = 'pageProgress';
    progressBar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);z-index:99999;width:0;opacity:0;transition:width 0.3s '+EASE+',opacity 0.2s ease;border-radius:0 2px 2px 0';
    document.body.appendChild(progressBar);

    function startProgress() {
        progressBar.style.opacity = '1';
        progressBar.style.width = '30%';
        setTimeout(function() { progressBar.style.width = '70%'; }, 200);
    }

    function finishProgress() {
        progressBar.style.width = '100%';
        setTimeout(function() {
            progressBar.style.opacity = '0';
            setTimeout(function() { progressBar.style.width = '0'; }, 200);
        }, 200);
    }

    function failProgress() {
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg,#ef4444,#dc2626)';
        setTimeout(function() {
            progressBar.style.opacity = '0';
            setTimeout(function() { progressBar.style.width = '0'; progressBar.style.background = 'linear-gradient(90deg,#2563eb,#7c3aed)'; }, 200);
        }, 500);
    }

    // ── Page entry animation ──
    function animatePageIn() {
        // Don't animate on any page that has its own animation
        var mainContent = document.querySelector('.dashboard-content, .admin-content, .hero-section, .checkout-section');
        if (mainContent) {
            mainContent.style.opacity = '0';
            mainContent.style.transform = 'scale(0.98)';
            mainContent.style.transition = 'opacity ' + ENTER_DURATION + 'ms ' + EASE + ', transform ' + ENTER_DURATION + 'ms ' + EASE;
            requestAnimationFrame(function() {
                mainContent.style.opacity = '1';
                mainContent.style.transform = 'scale(1)';
            });
            setTimeout(function() { mainContent.style.transition = ''; }, ENTER_DURATION + 50);
            return;
        }

        // Fallback: animate the body's first child container
        var content = document.querySelector('.container:first-of-type, main, .page-wrapper');
        if (!content) content = document.body;
        content.style.opacity = '0';
        content.style.transform = 'scale(0.98)';
        content.style.transition = 'opacity ' + ENTER_DURATION + 'ms ' + EASE + ', transform ' + ENTER_DURATION + 'ms ' + EASE;
        requestAnimationFrame(function() {
            content.style.opacity = '1';
            content.style.transform = 'scale(1)';
        });
        setTimeout(function() { content.style.transition = ''; }, ENTER_DURATION + 50);
    }

    // ── Page exit navigation ──
    function isInternalLink(link) {
        if (!link || !link.href) return false;
        if (link.getAttribute('target') === '_blank') return false;
        if (link.getAttribute('href') === '#') return false;
        if (link.getAttribute('href') && link.getAttribute('href').startsWith('#')) return false;
        if (link.hasAttribute('data-bs-toggle') || link.hasAttribute('data-bs-target')) return false;
        if (link.getAttribute('href') && link.getAttribute('href').startsWith('javascript:')) return false;
        if (link.getAttribute('href') && link.getAttribute('href').startsWith('tel:')) return false;
        if (link.getAttribute('href') && link.getAttribute('href').startsWith('mailto:')) return false;
        if (link.closest('.dropdown-menu') && link.getAttribute('href') !== '#' && link.getAttribute('href') !== '') {
            var dropdownHref = link.getAttribute('href');
            if (dropdownHref && dropdownHref.indexOf('.html') !== -1) return true;
        }
        var url = new URL(link.href, window.location.origin);
        return url.hostname === window.location.hostname && url.pathname !== window.location.pathname;
    }

    function isPaystackFlow(link) {
        if (!link) return false;
        if (link.onclick && link.onclick.toString && link.onclick.toString().indexOf('paystack') !== -1) return true;
        if (link.getAttribute('onclick') && link.getAttribute('onclick').indexOf('paystack') !== -1) return true;
        return false;
    }

    function navigateWithTransition(href) {
        startProgress();
        var overlay = document.getElementById('pageTransition');
        if (overlay) {
            overlay.style.transition = 'opacity ' + (EXIT_DURATION - 50) + 'ms ease';
            overlay.classList.add('active');
        }
        var mainContent = document.querySelector('.dashboard-content, .admin-content, .hero-section, .checkout-section, .container:first-of-type, main, .page-wrapper');
        if (mainContent && !mainContent.closest('.modal')) {
            mainContent.style.transition = 'opacity ' + EXIT_DURATION + 'ms ease, transform ' + EXIT_DURATION + 'ms ease';
            mainContent.style.opacity = '0';
            mainContent.style.transform = 'scale(0.98)';
        }
        setTimeout(function() { window.location.href = href; }, EXIT_DURATION);
    }

    function handleLinkClick(e) {
        var link = e.currentTarget;
        if (isPaystackFlow(link)) return;
        if (link.closest('.modal')) return;
        if (link.hasAttribute('data-bs-toggle') || link.getAttribute('role') === 'tab') return;
        if (!isInternalLink(link)) return;
        e.preventDefault();
        navigateWithTransition(link.href);
    }

    function initPageTransitions() {
        document.querySelectorAll('a[href]').forEach(function(a) {
            if (!isInternalLink(a)) return;
            a.removeEventListener('click', handleLinkClick);
            a.addEventListener('click', handleLinkClick);
        });
    }

    // ── Bootstrap modal transitions ──
    function initModalTransitions() {
        document.addEventListener('shown.bs.modal', function(e) {
            var dialog = e.target.querySelector('.modal-dialog');
            if (dialog) {
                dialog.style.opacity = '0';
                dialog.style.transform = 'scale(0.95)';
                dialog.style.transition = 'opacity 0.3s ' + EASE + ', transform 0.3s ' + EASE;
                requestAnimationFrame(function() {
                    dialog.style.opacity = '1';
                    dialog.style.transform = 'scale(1)';
                });
            }
        });

        document.addEventListener('hide.bs.modal', function(e) {
            var dialog = e.target.querySelector('.modal-dialog');
            if (dialog) {
                dialog.style.opacity = '0';
                dialog.style.transform = 'scale(0.95)';
            }
        });
    }

    // ── Tab transitions ──
    function initTabTransitions() {
        document.addEventListener('shown.bs.tab', function(e) {
            var targetId = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
            if (!targetId) return;
            var target = document.querySelector(targetId);
            if (!target) return;
            target.style.opacity = '0';
            target.style.transform = 'translateY(8px)';
            target.style.transition = 'opacity 0.25s ' + EASE + ', transform 0.25s ' + EASE;
            requestAnimationFrame(function() {
                target.style.opacity = '1';
                target.style.transform = 'translateY(0)';
            });
            setTimeout(function() { target.style.transition = ''; }, 300);
        });
    }

    // ── Collapse/accordion transitions ──
    function initCollapseTransitions() {
        document.addEventListener('show.bs.collapse', function(e) {
            var heading = document.querySelector('[data-bs-target="#' + e.target.id + '"], [href="#' + e.target.id + '"]');
            if (heading) {
                var icon = heading.querySelector('.accordion-arrow, .dropdown-arrow, .fa-chevron-down, .fa-chevron-right, .fa-angle-down, .fa-angle-right');
                if (icon) {
                    icon.style.transition = 'transform 0.25s ' + EASE;
                    icon.style.transform = 'rotate(180deg)';
                }
            }
        });

        document.addEventListener('hide.bs.collapse', function(e) {
            var heading = document.querySelector('[data-bs-target="#' + e.target.id + '"], [href="#' + e.target.id + '"]');
            if (heading) {
                var icon = heading.querySelector('.accordion-arrow, .dropdown-arrow, .fa-chevron-down, .fa-chevron-right, .fa-angle-down, .fa-angle-right');
                if (icon) {
                    icon.style.transition = 'transform 0.25s ' + EASE;
                    icon.style.transform = 'rotate(0deg)';
                }
            }
        });
    }

    // ── Re-scan for dynamic content ──
    var observer = new MutationObserver(function() {
        initPageTransitions();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ── Init ──
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        animatePageIn();
        initPageTransitions();
        initModalTransitions();
        initTabTransitions();
        initCollapseTransitions();
        finishProgress();
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            animatePageIn();
            initPageTransitions();
            initModalTransitions();
            initTabTransitions();
            initCollapseTransitions();
            finishProgress();
        });
    }

    // Expose helpers globally
    window.startProgress = startProgress;
    window.finishProgress = finishProgress;
    window.failProgress = failProgress;
    window.navigateWithTransition = navigateWithTransition;
    window.animatePageIn = animatePageIn;
    window.initPageTransitions = initPageTransitions;

})();
