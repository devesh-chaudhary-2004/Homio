/**
 * Homio - Premium Rental Platform
 * Main JavaScript File
 */

(function () {
  'use strict';

  // ============================================
  // Bootstrap Form Validation
  // ============================================
  const forms = document.querySelectorAll('.needs-validation');
  
  Array.prototype.slice.call(forms).forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    }, false);
  });

  // ============================================
  // Confirm Dangerous Actions
  // ============================================
  document.addEventListener('submit', (e) => {
    const form = e.target;
    const msg = form?.getAttribute?.('data-confirm');
    if (!msg) return;
    if (!window.confirm(msg)) {
      e.preventDefault();
    }
  });

  // ============================================
  // Navbar Scroll Effect
  // ============================================
  const navbar = document.querySelector('.app-navbar');
  if (navbar) {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
  }

  // ============================================
  // Image Preview for Listing Forms
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    const imageUrlInput = document.getElementById('imageUrlInput');
    const imageFileInput = document.getElementById('imageFileInput');
    const imagePreview = document.getElementById('imagePreview');
    
    if (!imagePreview) return;

    function updatePreview() {
      const file = imageFileInput?.files?.[0];
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        imagePreview.src = objectUrl;
        imagePreview.style.display = 'block';
        return;
      }

      const url = imageUrlInput?.value?.trim();
      if (url) {
        imagePreview.src = url;
        imagePreview.style.display = 'block';
        return;
      }

      imagePreview.style.display = 'none';
      imagePreview.removeAttribute('src');
    }

    imageUrlInput?.addEventListener('input', updatePreview);
    imageFileInput?.addEventListener('change', updatePreview);
    updatePreview();
  });

  // ============================================
  // Smooth Scroll for Anchor Links
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ============================================
  // Auto-dismiss Alerts
  // ============================================
  const alerts = document.querySelectorAll('.ui-alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      if (bsAlert) {
        alert.classList.add('fade-out');
        setTimeout(() => bsAlert.close(), 300);
      }
    }, 5000);
  });

  // ============================================
  // Date Input Enhancement
  // ============================================
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    // Set min date to today for booking dates
    const today = new Date().toISOString().split('T')[0];
    if (!input.min) {
      input.min = today;
    }
    
    // Enhance start/end date interaction
    if (input.name === 'booking[startDate]') {
      input.addEventListener('change', function() {
        const endInput = document.querySelector('input[name="booking[endDate]"]');
        if (endInput) {
          endInput.min = this.value;
          if (endInput.value && endInput.value < this.value) {
            endInput.value = '';
          }
        }
      });
    }
  });

  // ============================================
  // Loading State for Form Submissions
  // ============================================
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
      const submitBtn = this.querySelector('button[type="submit"], .btn-brand');
      if (submitBtn && !this.classList.contains('was-validated') || this.checkValidity()) {
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Please wait...';
        
        // Re-enable after timeout (fallback)
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }, 10000);
      }
    });
  });

  // ============================================
  // Lazy Loading Images
  // ============================================
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
          }
          observer.unobserve(img);
        }
      });
    });

    document.querySelectorAll('img.lazy').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // ============================================
  // Price Formatting
  // ============================================
  document.querySelectorAll('[data-price]').forEach(el => {
    const price = parseFloat(el.dataset.price);
    if (!isNaN(price)) {
      el.textContent = '₹' + price.toLocaleString('en-IN');
    }
  });

  // ============================================
  // Animation on Scroll
  // ============================================
  if ('IntersectionObserver' in window) {
    const animateOnScroll = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      animateOnScroll.observe(el);
    });
  }

  // ============================================
  // Wishlist Toggle (AJAX)
  // ============================================
  document.addEventListener('click', async (e) => {
    const wishlistBtn = e.target.closest('.wishlist-btn');
    if (!wishlistBtn) return;
    
    e.preventDefault();
    const listingId = wishlistBtn.dataset.listingId;
    const icon = wishlistBtn.querySelector('i');
    
    // Disable button during request
    wishlistBtn.disabled = true;
    
    try {
      const response = await fetch(`/wishlist/${listingId}/toggle`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update button state
        wishlistBtn.dataset.inWishlist = data.inWishlist;
        if (data.inWishlist) {
          icon.classList.remove('fa-regular');
          icon.classList.add('fa-solid');
          wishlistBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Saved';
        } else {
          icon.classList.remove('fa-solid');
          icon.classList.add('fa-regular');
          wishlistBtn.innerHTML = '<i class="fa-regular fa-heart"></i> Save';
        }
      } else if (response.status === 401) {
        // User not logged in, redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Wishlist toggle failed:', error);
    } finally {
      wishlistBtn.disabled = false;
    }
  });

  // ============================================
  // Wishlist Remove (Dashboard AJAX)
  // ============================================
  document.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.wishlist-remove-btn');
    if (!removeBtn) return;
    
    e.preventDefault();
    const listingId = removeBtn.dataset.listingId;
    const wrapper = removeBtn.closest('.mini-card-wrapper');
    
    // Disable button during request
    removeBtn.disabled = true;
    
    try {
      const response = await fetch(`/wishlist/${listingId}/toggle`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Animate and remove the item
        wrapper.style.transition = 'opacity 0.3s, transform 0.3s';
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
          wrapper.remove();
          
          // Update wishlist counts
          const statCount = document.getElementById('wishlist-stat-count');
          const badgeCount = document.getElementById('wishlist-badge-count');
          
          if (statCount) {
            const currentCount = parseInt(statCount.textContent) || 0;
            statCount.textContent = currentCount - 1;
          }
          if (badgeCount) {
            const currentCount = parseInt(badgeCount.textContent) || 0;
            badgeCount.textContent = currentCount - 1;
          }
          
          // Show empty state if no items left
          const container = document.getElementById('wishlist-container');
          if (container && container.children.length === 0) {
            container.outerHTML = `
              <div class="text-center py-3">
                <i class="fa-regular fa-heart fa-2x text-muted mb-2"></i>
                <p class="text-muted small mb-2">No saved listings yet</p>
                <a href="/listings" class="btn btn-outline-brand btn-sm">Browse Listings</a>
              </div>
            `;
          }
        }, 300);
      }
    } catch (error) {
      console.error('Wishlist remove failed:', error);
      removeBtn.disabled = false;
    }
  });

  // ============================================
  // Console Welcome Message
  // ============================================
  console.log(
    '%c🏠 Homio %c Premium Rental Platform',
    'background: linear-gradient(135deg, #ff385c, #ff5a5f); color: white; padding: 8px 12px; border-radius: 4px 0 0 4px; font-weight: bold;',
    'background: #1a1a1a; color: white; padding: 8px 12px; border-radius: 0 4px 4px 0;'
  );

})();