/* ============================================
   Premium Mouse & Interaction Effects
   ============================================ */

(function () {
  'use strict';

  // ===== Comet Trail Cursor =====
  let mouseX = -100, mouseY = -100;
  let lastTrailTime = 0;
  let currentTrailClass = '';

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Throttle trail creation
    const now = Date.now();
    if (now - lastTrailTime < 30) return;
    lastTrailTime = now;

    const dot = document.createElement('div');
    dot.className = 'comet-dot' + (currentTrailClass ? ' ' + currentTrailClass : '');
    dot.style.left = mouseX + 'px';
    dot.style.top = mouseY + 'px';
    document.body.appendChild(dot);

    // Remove after animation
    setTimeout(() => dot.remove(), 600);
  });

  // Context-aware trail colors — event delegation, bound ONCE at init.
  // (The previous version re-ran querySelectorAll + addEventListener on every
  // MutationObserver tick, stacking duplicate mouseenter/mouseleave handlers
  // on every a/button — and the 30ms comet-dot churn fed the observer,
  // causing a listener avalanche. Delegation covers dynamically added nodes
  // with a single pair of document-level listeners.)
  function trailClassOf(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.closest('button.danger')) return 'on-danger';
    if (el.closest('button')) return 'on-button';
    if (el.closest('a, select, summary, .link-btn')) return 'on-interactive';
    return '';
  }

  document.addEventListener('mouseover', (e) => {
    const cls = trailClassOf(e.target);
    if (cls) currentTrailClass = cls;
  });

  document.addEventListener('mouseout', (e) => {
    if (!trailClassOf(e.relatedTarget)) currentTrailClass = '';
  });

  // ===== Ripple Effect on Buttons =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.primary, .secondary, .danger, .link-btn');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-wave';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    btn.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  });

  // ===== Magnetic Button Effect (subtle, no layout shift) =====
  document.querySelectorAll('.cta-btn').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // ===== Tilt Card Effect (skip quiz card for better input UX) =====
  // Disabled to prevent layout issues with buttons inside cards

  // ===== Floating Particles Background =====
  const particleCanvas = document.createElement('canvas');
  particleCanvas.id = 'particles-canvas';
  document.body.prepend(particleCanvas);

  const pCtx = particleCanvas.getContext('2d');
  let pW, pH;
  const particles = [];
  const PARTICLE_COUNT = 40;

  function resizeParticles() {
    pW = particleCanvas.width = window.innerWidth;
    pH = particleCanvas.height = window.innerHeight;
  }
  resizeParticles();
  window.addEventListener('resize', resizeParticles);

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * pW;
      this.y = Math.random() * pH;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.3 + 0.1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      // Mouse repulsion
      const dx = this.x - mouseX;
      const dy = this.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Guard against dist === 0 (mouse exactly on the particle):
      // dx / dist would be NaN and permanently corrupt the particle.
      if (dist > 0 && dist < 120) {
        const force = (120 - dist) / 120;
        this.x += (dx / dist) * force * 2;
        this.y += (dy / dist) * force * 2;
      }

      if (this.x < 0 || this.x > pW || this.y < 0 || this.y > pH) {
        this.reset();
      }
    }
    draw() {
      pCtx.beginPath();
      pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      pCtx.fillStyle = `rgba(37, 99, 235, ${this.opacity})`;
      pCtx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }

  function drawParticles() {
    pCtx.clearRect(0, 0, pW, pH);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          pCtx.beginPath();
          pCtx.moveTo(particles[i].x, particles[i].y);
          pCtx.lineTo(particles[j].x, particles[j].y);
          pCtx.strokeStyle = `rgba(37, 99, 235, ${0.06 * (1 - dist / 150)})`;
          pCtx.lineWidth = 0.5;
          pCtx.stroke();
        }
      }
    }

    particles.forEach((p) => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(drawParticles);
  }
  drawParticles();

  // ===== Initial Load Animation (no scroll re-trigger) =====
  document.querySelectorAll('.panel').forEach((el, i) => {
    el.classList.add('panel-init');
    el.style.animationDelay = (i * 0.06) + 's';
  });

  // ===== Re-bind after DOM changes =====
  // No MutationObserver needed: the trail-color handlers above use event
  // delegation, so dynamically added a/button nodes are covered without any
  // re-binding. (A naive observer that re-ran a full re-bind caused listener
  // accumulation — and the 30ms comet-dot churn made it avalanche.)

  // ===== Keyboard shortcut: Esc clears the comet trail =====
  // (Original code referenced `dot`/`ring` which do not exist in this scope —
  // `dot` was local to the mousemove callback and `ring` never existed,
  // so pressing Esc threw a ReferenceError. Replaced with a real operation
  // on the actual trail nodes.)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.comet-dot').forEach((dot) => dot.remove());
    }
  });

})();
