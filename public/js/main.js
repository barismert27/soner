document.addEventListener('DOMContentLoaded', () => {
  // 1. Header Scroll Effect
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 2. Mobile Menu Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close menu when link is clicked
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  // 3. Before/After Image Comparer Slider
  const initBeforeAfterSliders = () => {
    const sliders = document.querySelectorAll('.before-after-container');
    
    sliders.forEach(container => {
      const handle = container.querySelector('.slider-handle');
      const beforeImg = container.querySelector('.image-before');
      let isSliding = false;

      const setSliderPosition = (x) => {
        const rect = container.getBoundingClientRect();
        let position = ((x - rect.left) / rect.width) * 100;
        
        if (position < 0) position = 0;
        if (position > 100) position = 100;
        
        handle.style.left = `${position}%`;
        beforeImg.style.clipPath = `polygon(0 0, ${position}% 0, ${position}% 100%, 0 100%)`;
      };

      const handleMove = (e) => {
        if (!isSliding) return;
        const x = e.clientX || (e.touches && e.touches[0].clientX);
        if (x !== undefined) {
          setSliderPosition(x);
        }
      };

      // Event listeners for dragging
      handle.addEventListener('mousedown', () => isSliding = true);
      handle.addEventListener('touchstart', () => isSliding = true, { passive: true });

      window.addEventListener('mouseup', () => isSliding = false);
      window.addEventListener('touchend', () => isSliding = false);

      container.addEventListener('mousemove', handleMove);
      container.addEventListener('touchmove', handleMove, { passive: true });

      // Click/tap on container moves slider immediately
      container.addEventListener('click', (e) => {
        if (e.target.closest('.slider-handle')) return; // ignore if handle itself is clicked
        setSliderPosition(e.clientX);
      });
    });
  };

  initBeforeAfterSliders();

  // 4. Contact Form Handling with Toast notification
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const message = document.getElementById('message').value;

      if (!name || !email || !message) {
        alert('Lütfen tüm alanları doldurunuz.');
        return;
      }

      // Simulate API call
      const btn = contactForm.querySelector('button');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Gönderiliyor...';
      btn.disabled = true;

      setTimeout(() => {
        showToast('Mesajınız başarıyla iletildi! En kısa sürede dönüş yapılacaktır.');
        contactForm.reset();
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 1200);
    });
  }

  // Toast Notification Helper
  const showToast = (message) => {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `
        <span style="font-size: 20px;">✓</span>
        <span>${message}</span>
      `;
      document.body.appendChild(toast);
    } else {
      toast.querySelector('span:last-child').textContent = message;
    }

    // Force reflow
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  };
});
