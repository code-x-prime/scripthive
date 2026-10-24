// ScriptHive Publication — Main JS
/* 
   BACKEND CONFIGURATION:
   This website now uses a Python/Flask backend for automated emails.
   Ensure the backend server is running (default: http://localhost:5000).
*/
const backendConfig = {
  // Automatically detect if we are running locally or in production
  baseUrl: (() => {
    const host = window.location.hostname;
    const protocol = window.location.protocol;

    // Use current origin for local development with Node.js
    if (host === 'localhost' || host === '127.0.0.1' || protocol === 'file:' || host === '') {
      return ''; // empty string means it will hit the local express server directly (e.g. /contact)
    }
    // Production URL
    return 'https://scripthive.org';
  })(),
  endpoints: {
    paper: '/submit-paper',
    contact: '/contact'
  }
};

document.addEventListener('DOMContentLoaded', function () {

  // (EmailJS Init Removed - Now using Python Backend)

  /* ---- Sticky Header ---- */
  const header = document.getElementById('main-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- Mobile Menu ---- */
  const toggle = document.getElementById('menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      nav.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('open');
        nav.classList.remove('open');
      });
    });
    // Mobile dropdown tap
    nav.querySelectorAll('.nav-dropdown > a').forEach(a => {
      a.addEventListener('click', e => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          a.parentElement.classList.toggle('open');
        }
      });
    });
  }

  /* ---- Active Nav Link ---- */
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const linkFile = href.split('/').pop();
    if (linkFile === currentFile && currentFile !== '') {
      link.classList.add('active');
    }
  });

  /* ---- Journal Tabs ---- */
  const tabs = document.querySelectorAll('.journal-tab');
  const panels = document.querySelectorAll('.journal-section');
  if (tabs.length) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById(target);
        if (panel) {
          panel.classList.add('active');
          // Smooth scroll to tabs bar
          document.querySelector('.journal-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  /* ---- Archive Accordions ---- */
  document.querySelectorAll('.archive-journal-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      hdr.classList.toggle('open');
      const body = hdr.nextElementSibling;
      if (body) body.classList.toggle('open');
    });
  });

  /* ---- Intersection Observer — Fade Up ---- */
  const fadeEls = document.querySelectorAll('.fade-up');
  if ('IntersectionObserver' in window && fadeEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 75);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });
    fadeEls.forEach(el => io.observe(el));
  } else {
    fadeEls.forEach(el => el.classList.add('visible'));
  }

  /* ---- Paper Submission Form ---- */
  const submitForm = document.getElementById('paper-submit-form');
  if (submitForm) {
    submitForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const journal_mapping = {
        "SGJVSR": "ScriptHive Global Journal of Vedic and Sanskrit Research",
        "SGMRJ": "ScriptHive Global Multidisciplinary Research Journal",
        "SGJPLS": "ScriptHive Global Journal of Physical and Life Sciences",
        "SGJETR": "ScriptHive Global Journal of Engineering and Technology Research",
        "SGJSSH": "ScriptHive Global Journal of Social Sciences and Humanities",
        "SGJASH": "ScriptHive Global Journal of Applied Science and Health"
      };

      const btn = this.querySelector('[type="submit"]');
      const container = this.closest('.form-container');
      const decl = document.getElementById('declaration');
      const manuscriptInput = this.querySelector('input[name="manuscript"]');
      const manuscriptFile = manuscriptInput?.files?.[0];
      const paperEndpointUrl = `${backendConfig.baseUrl}${backendConfig.endpoints.paper}`;

      // 1. Validation Check (Since form has 'novalidate')
      if (!this.checkValidity()) {
        this.reportValidity();
        return;
      }

      if (!decl?.checked) {
        alert('Please check the declaration checkbox before submitting.');
        decl?.focus();
        return;
      }

      if (!manuscriptFile) {
        alert('Please choose a manuscript file before submitting.');
        manuscriptInput?.focus();
        return;
      }

      if (manuscriptFile.size > 10 * 1024 * 1024) {
        alert('The selected manuscript is larger than 10 MB. Please upload a smaller PDF, DOC, or DOCX file.');
        manuscriptInput?.focus();
        return;
      }

      const originalText = btn.innerHTML;

      // 2. Loading State
      btn.innerHTML = '<span class="spinner"></span> Processing your submission...';
      btn.classList.add('btn-loading');
      btn.disabled = true;

      // 3. Prepare Form Data
      const formData = new FormData(this);

      // 4. Send to Python Backend
      fetch(paperEndpointUrl, {
        method: 'POST',
        body: formData
      })
        .then(async response => {
          if (!response.ok) {
            let errText = 'Server (HTTP ' + response.status + ') failed to process request';
            try {
              const errData = await response.json();
              if (errData && errData.message) {
                errText = errData.message + (errData.traceback ? '\n\n' + errData.traceback : '');
              }
            } catch (e) { }
            throw new Error(errText);
          }
          return response.json();
        })
        .then((data) => {
          if (data.status === 'success') {
            // Success Flow — Replace form with Success Screen
            if (container) {
              container.innerHTML = `
                <div class="success-screen fade-up" style="padding: 40px 20px; text-align: center;">
                  <div class="success-icon" style="font-size: 4rem; margin-bottom: 20px; animation: scaleIn 0.5s ease;">🎉</div>
                  <h2 class="section-title" style="margin-bottom: 12px; color: var(--primary-dark);">Submission Successful!</h2>
                  <p class="section-subtitle" style="margin-bottom: 32px; color: var(--text-muted);">Thank you, <strong>${formData.get('author_name')}</strong>. Your manuscript "<strong>${formData.get('paper_title')}</strong>" has been received for peer review.</p>
                  
                  <div class="success-details-card" style="background: var(--bg-soft); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 24px; text-align: left; margin: 0 auto 32px; max-width: 600px; box-shadow: var(--shadow-sm);">
                      <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid var(--border-light); padding-bottom: 16px; margin-bottom: 20px;">
                          <div>
                              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Tracking ID</div>
                              <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary); font-family: monospace;">${data.submission_id}</div>
                          </div>
                          <div style="text-align: right;">
                              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Reference Date</div>
                              <div style="font-size: 0.95rem; color: var(--text-main);">${data.timestamp}</div>
                          </div>
                      </div>
                      
                      <h4 style="margin-bottom: 12px; font-size: 1.05rem; color: var(--primary-dark); font-family: var(--font-heading);">What Happens Next?</h4>
                      <ol style="margin-left: 20px; font-size: 0.9rem; color: var(--text-main); margin-bottom: 24px; line-height: 1.6;">
                          <li><strong>Initial Screening (1-2 days):</strong> Verification of formatting, plagiarism check, and journal scope alignment.</li>
                          <li><strong>Peer Review (7-15 days):</strong> Double-blind review process by subject-matter experts.</li>
                          <li><strong>Editorial Decision:</strong> Final notification of acceptance, minor/major revisions, or rejection.</li>
                      </ol>

                      <h4 style="margin-bottom: 12px; font-size: 1.05rem; color: var(--primary-dark); font-family: var(--font-heading);">Criteria for Acceptance</h4>
                      <ul style="margin-left: 20px; font-size: 0.9rem; color: var(--text-main); line-height: 1.6;">
                          <li>Originality, innovation, and significance of the research.</li>
                          <li>Methodological rigor and clarity in presentation.</li>
                          <li>Strict adherence to the ScriptHive ethical guidelines and journal scope.</li>
                      </ul>
                  </div>
                  
                  <p style="margin-bottom: 24px; font-size: 0.9rem; color: var(--text-muted);">
                    A confirmation email has been dispatched to <strong>${formData.get('author_email')}</strong>.
                  </p>
                  
                  <div style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap;">
                    <a href="../index.html" class="btn btn-outline">Return to Home</a>
                    <button id="download-receipt-btn" aria-label="Download submission receipt" class="btn btn-primary" style="display: flex; align-items: center; gap: 8px;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Download Receipt
                    </button>
                  </div>
                </div>
              `;
              container.scrollIntoView({ behavior: 'smooth', block: 'center' });

              // Handle receipt download functionality
              const downloadBtn = container.querySelector('#download-receipt-btn');
              if (downloadBtn) {
                // Load jsPDF library dynamically
                if (!window.jspdf) {
                  const jspdfScript = document.createElement('script');
                  jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                  document.body.appendChild(jspdfScript);
                }

                downloadBtn.addEventListener('click', () => {
                  if (!window.jspdf) {
                    alert('PDF library is loading, please try again in a moment.');
                    return;
                  }

                  const { jsPDF } = window.jspdf;
                  const doc = new jsPDF();
                  const primaryColor = [30, 69, 112]; // #1E4570
                  const accentColor = [201, 162, 39]; // #C9A227

                  // Header Section
                  doc.setFillColor(...primaryColor);
                  doc.rect(0, 0, 210, 40, 'F');

                  doc.setTextColor(255, 255, 255);
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(22);
                  doc.text('ScriptHive Publication', 105, 20, { align: 'center' });

                  doc.setFontSize(12);
                  doc.setFont('helvetica', 'normal');
                  doc.text('Manuscript Submission Receipt', 105, 30, { align: 'center' });

                  // Accent Line
                  doc.setDrawColor(...accentColor);
                  doc.setLineWidth(1.5);
                  doc.line(0, 40, 210, 40);

                  // Body Section
                  doc.setTextColor(60, 60, 60);
                  doc.setFontSize(10);
                  doc.text('Generated on: ' + new Date().toLocaleString(), 190, 50, { align: 'right' });

                  doc.setFontSize(16);
                  doc.setTextColor(...primaryColor);
                  doc.setFont('helvetica', 'bold');
                  doc.text('Submission Details', 20, 65);

                  // Details Box
                  doc.setDrawColor(220, 220, 220);
                  doc.setLineWidth(0.5);
                  doc.rect(20, 70, 170, 80);

                  doc.setFontSize(11);
                  doc.setTextColor(80, 80, 80);
                  const startY = 80;
                  const lineHeight = 12;

                  const details = [
                    ['Tracking ID:', data.submission_id],
                    ['Reference Date:', data.timestamp],
                    ['Author Name:', formData.get('author_name')],
                    ['Author Email:', formData.get('author_email')],
                    ['Journal:', journal_mapping[formData.get('journal')] || formData.get('journal')],
                    ['Paper Title:', formData.get('paper_title')]
                  ];

                  details.forEach((detail, index) => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(detail[0], 30, startY + (index * lineHeight));
                    doc.setFont('helvetica', 'normal');

                    // Handle long titles
                    if (detail[0] === 'Paper Title:') {
                      const splitTitle = doc.splitTextToSize(detail[1], 110);
                      doc.text(splitTitle, 70, startY + (index * lineHeight));
                    } else {
                      doc.text(detail[1], 70, startY + (index * lineHeight));
                    }
                  });

                  // Next Steps Section
                  doc.setFontSize(14);
                  doc.setTextColor(...primaryColor);
                  doc.setFont('helvetica', 'bold');
                  doc.text('What Happens Next?', 20, 165);

                  doc.setFontSize(10);
                  doc.setTextColor(100, 100, 100);
                  doc.setFont('helvetica', 'normal');
                  const steps = [
                    '1. Initial Screening (1-2 days): Plagiarism and scope check.',
                    '2. Peer Review (7-15 days): Double-blind expert evaluation.',
                    '3. Editorial Decision: Final notification of acceptance or revisions.'
                  ];
                  steps.forEach((step, i) => {
                    doc.text(step, 25, 175 + (i * 8));
                  });

                  // Footer Section
                  doc.setDrawColor(240, 240, 240);
                  doc.line(20, 260, 190, 260);
                  doc.setFontSize(9);
                  doc.setTextColor(150, 150, 150);
                  doc.text('This is an automated receipt for your submission to ScriptHive.', 105, 270, { align: 'center' });
                  doc.text('www.scripthive.org | info@scripthive.org', 105, 275, { align: 'center' });

                  doc.save(`receipt-${data.submission_id}.pdf`);
                });
                // Accessibility: Set focus to the download button after the UI renders
                setTimeout(() => downloadBtn.focus(), 100);
              }

              // Trigger Celebration Animation (Confetti)
              const script = document.createElement('script');
              script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
              script.onload = () => {
                var duration = 3 * 1000;
                var end = Date.now() + duration;

                (function frame() {
                  confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#0f172a', '#d4af37', '#ffffff'] // Brand colors
                  });
                  confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#0f172a', '#d4af37', '#ffffff']
                  });

                  if (Date.now() < end) {
                    requestAnimationFrame(frame);
                  }
                }());
              };
              document.body.appendChild(script);
            }
          } else {
            throw new Error(data.message || 'Unknown server error');
          }
        })
        .catch((error) => {
          console.error('Submission Error:', error);
          const isNetworkError = error instanceof TypeError || error.message === 'Failed to fetch';
          const message = isNetworkError
            ? `Could not reach the backend at:\n${paperEndpointUrl}\n\nPlease start the Flask server and make sure local requests are allowed.`
            : error.message;
          alert('Submission Failed\n-------------------\n' + message);
          btn.innerHTML = originalText;
          btn.classList.remove('btn-loading');
          btn.disabled = false;
        });
    });
  }

  /* ---- Contact Form ---- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const btn = this.querySelector('[type="submit"]');
      const originalText = btn.innerHTML;

      btn.innerHTML = '<span class="spinner"></span> Sending...';
      btn.classList.add('btn-loading');
      btn.disabled = true;

      // Prepare Form Data
      const formData = new FormData(this);

      // Send to Python Backend
      fetch(`${backendConfig.baseUrl}${backendConfig.endpoints.contact}`, {
        method: 'POST',
        body: formData
      })
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            const formContainer = contactForm.parentElement;
            formContainer.innerHTML = `
              <div class="success-screen fade-up" style="text-align:center; padding: 40px 20px;">
                <div class="success-icon" style="font-size:4rem; margin-bottom:20px;">✉️</div>
                <h2 style="font-family:var(--font-heading); color:var(--primary-dark); margin-bottom:12px;">Message Sent Successfully!</h2>
                <p style="color:var(--text-muted); margin-bottom:24px;">Thank you, <strong>${formData.get('name')}</strong>. We have received your query and will get back to you shortly.</p>
                
                <div class="success-details" style="background:var(--bg-soft); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:20px; margin-bottom:24px; display:inline-block; text-align:left; min-width:280px;">
                  <div class="success-detail-item" style="margin-bottom:12px;">
                    <span class="label" style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Query Reference:</span>
                    <span class="value highlight" style="font-family:monospace; font-size:1.1rem; color:var(--primary); font-weight:700;">${data.query_id}</span>
                  </div>
                  <div class="success-detail-item">
                    <span class="label" style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Timestamp:</span>
                    <span class="value" style="font-size:0.95rem; color:var(--text-light);">${data.timestamp}</span>
                  </div>
                </div>
                
                <p class="success-note" style="font-size:0.9rem; color:var(--text-muted); max-width:400px; margin:0 auto 30px;">A confirmation has been sent to <strong>${formData.get('email')}</strong>. You can also reach us directly via WhatsApp for urgent queries.</p>
                
                <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                  <a href="../index.html" class="btn btn-outline btn-sm">Return to Home</a>
                  <a href="https://wa.me/919899916683" target="_blank" class="btn btn-primary btn-sm" style="background:#25D366; border-color:#25D366; display:inline-flex; align-items:center; gap:8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
                    WhatsApp Support
                  </a>
                </div>
              </div>
            `;
            formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            alert('Error: ' + data.message);
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
            btn.disabled = false;
          }
        })
        .catch(err => {
          alert('Failed to send message. Please try again or contact us directly via email.');
          console.error(err);
          btn.innerHTML = originalText;
          btn.classList.remove('btn-loading');
          btn.disabled = false;
        });
    });
  }

  /* ---- Sidebar Nav Smooth Scroll ---- */
  document.querySelectorAll('.sidebar-nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  /* ---- File Drop Feedback ---- */
  document.querySelectorAll('.file-drop').forEach(drop => {
    const input = drop.querySelector('input[type="file"]');
    const text = drop.querySelector('.file-name');
    if (input && text) {
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) text.textContent = file.name;
      });
    }
  });

  /* ---- Services Enhanced Slider ---- */
  const servicesSection = document.getElementById('services');
  if (servicesSection) {
    const track = servicesSection.querySelector('.carousel-track');
    const dotsContainer = servicesSection.querySelector('.carousel-dots');
    const prevBtn = servicesSection.querySelector('.carousel-nav.prev');
    const nextBtn = servicesSection.querySelector('.carousel-nav.next');

    let currentIndex = 0;
    let autoplayInterval;
    const AUTOPLAY_DELAY = 2000; // 2 seconds

    function getItemsPerView() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }

    function updateCarousel() {
      const items = track.querySelectorAll('.service-card-new');
      const itemsPerView = getItemsPerView();
      const maxIndex = Math.max(0, items.length - itemsPerView);

      if (currentIndex > maxIndex) currentIndex = 0;
      if (currentIndex < 0) currentIndex = maxIndex;

      const cardWidth = items[0].offsetWidth;
      const gap = 24;
      const offset = currentIndex * (cardWidth + gap);

      track.style.transform = `translateX(-${offset}px)`;
      updateDots(items.length, itemsPerView);
    }

    function updateDots(totalItems, itemsPerView) {
      if (!dotsContainer) return;
      const numDots = Math.max(0, totalItems - itemsPerView + 1);
      dotsContainer.innerHTML = '';

      for (let i = 0; i < numDots; i++) {
        const dot = document.createElement('div');
        dot.className = `dot ${i === currentIndex ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          currentIndex = i;
          updateCarousel();
          resetAutoplay(); // Reset timer but keep playing
        });
        dotsContainer.appendChild(dot);
      }
    }

    function resetAutoplay() {
      clearInterval(autoplayInterval);
      startAutoplay();
    }

    function startAutoplay() {
      autoplayInterval = setInterval(() => {
        const items = track.querySelectorAll('.service-card-new');
        const maxIndex = items.length - getItemsPerView();

        if (currentIndex < maxIndex) {
          currentIndex++;
        } else {
          currentIndex = 0;
        }
        updateCarousel();
      }, AUTOPLAY_DELAY);
    }

    // Nav Click Events
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const items = track.querySelectorAll('.service-card-new');
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : items.length - getItemsPerView();
        updateCarousel();
        resetAutoplay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const items = track.querySelectorAll('.service-card-new');
        const maxIndex = items.length - getItemsPerView();
        currentIndex = (currentIndex < maxIndex) ? currentIndex + 1 : 0;
        updateCarousel();
        resetAutoplay();
      });
    }

    // Initialize
    window.addEventListener('resize', updateCarousel);
    setTimeout(updateCarousel, 300);
    startAutoplay(); // Start immediately
  }

});

