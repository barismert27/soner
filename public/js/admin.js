document.addEventListener('DOMContentLoaded', () => {
  // Global Durum Değişkenleri
  const selectedTeeth = new Set();
  let doctorsList = [];
  let expenseCurrentPage = 1;
  const expenseItemsPerPage = 6;

  // DOM Elemanları
  const views = document.querySelectorAll('.view-section');
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const pageTitle = document.getElementById('page-title');

  // --------------------------------------------------
  // NAVİGASYON VE GÖRÜNÜM GEÇİŞLERİ
  // --------------------------------------------------
  const switchView = (viewId) => {
    views.forEach(v => v.classList.remove('active'));
    menuItems.forEach(m => m.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    const matchingMenuItem = document.querySelector(`.sidebar-menu [data-target="${viewId}"]`);
    if (matchingMenuItem) matchingMenuItem.classList.add('active');

    const headerPanel = document.querySelector('.header-panel');
    if (headerPanel) {
        if (viewId === 'view-expenses') {
            headerPanel.style.display = 'none';
        } else {
            headerPanel.style.display = 'flex';
        }
    }
    
    const headerNewJobBtn = document.getElementById('header-new-job-btn');
    if (headerNewJobBtn) {
        const hiddenViews = ['view-payments', 'view-gallery', 'view-doctors', 'view-add-job', 'view-dashboard'];
        if (hiddenViews.includes(viewId)) {
            headerNewJobBtn.style.display = 'none';
        } else {
            headerNewJobBtn.style.display = 'block';
        }
    }

    // Başlık Güncellemesi
    switch (viewId) {
      case 'view-dashboard':
        pageTitle.textContent = 'Laboratuvar Analiz Paneli';
        fetchStats();
        break;
      case 'view-jobs':
        pageTitle.textContent = 'Vaka İş Emri Listesi';
        fetchJobs();
        fetchDoctorsListOnly(); // Filtre listesi için
        break;
      case 'view-add-job':
        pageTitle.textContent = 'Yeni Dijital İş Emri Girişi';
        resetAddJobForm();
        fetchDoctorsListOnly(); // Datalist için
        break;
      case 'view-doctors':
        pageTitle.textContent = 'Cari Borç/Bakiye Hesap Listesi';
        fetchDoctors();
        break;
      case 'view-payments':
        pageTitle.textContent = 'Klinik Ödeme ve Cari Tahsilat Logları';
        fetchPayments();
        break;
      case 'view-gallery':
        pageTitle.textContent = 'Galeri Yönetimi';
        fetchGallery();
        break;
      case 'view-expenses':
        pageTitle.textContent = 'Giderler Yönetimi';
        if (typeof renderExpenseDoctors === 'function') renderExpenseDoctors();
        fetchExpenses();
        break;
    }
  };

  // Sidebar menü tıklama olayları
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target) switchView(target);
    });
  });

  // Global erişim
  window.switchView = switchView;

  // --------------------------------------------------
  // INTERAKTIF DİŞ ŞEMASI MANTIĞI
  // --------------------------------------------------
  const toothItems = document.querySelectorAll('.tooth-item');
  toothItems.forEach(tooth => {
    tooth.addEventListener('click', () => {
      const toothNum = tooth.getAttribute('data-tooth');
      if (selectedTeeth.has(toothNum)) {
        selectedTeeth.delete(toothNum);
        tooth.classList.remove('selected');
      } else {
        selectedTeeth.add(toothNum);
        tooth.classList.add('selected');
      }
    });
  });

  // Treatment checkbox class toggle helper
  document.querySelectorAll('.treatment-checkbox input').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        checkbox.closest('.treatment-checkbox').classList.add('checked');
      } else {
        checkbox.closest('.treatment-checkbox').classList.remove('checked');
      }
    });
  });

  // --------------------------------------------------
  // UTILS / YARDIMCI METOTLAR
  // --------------------------------------------------
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.max(0, val || 0));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('tr-TR');
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '-';
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Yeni': return 'badge-new';
      case 'Metal Prova':
      case '1. Dentin Prova':
      case 'Dişli Mum Prova': return 'badge-trial';
      case 'Bitim': return 'badge-finish';
      case 'Teslim Edildi': return 'badge-delivered';
      default: return 'badge-new';
    }
  };

  // Dynamic CSS keyframes and animations for modern modals & toasts
  if (!document.getElementById('modern-dialogs-css')) {
    const style = document.createElement('style');
    style.id = 'modern-dialogs-css';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // Toast message notify
  const showToast = (msg, type = 'success') => {
    let container = document.getElementById('modern-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modern-toast-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.style.cssText = `
      min-width: 300px;
      max-width: 400px;
      background: rgba(255, 255, 255, 0.98);
      border-left: 5px solid ${type === 'success' ? '#10b981' : '#ef4444'};
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: auto;
      transform: translateX(120%);
      transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      backdrop-filter: blur(10px);
    `;
    const icon = document.createElement('i');
    icon.className = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
    icon.style.cssText = `
      color: ${type === 'success' ? '#10b981' : '#ef4444'};
      font-size: 20px;
    `;
    const text = document.createElement('div');
    text.textContent = msg;
    text.style.cssText = `
      color: #1f2937;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      line-height: 1.4;
    `;
    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);
    
    // Animation in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Animation out and remove
    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          container.removeChild(toast);
        }
      }, 400);
    }, 3500);
  };

  const notifySuccess = (msg) => {
    showToast(msg, 'success');
  };
  const notifyError = (msg) => {
    showToast(msg, 'error');
  };
  window.notifySuccess = notifySuccess;
  window.notifyError = notifyError;

  // Override native alert to use modern showToast
  window.alert = function(msg) {
    if (msg.includes('✓') || msg.toLowerCase().includes('başarılı')) {
      notifySuccess(msg.replace('✓', '').replace('Başarılı:', '').trim());
    } else {
      notifyError(msg.replace('Hata:', '').trim());
    }
  };

  // Modern Confirm Dialog using Promises
  const modernConfirm = (message) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
        animation: fadeIn 0.2s ease-out;
      `;
      
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 100%;
        max-width: 440px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        transform: scale(0.95);
        transition: transform 0.2s ease-out;
        font-family: 'Inter', sans-serif;
        box-sizing: border-box;
      `;
      
      modal.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; min-width: 40px; background: #fee2e2; color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Onay Gerekli</h3>
        </div>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.5; font-weight: 500;">${message}</p>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="m-confirm-cancel" style="border: 1px solid #cbd5e1; background: white; color: #334155; font-weight: 600; font-size: 13px; padding: 9px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s;">Vazgeç</button>
          <button id="m-confirm-ok" style="border: none; background: #6366f1; color: white; font-weight: 600; font-size: 13px; padding: 9px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s;">Onayla</button>
        </div>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      setTimeout(() => {
        modal.style.transform = 'scale(1)';
      }, 10);
      
      const cleanUp = () => {
        modal.style.transform = 'scale(0.95)';
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay.parentNode) {
            document.body.removeChild(overlay);
          }
        }, 200);
      };
      
      overlay.querySelector('#m-confirm-cancel').addEventListener('click', () => {
        cleanUp();
        resolve(false);
      });
      
      overlay.querySelector('#m-confirm-ok').addEventListener('click', () => {
        cleanUp();
        resolve(true);
      });
      
      const escListener = (e) => {
        if (e.key === 'Escape') {
          window.removeEventListener('keydown', escListener);
          cleanUp();
          resolve(false);
        }
      };
      window.addEventListener('keydown', escListener);
    });
  };
  window.modernConfirm = modernConfirm;

  // Modern Prompt Dialog using Promises
  const modernPrompt = (message, defaultValue = '') => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
        animation: fadeIn 0.2s ease-out;
      `;
      
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 100%;
        max-width: 440px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        transform: scale(0.95);
        transition: transform 0.2s ease-out;
        font-family: 'Inter', sans-serif;
        box-sizing: border-box;
      `;
      
      modal.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; min-width: 40px; background: #e0e7ff; color: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            <i class="fa-solid fa-pen-to-square"></i>
          </div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Bilgi Girişi</h3>
        </div>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569; line-height: 1.5; font-weight: 500;">${message}</p>
        <input type="text" id="m-prompt-input" value="${defaultValue}" style="width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; margin-bottom: 20px; outline: none; box-sizing: border-box;" />
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="m-prompt-cancel" style="border: 1px solid #cbd5e1; background: white; color: #334155; font-weight: 600; font-size: 13px; padding: 9px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s;">İptal</button>
          <button id="m-prompt-ok" style="border: none; background: #6366f1; color: white; font-weight: 600; font-size: 13px; padding: 9px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s;">Kaydet</button>
        </div>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      const input = overlay.querySelector('#m-prompt-input');
      
      setTimeout(() => {
        modal.style.transform = 'scale(1)';
        input.focus();
        input.select();
      }, 10);
      
      const cleanUp = () => {
        modal.style.transform = 'scale(0.95)';
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay.parentNode) {
            document.body.removeChild(overlay);
          }
        }, 200);
      };
      
      overlay.querySelector('#m-prompt-cancel').addEventListener('click', () => {
        cleanUp();
        resolve(null);
      });
      
      const submitValue = () => {
        const val = input.value;
        cleanUp();
        resolve(val);
      };
      
      overlay.querySelector('#m-prompt-ok').addEventListener('click', submitValue);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          submitValue();
        }
      });
      
      const escListener = (e) => {
        if (e.key === 'Escape') {
          window.removeEventListener('keydown', escListener);
          cleanUp();
          resolve(null);
        }
      };
      window.addEventListener('keydown', escListener);
    });
  };
  window.modernPrompt = modernPrompt;

  // Modalleri Aç / Kapat
  const openModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
  };
  const closeModal = (modalId) => {
    document.getElementById(modalId).classList.remove('active');
  };
  window.closeModal = closeModal;

  // --------------------------------------------------
  // API FETCH METOTLARI
  // --------------------------------------------------

  // 1. Dashboard Stats & Recent Jobs
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();

      document.getElementById('stats-active-jobs').textContent = data.activeJobsCount;
      document.getElementById('stats-total-debt').textContent = formatCurrency(data.totalDebt);
      document.getElementById('stats-total-paid').textContent = formatCurrency(data.totalPaid);
      document.getElementById('stats-total-balance').textContent = formatCurrency(data.totalBalance);

      const recentBody = document.getElementById('recent-jobs-table-body');
      recentBody.innerHTML = '';
      
      if (data.recentJobs.length === 0) {
        recentBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Henüz eklenmiş iş bulunmamaktadır.</td></tr>';
        return;
      }

      data.recentJobs.forEach(job => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>#${job.id}</strong></td>
          <td>${job.doctor_name}</td>
          <td>${job.patient_name}</td>
          <td>${formatDate(job.entry_date)}</td>
          <td>${formatDate(job.delivery_date)}</td>
          <td><span class="badge ${getStatusBadgeClass(job.status)}">${job.status}</span></td>
          <td><strong>${formatCurrency(job.total_price)}</strong></td>
        `;
        row.style.cursor = 'pointer';
        row.onclick = () => showJobDetail(job.id);
        recentBody.appendChild(row);
      });

    } catch (err) {
      console.error('Stats çekilirken hata oluştu:', err);
    }
  };

  // ── Dropdown aç/kapat yardımcıları (async beklenmez, hemen tanımlanır) ──────
  const openDropdown = () => {
    const menu    = document.getElementById('doctor-dropdown-menu');
    const trigger = document.getElementById('job-doctor-trigger');
    if (!menu || !trigger) return;
    menu.style.display = 'block';
    menu.style.animation = 'dropIn 0.15s ease';
    trigger.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  };

  const closeDropdown = () => {
    const menu    = document.getElementById('doctor-dropdown-menu');
    const trigger = document.getElementById('job-doctor-trigger');
    if (!menu || !trigger) return;
    menu.style.display = 'none';
    trigger.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  // Trigger click — DOMContentLoaded anında bağla, fetch bitmesini bekleme
  const triggerBtn = document.getElementById('job-doctor-trigger');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const menu = document.getElementById('doctor-dropdown-menu');
      if (!menu) return;
      const isOpen = menu.style.display === 'block';
      if (isOpen) { closeDropdown(); } else { openDropdown(); }
    });
  }

  // Dışarı tıklanınca kapat
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('doctor-dropdown-wrapper');
    if (wrapper && !wrapper.contains(e.target)) closeDropdown();
  });

  // ── Doktor Listesi fetch — sadece menü içeriğini doldurur ───────────────────
  const fetchDoctorsListOnly = async () => {
    try {
      const fetchRes = await fetch('/api/doctors');
      const resData  = await fetchRes.json();
      doctorsList = resData.doctors || (Array.isArray(resData) ? resData : []);

      // Dropdown menü içeriğini doldur
      const menu   = document.getElementById('doctor-dropdown-menu');
      const hidden = document.getElementById('job-doctor-input');

      if (menu) {
        if (doctorsList.length === 0) {
          menu.innerHTML = '<div class="doctor-dropdown-empty">Kayıtlı hekim bulunamadı.</div>';
        } else {
          menu.innerHTML = '';
          doctorsList.forEach(doc => {
            const initials = doc.name.split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase();
            const item = document.createElement('div');
            item.className = 'doctor-dropdown-item';
            item.setAttribute('role', 'option');
            item.dataset.id   = doc.id;
            item.dataset.name = doc.name;
            item.innerHTML = `
              <div class="doc-avatar">${initials}</div>
              <span class="doc-name">${doc.name}</span>
              <span class="doc-badge">#${doc.id}</span>
            `;
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              // Seçim yap
              menu.querySelectorAll('.doctor-dropdown-item').forEach(i => i.classList.remove('selected'));
              item.classList.add('selected');
              // Trigger görselini güncelle
              const triggerText = document.getElementById('job-doctor-trigger-text');
              if (triggerText) { triggerText.textContent = doc.name; triggerText.className = 'selected-text'; }
              // Hidden input'a yaz
              if (hidden) { hidden.value = doc.name; hidden.dataset.doctorId = doc.id; }
              closeDropdown();
            });
            menu.appendChild(item);
          });
        }
      }

      // Filtre barındaki <select>'i doldur
      const filterDoc = document.getElementById('filter-doctor');
      if (filterDoc) {
        const currentVal = filterDoc.value;
        filterDoc.innerHTML = '<option value="">Tüm Doktorlar</option>';
        doctorsList.forEach(doc => {
          const opt = document.createElement('option');
          opt.value = doc.id;
          opt.textContent = doc.name;
          filterDoc.appendChild(opt);
        });
        filterDoc.value = currentVal;
      }
    } catch (err) {
      console.error('Doktor listesi çekilemedi:', err);
    }
  };



  // 2. DataGrid İş Listesi
  const fetchJobs = async () => {
    try {
      const search = document.getElementById('filter-search').value;
      const doctorId = document.getElementById('filter-doctor').value;
      const status = document.getElementById('filter-status').value;

      let url = `/api/jobs?search=${encodeURIComponent(search)}&doctor_id=${doctorId}&status=${status}`;

      const res = await fetch(url);
      const jobs = await res.json();
      const body = document.getElementById('jobs-table-body');
      body.innerHTML = '';

      if (jobs.length === 0) {
        body.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Arama kriterlerine uygun vaka bulunamadı.</td></tr>';
        return;
      }

      jobs.forEach(job => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>#${job.id}</strong></td>
          <td>${job.doctor_name}</td>
          <td>${job.patient_name} ${job.sequence_no ? `(${job.sequence_no})` : ''}</td>
          <td>${formatDate(job.entry_date)}</td>
          <td>${formatDate(job.delivery_date)}</td>
          <td><span class="badge ${getStatusBadgeClass(job.status)}">${job.status}</span></td>
          <td><strong>${formatCurrency(job.total_price)}</strong></td>
          <td>${job.pdf_path ? `<a href="${job.pdf_path}" target="_blank" class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;">📄 PDF İncele</a>` : '<span style="color: var(--text-muted); font-size: 12px;">Yok</span>'}</td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="showJobDetail(${job.id})">Detay / Süreç</button>
              <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteJob(${job.id})">Sil</button>
            </div>
          </td>
        `;
        body.appendChild(row);
      });
    } catch (err) {
      console.error('İşler yüklenirken hata:', err);
    }
  };

  // Filtreleri Temizle
  window.clearJobFilters = () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-doctor').value = '';
    document.getElementById('filter-status').value = '';
    fetchJobs();
  };

  // Dinamik arama ve filtre tetikleyicileri
  document.getElementById('filter-search').addEventListener('input', fetchJobs);
  document.getElementById('filter-doctor').addEventListener('change', fetchJobs);
  document.getElementById('filter-status').addEventListener('change', fetchJobs);

  const getTodayLocalDateStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const getYMFromDate = (dateVal, fallbackVal = null) => {
    const checkVal = (val) => {
      if (!val) return '';
      if (typeof val === 'string') {
        const cleanStr = val.trim();
        if (cleanStr.length >= 7) {
          const sep = cleanStr.includes('-') ? '-' : (cleanStr.includes('/') ? '/' : (cleanStr.includes('.') ? '.' : null));
          if (sep) {
            const parts = cleanStr.split(sep);
            if (parts.length >= 2 && parts[0].length === 4) {
              return `${parts[0]}-${parts[1].padStart(2, '0')}`;
            }
            if (parts.length >= 3 && parts[2].substring(0, 4).length === 4 && !isNaN(parts[2].substring(0, 4))) {
              return `${parts[2].substring(0, 4)}-${parts[1].padStart(2, '0')}`;
            }
          }
        }
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      }
      return '';
    };
    const res1 = checkVal(dateVal);
    if (res1) return res1;
    return checkVal(fallbackVal);
  };

  let selectedCariMonth = 'all';

  const formatMonthYearStr = (yearMonthStr) => {
    if (yearMonthStr === 'all') return 'Tüm Zamanlar';
    const [year, month] = yearMonthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
  };

  // 3. Cari Hesaplar (Doktorlar / Klinikler)
  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/doctors');
      const data = await res.json();
      
      const docs = data.doctors || (Array.isArray(data) ? data : []);
      const allJobs = data.jobs || [];
      const allPayments = data.payments || [];
      
      const body = document.getElementById('doctors-table-body');
      const tabsContainer = document.getElementById('cari-month-tabs');
      if (!body) return;

      if (tabsContainer) {
        tabsContainer.innerHTML = '';

        // 1. "Tüm Zamanlar" hızlı butonu
        const btnAll = document.createElement('button');
        btnAll.type = 'button';
        btnAll.className = selectedCariMonth === 'all'
          ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white border-none cursor-pointer shadow-sm transition-all'
          : 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-all';
        btnAll.textContent = 'Tüm Zamanlar';
        btnAll.onclick = () => { selectedCariMonth = 'all'; fetchDoctors(); };
        tabsContainer.appendChild(btnAll);

        // 2. "Bu Ay" (Mevcut Ay) hızlı butonu
        const currentYM = getTodayLocalDateStr().substring(0, 7);
        const btnCurrent = document.createElement('button');
        btnCurrent.type = 'button';
        btnCurrent.className = selectedCariMonth === currentYM
          ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white border-none cursor-pointer shadow-sm transition-all'
          : 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-all';
        btnCurrent.textContent = `Bu Ay (${formatMonthYearStr(currentYM)})`;
        btnCurrent.onclick = () => { selectedCariMonth = currentYM; fetchDoctors(); };
        tabsContainer.appendChild(btnCurrent);

        // 3. Tüm Ayları Barındıran Açılır Liste (Dropdown Select)
        const select = document.createElement('select');
        select.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 cursor-pointer outline-none shadow-sm';
        
        const currentYear = new Date().getFullYear();
        const yearOptions = [currentYear, currentYear - 1, currentYear - 2];
        
        let selectHTML = `<option value="">📅 Tüm 12 Aydan Seçin...</option>`;
        yearOptions.forEach(yr => {
          for (let m = 12; m >= 1; m--) {
            const mStr = m < 10 ? `0${m}` : `${m}`;
            const ymVal = `${yr}-${mStr}`;
            const label = formatMonthYearStr(ymVal);
            selectHTML += `<option value="${ymVal}" ${selectedCariMonth === ymVal ? 'selected' : ''}>${label}</option>`;
          }
        });
        select.innerHTML = selectHTML;
        select.onchange = (e) => {
          if (e.target.value) {
            selectedCariMonth = e.target.value;
            fetchDoctors();
          }
        };
        tabsContainer.appendChild(select);

        // 4. Özel Ay/Yıl Takvim Seçicisi (Month Picker)
        const monthInput = document.createElement('input');
        monthInput.type = 'month';
        monthInput.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 bg-white cursor-pointer shadow-sm';
        monthInput.title = 'Takvimden Özel Ay ve Yıl Seçin';
        if (selectedCariMonth !== 'all') {
          monthInput.value = selectedCariMonth;
        }
        monthInput.onchange = (e) => {
          if (e.target.value) {
            selectedCariMonth = e.target.value;
            fetchDoctors();
          }
        };
        tabsContainer.appendChild(monthInput);
      }

      body.innerHTML = '';

      if (docs.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Kayıtlı doktor/klinik bulunamadı.</td></tr>';
        return;
      }

      docs.forEach(doc => {
        let totalDebt = 0;
        let totalPaid = 0;
        let balance = 0;

        const docJobs = selectedCariMonth === 'all' 
          ? allJobs.filter(j => j.doctor_id == doc.id) 
          : allJobs.filter(j => j.doctor_id == doc.id && getYMFromDate(j.entry_date, j.created_at) === selectedCariMonth);
        const docPayments = selectedCariMonth === 'all' 
          ? allPayments.filter(p => p.doctor_id == doc.id) 
          : allPayments.filter(p => p.doctor_id == doc.id && getYMFromDate(p.payment_date, p.created_at) === selectedCariMonth);
        
        totalDebt = docJobs.reduce((s, j) => s + parseFloat(j.total_price || 0), 0);
        totalPaid = docPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        balance = totalDebt - totalPaid;

        const isMainDoc = doc.name === 'Soner Başyıldız';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>#${doc.id}</strong></td>
          <td><strong>${doc.name}</strong></td>
          <td>${doc.phone || '-'}</td>
          <td>${formatCurrency(totalDebt)}</td>
          <td>${formatCurrency(totalPaid)}</td>
          <td style="color: ${balance > 0 ? 'var(--accent)' : 'var(--success)'}; font-weight: 700;">
            ${formatCurrency(balance)}
          </td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-primary" style="padding: 5px 10px; font-size: 11px;" onclick="showDoctorDetail(${doc.id})">Cari/Ödeme Geçmişi</button>
              <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 11px; background: #6366f1; color: white; border: none; cursor: pointer; border-radius: 6px;" onclick="downloadDetailedCariPDF(${doc.id})">
                <i class="fa-solid fa-file-pdf"></i> Ekstre PDF
              </button>
              ${!isMainDoc ? `
                <button class="btn btn-danger" style="padding: 5px 10px; font-size: 11px; background: #fee2e2; color: #ef4444; border: none; border-radius: 6px; cursor: pointer;" onclick="deleteDoctor(${doc.id}, '${doc.name.replace(/'/g, "\\'")}')" title="Kliniği Sil">
                  <i class="fa-solid fa-trash"></i> Sil
                </button>
              ` : ''}
            </div>
          </td>
        `;
        body.appendChild(row);
      });
    } catch (err) {
      console.error('Doktor carileri çekilirken hata:', err);
    }
  };

  const deleteDoctor = async (docId, docName) => {
    if (docName === 'Soner Başyıldız') {
      notifyError('⚠️ Soner Başyıldız ana hekim (kurucu) olduğu için silinemez!');
      return;
    }
    if (!await modernConfirm(`"${docName}" kliniğini ve bu kliniğe ait tüm geçmiş iş/ödeme kayıtlarını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/doctors/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notifySuccess('Klinik kaydı başarıyla silindi.');
        fetchDoctors();
        fetchDoctorsListOnly();
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('Klinik silme hatası:', err);
    }
  };
  window.deleteDoctor = deleteDoctor;

  // 4. Tüm Ödeme Loglarını Listeleme
  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/payments');
      const payments = await res.json();
      const body = document.getElementById('payments-table-body');
      body.innerHTML = '';

      if (payments.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Tahsilat kaydı bulunmamaktadır.</td></tr>';
        return;
      }

      payments.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>#${p.id}</strong></td>
          <td>${p.doctor_name}</td>
          <td style="color: var(--success); font-weight: 700;">+ ${formatCurrency(p.amount)}</td>
          <td>${formatDate(p.payment_date)}</td>
          <td>${p.notes || '-'}</td>
          <td>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-all" style="background-color: #2563eb; padding: 4px 10px; font-size: 11px; display: flex; align-items: center; gap: 4px; border-radius: 6px;" onclick="generateReceiptPDF(${p.id}, '${(p.doctor_name || '').replace(/'/g, "\\'")}', ${p.amount}, '${p.payment_date}', '${(p.notes || '').replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-file-pdf"></i> Makbuz İndir
              </button>
              <button class="btn btn-danger" style="padding: 4px 10px; font-size: 11px;" onclick="deletePayment(${p.id})">Sil (Geri Al)</button>
            </div>
          </td>
        `;
        body.appendChild(row);
      });
    } catch (err) {
      console.error('Ödemeler yüklenirken hata:', err);
    }
  };

  // --------------------------------------------------
  // FORMLARI SIFIRLAMA
  // --------------------------------------------------
  const resetAddJobForm = () => {
    const form = document.getElementById('add-job-form');
    form.reset();
    selectedTeeth.clear();
    toothItems.forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.treatment-checkbox').forEach(c => c.classList.remove('checked'));
    document.getElementById('job-entry-date').value = getTodayLocalDateStr();
    // Custom dropdown sıfırla
    const triggerText = document.getElementById('job-doctor-trigger-text');
    if (triggerText) { triggerText.textContent = 'Dr. Adı veya Klinik seçin...'; triggerText.className = 'placeholder-text'; }
    const hidden = document.getElementById('job-doctor-input');
    if (hidden) { hidden.value = ''; hidden.dataset.doctorId = ''; }
    document.querySelectorAll('.doctor-dropdown-item').forEach(i => i.classList.remove('selected'));
  };


  // --------------------------------------------------
  // DOKTOR DETAY / FİNANS DÜŞÜMÜ MANTIĞI
  // --------------------------------------------------
  const showDoctorDetail = async (docId) => {
    try {
      const res = await fetch(`/api/doctors/${docId}`);
      const data = await res.json();
      
      const doc = data.doctor;
      const jobsList = data.jobs || [];
      const paymentsList = data.payments || [];
      let calcDebt = jobsList.reduce((s, j) => s + parseFloat(j.total_price || 0), 0);
      let calcPaid = paymentsList.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      if (calcDebt === 0 && parseFloat(doc.total_debt || 0) > 0) calcDebt = parseFloat(doc.total_debt || 0);
      if (calcPaid === 0 && parseFloat(doc.total_paid || 0) > 0) calcPaid = parseFloat(doc.total_paid || 0);
      const calcBalance = calcDebt - calcPaid;

      document.getElementById('doc-modal-title').textContent = `${doc.name} - Cari Hesap Ekstresi`;
      document.getElementById('doc-modal-total-debt').textContent = formatCurrency(calcDebt);
      document.getElementById('doc-modal-total-paid').textContent = formatCurrency(calcPaid);
      
      const balanceEl = document.getElementById('doc-modal-balance');
      balanceEl.textContent = formatCurrency(calcBalance);
      if (calcBalance > 0) {
        balanceEl.style.color = 'var(--accent)';
      } else {
        balanceEl.style.color = 'var(--success)';
      }

      // Ödeme formu gizli alanını ayarla
      const idEl = document.getElementById('payment-doctor-id');
      idEl.value = doc.id;
      idEl.dataset.balance = calcBalance; // Bakiye verisini depoluyoruz

      document.getElementById('payment-amount').value = '';
      document.getElementById('payment-date').value = getTodayLocalDateStr();
      document.getElementById('payment-notes').value = '';

      // Ödeme Geçmişi Listesini Doldur (One-to-Many)
      const listContainer = document.getElementById('doc-payment-history-list');
      listContainer.innerHTML = '';

      if (data.payments.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">Klinikten henüz yapılan bir ödeme tahsilatı yok.</div>';
      } else {
        data.payments.forEach(p => {
          const item = document.createElement('div');
          item.className = 'payment-history-item';
          item.innerHTML = `
            <div>
              <div style="font-weight: 600; font-size: 14px;">${p.notes || 'Cari Ödeme'}</div>
              <div class="date">${formatDate(p.payment_date)}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
              <span class="amount">+ ${formatCurrency(p.amount)}</span>
              <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="deletePayment(${p.id}, ${doc.id})">Sil</button>
            </div>
          `;
          listContainer.appendChild(item);
        });
      }

      // Arşivlenmiş Ekstreler Listesini Doldur
      const statementsContainer = document.getElementById('doc-archived-statements-list');
      if (statementsContainer) {
        statementsContainer.innerHTML = '';
        const archivedStatements = data.statements || [];
        if (archivedStatements.length === 0) {
          statementsContainer.innerHTML = '<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">Arşivlenmiş geçmiş ekstre bulunmuyor.</div>';
        } else {
          archivedStatements.forEach(st => {
            const card = document.createElement('div');
            card.style.cssText = `
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
            `;
            
            const dateStr = new Date(st.created_at).toLocaleString('tr-TR');
            card.innerHTML = `
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 12px; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${st.title}">${st.title}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px;">${dateStr}</div>
              </div>
              <div style="display: flex; gap: 4px; align-items: center;">
                <a href="${st.file_path}" target="_blank" class="btn btn-secondary" style="padding: 5px 8px; font-size: 11px; background: #e0e7ff; color: #4f46e5; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; text-decoration: none;" title="Görüntüle / İndir">
                  <i class="fa-solid fa-download"></i>
                </a>
                <button onclick="deleteArchivedStatement(${st.id}, ${doc.id})" class="btn btn-danger" style="padding: 5px 8px; font-size: 11px; background: #fee2e2; color: #ef4444; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Arşivden Sil">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `;
            statementsContainer.appendChild(card);
          });
        }
      }

      openModal('doctor-detail-modal');

    } catch (err) {
      console.error('Doktor detayı alınamadı:', err);
    }
  };
  window.showDoctorDetail = showDoctorDetail;

  // Ödeme Formu Teslimi (Borçtan Düşme)
  document.getElementById('record-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const docId = document.getElementById('payment-doctor-id').value;
    const balance = parseFloat(document.getElementById('payment-doctor-id').dataset.balance || 0);
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const paymentDate = document.getElementById('payment-date').value;
    const notes = document.getElementById('payment-notes').value;

    if (amount > balance) {
      alert(`Girilen ödeme tutarı kalan borçtan (${formatCurrency(balance)}) fazla olamaz!`);
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: docId, amount, payment_date: paymentDate, notes })
      });
      const data = await res.json();
      if (data.success) {
        notifySuccess('Ödeme cari hesaba kaydedildi ve bakiye güncellendi.');
        showDoctorDetail(docId); // Bilgileri modal içinde anlık yenile
        fetchDoctors(); // Cari listesini arka planda yenile
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('Ödeme kaydedilemedi:', err);
    }
  });

  // Ödeme Kaydı Silme (Borcu Geri Yansıtma)
  const deletePayment = async (paymentId, refreshDocId = null) => {
    if (!await modernConfirm('Bu ödeme tahsilat kaydını silmek istediğinize emin misiniz? Alacak bakiyesi geri yüklenecektir.')) return;
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notifySuccess('Ödeme kaydı silindi, cari bakiye güncellendi.');
        if (refreshDocId) {
          showDoctorDetail(refreshDocId); // Modal içindeyse orayı yenile
          fetchDoctors();
        } else {
          fetchPayments(); // Ödemeler listesindeyse burayı yenile
        }
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('Ödeme silinemedi:', err);
    }
  };
  window.deletePayment = deletePayment;

  // Arşivlenmiş Ekstre Belgesini Sil
  const deleteArchivedStatement = async (statementId, docId) => {
    if (!await modernConfirm('Seçili cari ekstre belgesini arşivden kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/statements/${statementId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notifySuccess('Ekstre arşivden silindi.');
        showDoctorDetail(docId); // Modal içeriğini yenile
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('Ekstre silinemedi:', err);
    }
  };
  window.deleteArchivedStatement = deleteArchivedStatement;

  // --------------------------------------------------
  // İŞ EMİR DETAYI VE DURUM GÜNCELLEME
  // --------------------------------------------------
  const showJobDetail = async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const job = await res.json();

      document.getElementById('job-modal-title').textContent = `#${job.id} Nolu İş Emri Kartı`;
      document.getElementById('job-detail-doctor').textContent = job.doctor_name;
      document.getElementById('job-detail-patient').textContent = job.patient_name;
      document.getElementById('job-detail-seq').textContent = job.sequence_no || '-';
      document.getElementById('job-detail-dates').textContent = `${formatDate(job.entry_date)} / ${formatDate(job.delivery_date)}`;
      document.getElementById('job-detail-demographics').textContent = `${job.patient_age ? `${job.patient_age} Yaş` : 'Yaş Belirtilmedi'}, ${job.patient_gender || 'Cinsiyet Belirtilmedi'}`;
      document.getElementById('job-detail-esthetics').textContent = `Form: ${job.tooth_shape || '-'} | Renk Skalası: ${job.tooth_color || '-'}`;
      document.getElementById('job-detail-teeth').textContent = job.selected_teeth || 'Seçim Yapılmadı';
      document.getElementById('job-detail-treatments').textContent = job.treatment_types || '-';
      document.getElementById('job-detail-notes').textContent = job.notes || 'Özel not eklenmemiş.';

      // PDF iframe
      const pdfContainer = document.getElementById('job-detail-pdf-container');
      if (job.pdf_path) {
        pdfContainer.innerHTML = `<iframe src="${job.pdf_path}" class="pdf-viewer-frame"></iframe>`;
      } else {
        pdfContainer.innerHTML = '<div style="padding: 30px; background: rgba(255,255,255,0.02); text-align: center; border-radius: 8px; color: var(--text-muted); font-size: 13px; border: 1px dashed var(--border-light);">Bu vaka için yüklenmiş hekim reçetesi PDF dosyası bulunmamaktadır.</div>';
      }

      // Güncelleme Form Alanları
      document.getElementById('update-job-id').value = job.id;
      document.getElementById('update-status').value = job.status;
      document.getElementById('update-price').value = job.total_price;
      document.getElementById('update-stage-metal').value = job.metal_trial_date || '';
      document.getElementById('update-stage-dentin').value = job.dentin_trial_date || '';
      document.getElementById('update-stage-wax').value = job.wax_trial_date || '';
      document.getElementById('update-stage-finish').value = job.finish_trial_date || '';

      openModal('job-detail-modal');

    } catch (err) {
      console.error('İş detayı getirilemedi:', err);
    }
  };
  window.showJobDetail = showJobDetail;

  // Detay Modalı Durum ve Fiyat Güncelleme
  document.getElementById('update-job-process-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const jobId = document.getElementById('update-job-id').value;
    const status = document.getElementById('update-status').value;
    const price = document.getElementById('update-price').value;
    const metal = document.getElementById('update-stage-metal').value;
    const dentin = document.getElementById('update-stage-dentin').value;
    const wax = document.getElementById('update-stage-wax').value;
    const finish = document.getElementById('update-stage-finish').value;

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          total_price: price,
          metal_trial_date: metal || null,
          dentin_trial_date: dentin || null,
          wax_trial_date: wax || null,
          finish_trial_date: finish || null
        })
      });
      const data = await res.json();
      if (data.success) {
        notifySuccess('İş detayları, prova aşamaları ve hekim bakiyesi başarıyla güncellendi.');
        closeModal('job-detail-modal');
        fetchJobs(); // Listeyi yenile
        fetchStats(); // Dashboard statlarını güncelle
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('İş güncellenemedi:', err);
    }
  });

  // --------------------------------------------------
  // YENİ İŞ EKLEME FORMU SUBMIT MANTIĞI
  // --------------------------------------------------
  document.getElementById('add-job-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const doctorName = document.getElementById('job-doctor-input').value;
    const patientName = document.getElementById('job-patient-name').value;
    const seqNo = document.getElementById('job-seq-no').value;
    const age = document.getElementById('job-patient-age').value;
    const gender = document.getElementById('job-patient-gender').value;
    const entryDate = document.getElementById('job-entry-date').value;
    const deliveryDate = document.getElementById('job-delivery-date').value;
    const shape = document.getElementById('job-tooth-shape').value;
    const color = document.getElementById('job-tooth-color').value;
    
    // Prova aşamaları
    const metal = document.getElementById('stage-metal').value;
    const dentin = document.getElementById('stage-dentin').value;
    const wax = document.getElementById('stage-wax').value;
    const finish = document.getElementById('stage-finish').value;
    
    const notes = document.getElementById('job-notes').value;
    const totalPrice = document.getElementById('job-total-price').value;

    // Dosya
    const pdfFile = document.getElementById('job-pdf').files[0];

    // Çoklu tedavileri topla
    const treatments = [];
    document.querySelectorAll('#treatment-checkbox-grid input:checked').forEach(cb => {
      treatments.push(cb.value);
    });

    // Seçili dişleri virgülle birleştir
    const teethStr = Array.from(selectedTeeth).join(',');

    // Doktor id'sini bul — custom dropdown'dan hidden input'a yazılır
    let doctorId = '';
    const hiddenDoctorInput = document.getElementById('job-doctor-input');
    if (hiddenDoctorInput && hiddenDoctorInput.dataset.doctorId) {
      doctorId = hiddenDoctorInput.dataset.doctorId;
    } else {
      // Yedek: isme göre eşleş
      const matchedDoc = doctorsList.find(d => d.name.toLowerCase() === doctorName.toLowerCase());
      if (matchedDoc) doctorId = matchedDoc.id;
    }

    // FormData Hazırla (Multer file upload içerdiği için)
    const formData = new FormData();
    formData.append('doctor_name', doctorName);
    formData.append('doctor_id', doctorId);
    formData.append('patient_name', patientName);
    formData.append('sequence_no', seqNo);
    formData.append('patient_age', age);
    formData.append('patient_gender', gender);
    formData.append('entry_date', entryDate);
    if (deliveryDate) formData.append('delivery_date', deliveryDate);
    formData.append('tooth_shape', shape);
    formData.append('tooth_color', color);
    formData.append('selected_teeth', teethStr);
    formData.append('treatment_types', treatments.join(', '));
    if (metal) formData.append('metal_trial_date', metal);
    if (dentin) formData.append('dentin_trial_date', dentin);
    if (wax) formData.append('wax_trial_date', wax);
    if (finish) formData.append('finish_trial_date', finish);
    formData.append('notes', notes);
    formData.append('total_price', totalPrice);
    if (pdfFile) formData.append('pdf', pdfFile);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        body: formData // İçerik tipi FormData olmalı, headers ekleme tarayıcı kendisi boundary ekler
      });
      const data = await res.json();
      if (data.success) {
        notifySuccess('Yeni iş emri kaydı oluşturuldu ve hekim bakiyesi güncellendi.');
        resetAddJobForm();
        switchView('view-dashboard');
      } else {
        alert('İş eklenirken hata oluştu: ' + data.message);
      }
    } catch (err) {
      console.error('İş ekleme hatası:', err);
    }
  });

  // İşi Sil
  const deleteJob = async (jobId) => {
    if (!await modernConfirm('Bu iş emrini silmek istediğinize emin misiniz? İlişkili borç tutarı hekim cari hesabından düşülecektir.')) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notifySuccess('İş emri silindi ve cari hesap düzeltildi.');
        fetchJobs();
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('İş silme hatası:', err);
    }
  };
  window.deleteJob = deleteJob;

  // --------------------------------------------------
  // MANUEL DOKTOR KAYDI
  // --------------------------------------------------
  window.showAddDoctorModal = () => {
    document.getElementById('new-doc-name').value = '';
    document.getElementById('new-doc-phone').value = '';
    document.getElementById('new-doc-email').value = '';
    openModal('add-doctor-modal');
  };

  document.getElementById('add-doctor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-doc-name').value;
    const phone = document.getElementById('new-doc-phone').value;
    const email = document.getElementById('new-doc-email').value;

    try {
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email })
      });
      const data = await res.json();
      if (data.success) {
        notifySuccess('Yeni doktor/klinik hesabı başarıyla açıldı.');
        closeModal('add-doctor-modal');
        fetchDoctors();
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('Doktor ekleme hatası:', err);
    }
  });

  // --------------------------------------------------
  // TEMA GEÇİŞ MANTIĞI (Aydınlık / Karanlık Mod)
  // --------------------------------------------------
  const themeToggle = document.getElementById('theme-toggle');
  
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    themeToggle.textContent = '🌙 Karanlık Mod';
  } else {
    document.body.classList.remove('light-mode');
    themeToggle.textContent = '☀️ Aydınlık Mod';
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    if (document.body.classList.contains('light-mode')) {
      localStorage.setItem('theme', 'light');
      themeToggle.textContent = '🌙 Karanlık Mod';
    } else {
      localStorage.setItem('theme', 'dark');
      themeToggle.textContent = '☀️ Aydınlık Mod';
    }
  });

  // --------------------------------------------------
  // GALERİ VAKA YÖNETİMİ MANTIĞI
  // --------------------------------------------------
  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      const items = await res.json();
      const body = document.getElementById('gallery-table-body');
      body.innerHTML = '';

      if (items.length === 0) {
        body.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">Kayıtlı galeri vakası bulunamadı.</td></tr>';
        return;
      }

      items.forEach(item => {
        let catText = 'Öncesi / Sonrası';
        if (item.category === 'is_yeri') catText = 'İş Yerinden Kareler';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <strong>${item.title}</strong>
            ${item.description ? `<br><small style="color: var(--text-muted);">${item.description}</small>` : ''}
          </td>
          <td><span class="badge badge-trial">${catText}</span></td>
          <td>
            <div style="display: flex; gap: 8px; align-items: center;">
              <img src="${item.before_image}" alt="Görsel" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-light);">
              ${item.after_image ? `<span>➜</span><img src="${item.after_image}" alt="Sonrası" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-light);">` : ''}
            </div>
          </td>
          <td style="text-align: center;">
            <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteGalleryItem(${item.id})">Sil</button>
          </td>
        `;
        body.appendChild(row);
      });
    } catch (err) {
      console.error('Galeri vakaları listelenirken hata:', err);
    }
  };

  const deleteGalleryItem = async (id) => {
    if (!await modernConfirm('Bu galeri vakasını ve görsellerini silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notifySuccess('Galeri vakası başarıyla silindi.');
        fetchGallery();
      } else {
        alert('Hata: ' + data.message);
      }
    } catch (err) {
      console.error('Galeri silme hatası:', err);
    }
  };

  window.deleteGalleryItem = deleteGalleryItem;

  const categorySelect = document.getElementById('gallery-category');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const afterGroup = document.getElementById('gallery-after-group');
      const beforeLabel = document.getElementById('gallery-before-label');
      const afterImg = document.getElementById('gallery-after-img');
      if (val === 'is_yeri') {
        if (afterGroup) afterGroup.style.display = 'none';
        if (beforeLabel) beforeLabel.textContent = 'Fotoğraf *';
        if (afterImg) afterImg.required = false;
      } else {
        if (afterGroup) afterGroup.style.display = 'block';
        if (beforeLabel) beforeLabel.textContent = 'Öncesi Fotoğrafı *';
        if (afterImg) afterImg.required = true;
      }
    });
  }

  const addGalleryForm = document.getElementById('add-gallery-form');
  if (addGalleryForm) {
    addGalleryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('gallery-title').value;
      const category = document.getElementById('gallery-category').value;
      const description = document.getElementById('gallery-description').value;
      const beforeImgFile = document.getElementById('gallery-before-img').files[0];
      const afterImgFile = document.getElementById('gallery-after-img').files[0];

      if (!title || !category || !beforeImgFile) {
        alert('Lütfen zorunlu alanları doldurun ve en az 1 resim yükleyin.');
        return;
      }
      
      if (category === 'oncesi_sonrasi' && !afterImgFile) {
        alert('Öncesi / Sonrası kategorisi için ikinci bir fotoğraf yüklenmelidir.');
        return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('before_image', beforeImgFile);
      if (afterImgFile) formData.append('after_image', afterImgFile);

      const submitBtn = addGalleryForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Yükleniyor...';
      submitBtn.disabled = true;

      try {
        const res = await fetch('/api/gallery', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.success) {
          notifySuccess('Yeni galeri vakası başarıyla eklendi.');
          addGalleryForm.reset();
          fetchGallery();
        } else {
          alert('Hata: ' + data.message);
        }
      } catch (err) {
        console.error('Galeri vaka ekleme hatası:', err);
        alert('Fotoğraf yüklenirken bir ağ hatası oluştu.');
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // --------------------------------------------------
  // GİDERLER (EXPENSES) MANTIĞI (LocalStorage Tabanlı Test)
  // --------------------------------------------------
  const renderExpenseDoctors = () => {
    const select = document.getElementById('expense-funder');
    if (!select) return;
    const currentVal = select.value;

    let docList = JSON.parse(localStorage.getItem('basyildiz_expense_doctors'));
    if (!docList || !Array.isArray(docList) || docList.length === 0) {
      docList = ["Soner Başyıldız", "Rıdvan", "Tamer Başyıldız", "Hakan"];
      localStorage.setItem('basyildiz_expense_doctors', JSON.stringify(docList));
    }

    select.innerHTML = '<option value="" disabled selected>Ödemeyi Yapan Doktoru Seçin</option>';
    docList.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc;
      option.textContent = doc === 'Soner Başyıldız' ? 'Soner Başyıldız (Ana Hekim)' : doc;
      if (doc === currentVal && currentVal !== '') {
        option.selected = true;
      }
      select.appendChild(option);
    });
  };
  window.renderExpenseDoctors = renderExpenseDoctors;
  renderExpenseDoctors();

  window.addExpenseDoctor = async function() {
    const newDoc = await modernPrompt('Giderler listesine eklemek istediğiniz yeni doktor / ortak adını giriniz:');
    if (newDoc && newDoc.trim()) {
      const cleaned = newDoc.trim();
      let docList = JSON.parse(localStorage.getItem('basyildiz_expense_doctors')) || ["Soner Başyıldız", "Rıdvan", "Tamer Başyıldız", "Hakan"];
      if (docList.includes(cleaned)) {
        notifyError('Bu doktor zaten listede mevcut.');
        return;
      }
      docList.push(cleaned);
      localStorage.setItem('basyildiz_expense_doctors', JSON.stringify(docList));
      renderExpenseDoctors();
      if (typeof renderDoctorExpensesSummary === 'function') renderDoctorExpensesSummary();
      const select = document.getElementById('expense-funder');
      if (select) select.value = cleaned;
      notifySuccess(`"${cleaned}" hekim listesine eklendi.`);
    }
  };
 
  window.deleteExpenseDoctor = async function() {
    const select = document.getElementById('expense-funder');
    const selectedValue = select ? select.value : '';
 
    if (!selectedValue) {
      notifyError('Lütfen silmek istediğiniz doktoru üstteki açılır listeden seçin.');
      return;
    }
 
    if (selectedValue === 'Soner Başyıldız') {
      notifyError('⚠️ Soner Başyıldız ana doktor (kurucu/yetkili) olduğu için listeden silinemez!');
      return;
    }
 
    if (await modernConfirm(`"${selectedValue}" isimli hekimi giderler listesinden silmek istediğinize emin misiniz?`)) {
      let docList = JSON.parse(localStorage.getItem('basyildiz_expense_doctors')) || ["Soner Başyıldız", "Rıdvan", "Tamer Başyıldız", "Hakan"];
      docList = docList.filter(doc => doc !== selectedValue);
      localStorage.setItem('basyildiz_expense_doctors', JSON.stringify(docList));
      renderExpenseDoctors();
      if (typeof renderDoctorExpensesSummary === 'function') renderDoctorExpensesSummary();
      notifySuccess(`"${selectedValue}" gider hekim listesinden silindi.`);
    }
  };

  const todayDate = getTodayLocalDateStr();
  const expenseDateInput = document.getElementById('expense-date');
  if (expenseDateInput) expenseDateInput.value = todayDate;

  let localExpenses = JSON.parse(localStorage.getItem('basyildiz_expenses')) || [];
  
  if (localExpenses.length === 0) {
    localExpenses = [
      { id: 1002, funder: "Soner Başyıldız", empName: "Ahmet Yılmaz", desc: "Klinik için zirkonyum blok alımı (5 adet)", amount: 12500, date: todayDate },
      { id: 1001, funder: "Rıdvan", empName: "Ayşe Demir", desc: "Aylık elektrik ve su faturası ödemesi", amount: 3450, date: "2026-07-20" }
    ];
    localStorage.setItem('basyildiz_expenses', JSON.stringify(localExpenses));
  }

  // ORTAK / HEKİM GİDER ÖZET TABLOSU MANTIĞI
  const renderDoctorExpensesSummary = () => {
    const summaryBody = document.getElementById('doctor-expenses-summary-body');
    const summaryTotalCount = document.getElementById('summary-total-count');
    const summaryTotalAmount = document.getElementById('summary-total-amount');
    if (!summaryBody) return;

    summaryBody.innerHTML = '';
    let grandTotal = 0;
    let grandCount = 0;

    let docList = JSON.parse(localStorage.getItem('basyildiz_expense_doctors')) || ["Soner Başyıldız", "Rıdvan", "Tamer Başyıldız", "Hakan"];
    localExpenses.forEach(exp => {
      if (exp.funder && !docList.includes(exp.funder)) {
        docList.push(exp.funder);
      }
    });

    docList.forEach(docName => {
      const docExpenses = localExpenses.filter(e => e.funder === docName);
      const count = docExpenses.length;
      const totalAmount = docExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      grandCount += count;
      grandTotal += totalAmount;

      const formattedTotal = totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
      const isSoner = docName === 'Soner Başyıldız';
      const escapedDocName = docName.replace(/'/g, "\\'");

      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50/50 transition-colors align-middle";
      tr.innerHTML = `
        <td class="py-4 px-4 font-bold text-slate-800 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-full ${isSoner ? 'bg-amber-100 text-amber-600' : 'bg-brand-50 text-brand-600'} flex items-center justify-center font-bold text-sm shrink-0">
              ${isSoner ? '👑' : '👨‍⚕️'}
            </span>
            <div>
              <span class="block text-slate-900 font-bold">${docName}</span>
              <span class="text-[11px] text-slate-400 font-normal">${isSoner ? 'Ana Hekim / Kurucu' : 'Ortak Hekim'}</span>
            </div>
          </div>
        </td>
        <td class="py-4 px-3 text-center font-medium border-b border-slate-100">
          <span class="bg-slate-100 text-slate-700 text-xs font-bold py-1 px-2.5 rounded-full inline-block">${count} Adet</span>
        </td>
        <td class="py-4 px-4 text-right border-b border-slate-100">
          <span class="text-base font-extrabold ${totalAmount > 0 ? 'text-emerald-600' : 'text-slate-400'}">${formattedTotal}</span>
        </td>
        <td class="py-4 px-4 text-center border-b border-slate-100">
          <button type="button" onclick="generateSingleDoctorExpensesPDF('${escapedDocName}')" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white text-xs font-semibold py-1.5 px-3 rounded-lg border-none cursor-pointer transition-all flex items-center justify-center gap-1 mx-auto" style="display: inline-flex; align-items: center;" title="${docName} harcama dökümünü indir">
            <i class="fa-solid fa-file-pdf"></i> PDF Raporu
          </button>
        </td>
      `;
      summaryBody.appendChild(tr);
    });

    if (summaryTotalCount) summaryTotalCount.textContent = grandCount + ' Fiş';
    if (summaryTotalAmount) summaryTotalAmount.textContent = grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };
  window.renderDoctorExpensesSummary = renderDoctorExpensesSummary;

  // BİREYSEL HEKİM HARCAMA PDF RAPORU ÜRETME METODU
  window.generateSingleDoctorExpensesPDF = function(docName) {
    const docExpenses = localExpenses.filter(e => e.funder === docName);
    const count = docExpenses.length;
    const totalAmount = docExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const nowStr = new Date().toLocaleString('tr-TR');
    const dateFileStr = new Date().toISOString().split('T')[0];

    let itemsHTML = '';
    if (count === 0) {
      itemsHTML = `
        <tr>
          <td colspan="5" style="padding: 15px; text-align: center; color: #64748b; font-style: italic; font-size: 12px; border: 1px solid #cbd5e1;">
            Bu hekime ait kayıtlı tediye/harcama bulunmamaktadır.
          </td>
        </tr>
      `;
    } else {
      docExpenses.forEach((exp, idx) => {
        const dateObj = new Date(exp.date);
        const formattedDate = isNaN(dateObj.getTime()) ? exp.date : dateObj.toLocaleDateString('tr-TR');
        const formattedAmt = parseFloat(exp.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
        itemsHTML += `
          <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px; page-break-inside: avoid;">
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${formattedDate}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${exp.desc || 'Gider'}</strong></td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${exp.empName || '-'}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${formattedAmt}</td>
          </tr>
        `;
      });
    }

    const formattedTotal = totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
    const isSoner = docName === 'Soner Başyıldız';

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = `
      <div id="single-doc-pdf-template" style="width: 210mm; background: white; padding: 15mm; font-family: 'Inter', sans-serif; color: #1e293b; box-sizing: border-box;">
        
        <!-- HEADER -->
        <table style="width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">BAŞYILDIZ DİŞ STÜDYOSU</h1>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600;">Hekim Bireysel Gider Harcama Dökümü</p>
            </td>
            <td style="text-align: right; vertical-align: middle; font-size: 11px; color: #475569;">
              <div><strong>Rapor Tarihi:</strong> ${nowStr}</div>
              <div><strong>Evrak No:</strong> #GDR-${docName.charAt(0).toUpperCase()}-${Date.now().toString().slice(-4)}</div>
            </td>
          </tr>
        </table>

        <!-- BİLGİ KARTLARI -->
        <div style="margin-bottom: 20px;">
          <h2 style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a; text-transform: uppercase;">HARCAMA YAPAN ORTAK/HEKİM: ${docName} (${isSoner ? 'Ana Hekim' : 'Ortak Hekim'})</h2>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="width: 100%;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Kayıtlı Toplam Fiş</div>
                <div style="font-size: 18px; font-weight: bold; color: #0f172a;">${count} Adet</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- HARCAMA TABLOSU -->
        <h3 style="font-size: 12px; color: #0f172a; margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Bireysel Harcama Kalemleri</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background-color: #0f172a; color: white; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 8px; border: 1px solid #0f172a; text-align: center; width: 6%;">Sıra</th>
              <th style="padding: 8px; border: 1px solid #0f172a; text-align: center; width: 18%;">Tarih</th>
              <th style="padding: 8px; border: 1px solid #0f172a; width: 38%;">Harcama Kalemi / Açıklama</th>
              <th style="padding: 8px; border: 1px solid #0f172a; width: 22%;">Ödeme Yapılan Kurum/Kişi</th>
              <th style="padding: 8px; border: 1px solid #0f172a; text-align: right; width: 16%;">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <!-- İMZA ALANI -->
        <div style="margin-top: 50px; page-break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 45%; border: 1px solid #cbd5e1; text-align: center; padding: 12px;">
                <div style="font-weight: bold; font-size: 12px; color: #0f172a; margin-bottom: 6px;">HARCAMA YAPAN ORTAK / HEKİM</div>
                <div style="font-size: 11px; color: #1e293b; font-weight: bold; margin-bottom: 35px;">${docName}</div>
                <div style="font-size: 10px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 6px;">İmza / Tarih</div>
              </td>
              <td style="width: 10%;"></td>
              <td style="width: 45%; border: 1px solid #cbd5e1; text-align: center; padding: 12px;">
                <div style="font-weight: bold; font-size: 12px; color: #0f172a; margin-bottom: 6px;">BAŞYILDIZ DİŞ STÜDYOSU</div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 35px;">Muhasebe / Laboratuvar Onayı</div>
                <div style="font-size: 10px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 6px;">Kaşe & İmza</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Başyıldız Diş Stüdyosu Laboratuvar ve Hekim Takip Sistemleri • Elektronik Tediye Dökümü
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const element = container.querySelector('#single-doc-pdf-template');
    const opt = {
      margin:       5,
      filename:     `Basyildiz_Harcama_Dokumu_${docName.replace(/\s+/g, '_')}_${dateFileStr}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, scrollX: 0, scrollY: 0, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      document.body.removeChild(container);
      notifySuccess(`"${docName}" harcama dökümü PDF olarak indirildi.`);
    }).catch(err => {
      console.error('PDF oluşturma hatası:', err);
      document.body.removeChild(container);
    });
  };

  // ORTAK GİDER GENEL ÖZET TABLOSUNU PDF OLARAK İNDİRME METODU (TABLO GÖRÜNÜMLÜ TEMİZ RAPOR)
  window.generateDoctorExpensesSummaryPDF = function() {
    let docList = JSON.parse(localStorage.getItem('basyildiz_expense_doctors')) || ["Soner Başyıldız", "Rıdvan", "Tamer Başyıldız", "Hakan"];
    localExpenses.forEach(exp => {
      if (exp.funder && !docList.includes(exp.funder)) {
        docList.push(exp.funder);
      }
    });

    let grandTotal = 0;
    let grandCount = 0;
    const nowStr = new Date().toLocaleString('tr-TR');
    const dateFileStr = new Date().toISOString().split('T')[0];

    let tableRowsHTML = '';
    docList.forEach(docName => {
      const docExpenses = localExpenses.filter(e => e.funder === docName);
      const count = docExpenses.length;
      const totalAmount = docExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      grandCount += count;
      grandTotal += totalAmount;

      const formattedTotal = totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
      const isSoner = docName === 'Soner Başyıldız';

      tableRowsHTML += `
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px; page-break-inside: avoid;">
          <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a;">
            ${isSoner ? '👑 ' : '👨‍⚕️ '}${docName}
          </td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; color: #475569;">
            ${isSoner ? 'Ana Hekim / Kurucu' : 'Ortak Hekim'}
          </td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">
            ${count} Adet
          </td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: ${totalAmount > 0 ? '#059669' : '#64748b'};">
            ${formattedTotal}
          </td>
        </tr>
      `;
    });

    const formattedGrandTotal = grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

    let signaturesHTML = '';
    const signDocs = docList.slice(0, 4);
    signDocs.forEach(d => {
      signaturesHTML += `
        <td style="width: ${100 / signDocs.length}%; text-align: center; padding: 10px;">
          <div style="border-top: 1px solid #000; padding-top: 6px; font-weight: bold; font-size: 11px; color: #0f172a;">
            ${d}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Kaşe & İmza</div>
        </td>
      `;
    });

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = `
      <div id="doctor-summary-pdf-template" style="width: 210mm; background: white; padding: 15mm; font-family: 'Inter', sans-serif; color: #1e293b; box-sizing: border-box;">
        
        <!-- HEADER -->
        <table style="width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">BAŞYILDIZ DİŞ STÜDYOSU</h1>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600;">Ortaklar & Hekimler Genel Gider Harcama Raporu</p>
            </td>
            <td style="text-align: right; vertical-align: middle; font-size: 11px; color: #475569;">
              <div><strong>Rapor Tarihi:</strong> ${nowStr}</div>
              <div><strong>Rapor No:</strong> #GR-${Date.now().toString().slice(-4)}</div>
            </td>
          </tr>
        </table>

        <!-- BİLGİ ÖZETİ -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; display: flex; justify-content: space-between;">
          <span>Stüdyo ortaklarının ve hekimlerinin toplam gider tediye fiş adetleri ve harcama döküm mutabakat tutarları.</span>
          <strong>Toplam Fiş: ${grandCount} Adet</strong>
        </div>

        <!-- ANA TABLO -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background-color: #0f172a; color: white; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 10px; border: 1px solid #0f172a; width: 35%;">Ortak / Hekim</th>
              <th style="padding: 10px; border: 1px solid #0f172a; width: 25%;">Unvan</th>
              <th style="padding: 10px; border: 1px solid #0f172a; width: 20%; text-align: center;">Toplam Fiş</th>
              <th style="padding: 10px; border: 1px solid #0f172a; width: 20%; text-align: right;">Toplam Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
          <tfoot>
            <tr style="background-color: #1e293b; color: white; font-weight: bold; font-size: 13px;">
              <td colspan="2" style="padding: 12px; text-align: right; border: 1px solid #1e293b;">GENEL TOPLAM GİDER:</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #1e293b; color: #fcd34d;">${grandCount} Adet</td>
              <td style="padding: 12px; text-align: right; border: 1px solid #1e293b; color: #34d399; font-size: 14px;">${formattedGrandTotal}</td>
            </tr>
          </tfoot>
        </table>

        <!-- İMZA ALANI -->
        <div style="margin-top: 50px; page-break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              ${signaturesHTML}
            </tr>
          </table>
        </div>

        <div style="text-align: center; font-size: 10px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Başyıldız Diş Stüdyosu Laboratuvar ve Hekim Takip Sistemleri • Elektronik Rapor
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const element = container.querySelector('#doctor-summary-pdf-template');
    const opt = {
      margin:       5,
      filename:     `Basyildiz_Genel_Gider_Ozet_Raporu_${dateFileStr}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, scrollX: 0, scrollY: 0, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      document.body.removeChild(container);
      notifySuccess('Genel ortak gider özet raporu PDF olarak başarıyla indirildi.');
    }).catch(err => {
      console.error('PDF oluşturma hatası:', err);
      document.body.removeChild(container);
    });
  };

  const fetchExpenses = () => {
    if (typeof renderDoctorExpensesSummary === 'function') renderDoctorExpensesSummary();

    const tableBody = document.getElementById('expense-table-body');
    const emptyState = document.getElementById('expense-empty-state');
    const totalDisplay = document.getElementById('total-expenses');
    
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Toplam tutarı her halükarda tüm kayıtlar üzerinden hesaplıyoruz
    let total = localExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

    if (localExpenses.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
      
      const pagContainer = document.getElementById('expense-pagination-container');
      if (pagContainer) pagContainer.style.display = 'none';
    } else {
      emptyState.classList.add('hidden');
      emptyState.classList.remove('flex');
      
      const pagContainer = document.getElementById('expense-pagination-container');
      if (pagContainer) pagContainer.style.display = 'flex';

      // Sayfalama Hesaplamaları
      const totalItems = localExpenses.length;
      const totalPages = Math.ceil(totalItems / expenseItemsPerPage) || 1;
      
      if (expenseCurrentPage > totalPages) expenseCurrentPage = totalPages;
      if (expenseCurrentPage < 1) expenseCurrentPage = 1;

      const startIndex = (expenseCurrentPage - 1) * expenseItemsPerPage;
      const endIndex = startIndex + expenseItemsPerPage;
      const paginatedExpenses = localExpenses.slice(startIndex, endIndex);

      // Sadece bu sayfanın verilerini ekrana çiz
      paginatedExpenses.forEach(exp => {
        const dateObj = new Date(exp.date);
        const formattedDate = isNaN(dateObj.getTime()) ? exp.date : dateObj.toLocaleDateString('tr-TR');
        const formattedAmount = parseFloat(exp.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors group";
        tr.innerHTML = `
          <td class="py-4 px-6 font-medium text-slate-900 border-b border-slate-100">#${exp.id}</td>
          <td class="py-4 px-6 text-slate-500 border-b border-slate-100">${formattedDate}</td>
          <td class="py-4 px-6 font-medium text-brand-600 border-b border-slate-100">${exp.funder || '-'}</td>
          <td class="py-4 px-6 border-b border-slate-100">
              <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                      ${exp.empName.charAt(0).toUpperCase()}
                  </div>
                  <span class="font-medium text-slate-700">${exp.empName}</span>
              </div>
          </td>
          <td class="py-4 px-6 text-slate-600 truncate max-w-[200px] border-b border-slate-100" title="${exp.desc}">${exp.desc}</td>
          <td class="py-4 px-6 text-right font-semibold text-slate-900 border-b border-slate-100">${formattedAmount} ₺</td>
          <td class="py-4 px-6 text-center border-b border-slate-100">
              <div class="flex justify-center gap-2">
                  <button type="button" onclick="generatePDF(${exp.id})" title="PDF İndir" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm border-none cursor-pointer">
                      <i class="fa-solid fa-file-pdf"></i>
                  </button>
                  <button type="button" onclick="deleteExpense(${exp.id})" title="Sil" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm border-none cursor-pointer">
                      <i class="fa-regular fa-trash-can"></i>
                  </button>
              </div>
          </td>
        `;
        tableBody.appendChild(tr);
      });

      // Sayfalama Kontrolleri Arayüzünü Güncelle
      const paginationInfo = document.getElementById('expense-pagination-info');
      const pageNumberEl = document.getElementById('expense-page-number');
      const btnPrev = document.getElementById('btn-expense-prev');
      const btnNext = document.getElementById('btn-expense-next');

      if (paginationInfo) {
        paginationInfo.textContent = `Toplam ${totalItems} Gider, Sayfa ${expenseCurrentPage}/${totalPages}`;
      }
      if (pageNumberEl) {
        pageNumberEl.textContent = expenseCurrentPage;
      }
      if (btnPrev) {
        btnPrev.disabled = expenseCurrentPage === 1;
      }
      if (btnNext) {
        btnNext.disabled = expenseCurrentPage === totalPages;
      }
    }
    
    if (totalDisplay) {
      totalDisplay.innerText = total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
    }
  };
  window.fetchExpenses = fetchExpenses;

  // Sayfalama Butonlarına Olay Dinleyicileri (Bir kez eklenir)
  const btnExpensePrev = document.getElementById('btn-expense-prev');
  const btnExpenseNext = document.getElementById('btn-expense-next');
  if (btnExpensePrev) {
    btnExpensePrev.addEventListener('click', () => {
      if (expenseCurrentPage > 1) {
        expenseCurrentPage--;
        fetchExpenses();
      }
    });
  }
  if (btnExpenseNext) {
    btnExpenseNext.addEventListener('click', () => {
      const totalPages = Math.ceil(localExpenses.length / expenseItemsPerPage) || 1;
      if (expenseCurrentPage < totalPages) {
        expenseCurrentPage++;
        fetchExpenses();
      }
    });
  }

  const expenseForm = document.getElementById('expense-form');
  if (expenseForm) {
    expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const funder = document.getElementById('expense-funder').value;
      const empName = document.getElementById('expense-empName').value.trim();
      const desc = document.getElementById('expense-desc').value.trim();
      const amount = parseFloat(document.getElementById('expense-amount').value);
      const date = document.getElementById('expense-date').value;

      const newId = localExpenses.length > 0 ? Math.max(...localExpenses.map(e => e.id)) + 1 : 1000;
      
      localExpenses.unshift({ id: newId, funder, empName, desc, amount, date });
      localStorage.setItem('basyildiz_expenses', JSON.stringify(localExpenses));
      expenseCurrentPage = 1;
      fetchExpenses();
      
      expenseForm.reset();
      document.getElementById('expense-date').value = todayDate;
      notifySuccess('Yeni gider başarıyla kaydedildi.');
    });
  }

  window.deleteExpense = async function(id) {
    if (await modernConfirm('Bu gider kaydını silmek istediğinize emin misiniz?')) {
      localExpenses = localExpenses.filter(exp => exp.id !== id);
      localStorage.setItem('basyildiz_expenses', JSON.stringify(localExpenses));
      fetchExpenses();
      notifySuccess('Gider başarıyla silindi.');
    }
  };

  function numberToTurkishWords(num) {
    if (num === 0) return "Sıfır";
    const ones = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
    const tens = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
    const scales = ["", "Bin", "Milyon", "Milyar"];
    
    let str = "";
    let intPart = Math.floor(num);
    let scaleIdx = 0;
    
    while (intPart > 0) {
        let chunk = intPart % 1000;
        if (chunk > 0) {
            let chunkStr = "";
            let h = Math.floor(chunk / 100);
            let t = Math.floor((chunk % 100) / 10);
            let o = chunk % 10;
            
            if (h > 1) chunkStr += ones[h] + "Yüz";
            else if (h === 1) chunkStr += "Yüz";
            
            chunkStr += tens[t];
            chunkStr += ones[o];
            
            // "BirBin" durumunu düzeltme
            if (scaleIdx === 1 && chunkStr === "Bir") {
                str = "Bin" + str;
            } else {
                str = chunkStr + scales[scaleIdx] + str;
            }
        }
        intPart = Math.floor(intPart / 1000);
        scaleIdx++;
    }
    
    const cents = Math.round((num % 1) * 100);
    if (cents > 0) {
        let t = Math.floor(cents / 10);
        let o = cents % 10;
        str += " Virgül " + tens[t] + ones[o];
    }
    
    return str || "Sıfır";
  }

  window.generatePDF = function(id) {
    const exp = localExpenses.find(e => e.id === id);
    if (!exp) return;

    const formattedDate = new Date(exp.date).toLocaleDateString('tr-TR');
    const formattedAmount = parseFloat(exp.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';

    document.getElementById('pdf-id').innerText = '#' + exp.id;
    document.getElementById('pdf-date').innerText = formattedDate;
    document.getElementById('pdf-funder').innerText = exp.funder || '-';
    document.getElementById('pdf-emp').innerText = exp.empName;
    document.getElementById('pdf-desc').innerText = exp.desc;
    document.getElementById('pdf-amount').innerText = formattedAmount;
    document.getElementById('pdf-total').innerText = formattedAmount;
    
    document.getElementById('pdf-emp-sign').innerText = exp.empName;
    document.getElementById('pdf-funder-sign').innerText = exp.funder || 'KURUM YETKİLİSİ';
    
    document.getElementById('pdf-words').innerText = '#' + numberToTurkishWords(parseFloat(exp.amount)) + '#';

    const element = document.getElementById('pdf-content');
    const opt = {
        margin:       0,
        filename:     `Gider_Pusulasi_${exp.id}_${exp.empName.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  // --------------------------------------------------
  // DETAYLI HEKİM CARİ EKSTRE PDF İNDİRME FONKSİYONLARI
  // --------------------------------------------------
  window.downloadDetailedCariPDFFromModal = function() {
    const docId = document.getElementById('payment-doctor-id').value;
    if (docId) {
      downloadDetailedCariPDF(docId);
    } else {
      alert('Doktor bilgisi bulunamadı.');
    }
  };

  window.downloadDetailedCariPDF = async function(docId) {
    try {
      const res = await fetch(`/api/doctors/${docId}`);
      if (!res.ok) throw new Error('Doktor bilgileri sunucudan alınamadı.');
      const data = await res.json();
      
      const doc = data.doctor;
      let jobs = data.jobs || [];
      let payments = data.payments || [];
      
      let docTotalDebt = parseFloat(doc.total_debt || 0);
      let docTotalPaid = parseFloat(doc.total_paid || 0);
      let docBalance = parseFloat(doc.balance || 0);
      let periodTitle = 'Tüm Zamanlar';

      if (typeof selectedCariMonth !== 'undefined' && selectedCariMonth !== 'all') {
        jobs = jobs.filter(j => getYMFromDate(j.entry_date, j.created_at) === selectedCariMonth);
        payments = payments.filter(p => getYMFromDate(p.payment_date, p.created_at) === selectedCariMonth);
        
        docTotalDebt = jobs.reduce((sum, j) => sum + parseFloat(j.total_price || 0), 0);
        docTotalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        docBalance = docTotalDebt - docTotalPaid;
        periodTitle = formatMonthYearStr(selectedCariMonth);
      }
      
      const nowStr = new Date().toLocaleString('tr-TR');
      const dateFileStr = new Date().toISOString().split('T')[0];
      
      let jobsRowsHTML = '';
      if (jobs.length === 0) {
        jobsRowsHTML = `
          <tr>
            <td colspan="6" style="padding: 15px; text-align: center; color: #64748b; font-style: italic; font-size: 12px; border: 1px solid #cbd5e1;">
              Kayıtlı herhangi bir hasta/vaka iş emri bulunmamaktadır.
            </td>
          </tr>
        `;
      } else {
        jobs.forEach((j, index) => {
          const dateObj = new Date(j.entry_date || j.created_at);
          const formattedDate = isNaN(dateObj.getTime()) ? (j.entry_date || j.created_at) : dateObj.toLocaleDateString('tr-TR');
          
          let unitCount = 0;
          if (j.selected_teeth && j.selected_teeth.trim()) {
            unitCount = j.selected_teeth.split(',').map(t => t.trim()).filter(Boolean).length;
          }
          const unitStr = unitCount > 0 ? `${unitCount} Üye` : '1 Üye';
          
          const formattedPrice = parseFloat(j.total_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
          const treatment = j.treatment_types || '-';
          
          jobsRowsHTML += `
            <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px; page-break-inside: avoid;">
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${index + 1}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${formattedDate}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${j.patient_name}</strong></td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${treatment}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">
                <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">
                  ${j.selected_teeth ? j.selected_teeth : ''} (${unitStr})
                </span>
              </td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${formattedPrice}</td>
            </tr>
          `;
        });
      }
      
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.innerHTML = `
        <div id="cari-ekstre-pdf-template" style="width: 210mm; background: white; padding: 15mm; font-family: 'Inter', sans-serif; color: #1e293b; box-sizing: border-box;">
          
          <!-- HEADER -->
          <table style="width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">BAŞYILDIZ DİŞ STÜDYOSU</h1>
                <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600;">Klinik Ayrıntılı Cari Hesap Mutabakat Ekstresi (${periodTitle})</p>
              </td>
              <td style="text-align: right; vertical-align: middle; font-size: 11px; color: #475569;">
                <div><strong>Rapor Tarihi:</strong> ${nowStr}</div>
                <div style="margin-top: 2px;"><strong>Cari Hesap No:</strong> #CAR-${docId}-${Date.now().toString().slice(-4)}</div>
              </td>
            </tr>
          </table>

          <!-- KLİNİK BİLGİSİ -->
          <div style="margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #0f172a; text-transform: uppercase;">MÜŞTERİ / KLİNİK: ${doc.name}</h2>
            ${doc.phone ? `<div style="font-size: 12px; color: #475569;"><strong>Telefon:</strong> ${doc.phone}</div>` : ''}
            ${doc.email ? `<div style="font-size: 12px; color: #475569;"><strong>E-Posta:</strong> ${doc.email}</div>` : ''}
          </div>

          <!-- BİLGİ ÖZET KUTULARI -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="width: 33%; padding-right: 10px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                  <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Toplam İş Borcu (${periodTitle})</div>
                  <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${docTotalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                </div>
              </td>
              <td style="width: 33%; padding: 0 5px;">
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
                  <div style="font-size: 10px; text-transform: uppercase; color: #166534; font-weight: bold; margin-bottom: 4px;">Tahsil Edilen Toplam (${periodTitle})</div>
                  <div style="font-size: 16px; font-weight: bold; color: #15803d;">${docTotalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                </div>
              </td>
              <td style="width: 33%; padding-left: 10px;">
                <div style="background: ${docBalance > 0 ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${docBalance > 0 ? '#fecaca' : '#bbf7d0'}; border-radius: 8px; padding: 12px; text-align: center;">
                  <div style="font-size: 10px; text-transform: uppercase; color: ${docBalance > 0 ? '#991b1b' : '#166534'}; font-weight: bold; margin-bottom: 4px;">Kalan Mutabakat Bakiyesi</div>
                  <div style="font-size: 16px; font-weight: bold; color: ${docBalance > 0 ? '#b91c1c' : '#15803d'};">${docBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                </div>
              </td>
            </tr>
          </table>

          <!-- YAPILAN İŞLER DETAY TABLOSU -->
          <h3 style="font-size: 13px; color: #0f172a; margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Yapılan Protez / Tedavi İş Emirleri</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #0f172a; color: white; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 8px; border: 1px solid #0f172a; text-align: center; width: 5%;">Sıra</th>
                <th style="padding: 8px; border: 1px solid #0f172a; width: 15%;">Tarih</th>
                <th style="padding: 8px; border: 1px solid #0f172a; width: 25%;">Hasta Adı & Soyadı</th>
                <th style="padding: 8px; border: 1px solid #0f172a; width: 25%;">Materyal / İşlem</th>
                <th style="padding: 8px; border: 1px solid #0f172a; text-align: center; width: 18%;">Diş & Üye Adedi</th>
                <th style="padding: 8px; border: 1px solid #0f172a; text-align: right; width: 12%;">Tutar</th>
              </tr>
            </thead>
            <tbody>
              ${jobsRowsHTML}
            </tbody>
          </table>

          <!-- MUTABAKAT ONAYI / İMZA -->
          <div style="margin-top: 50px; page-break-inside: avoid;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 45%; border: 1px solid #cbd5e1; text-align: center; vertical-align: top; padding: 12px;">
                  <div style="font-weight: bold; font-size: 12px; color: #0f172a; margin-bottom: 6px;">KLİNİK / HEKİM ONAYI</div>
                  <div style="font-size: 11px; color: #1e293b; font-weight: bold; margin-bottom: 35px;">${doc.name}</div>
                  <div style="font-size: 10px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 6px;">İmza / Tarih</div>
                </td>
                <td style="width: 10%;"></td>
                <td style="width: 45%; border: 1px solid #cbd5e1; text-align: center; vertical-align: top; padding: 12px;">
                  <div style="font-weight: bold; font-size: 12px; color: #0f172a; margin-bottom: 6px;">BAŞYILDIZ DİŞ STÜDYOSU</div>
                  <div style="font-size: 11px; color: #64748b; margin-bottom: 35px;">Laboratuvar Sorumlusu</div>
                  <div style="font-size: 10px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 6px;">Kaşe & İmza</div>
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Bu ekstre Başyıldız Diş Stüdyosu Laboratuvar Takip Sistemi tarafından otomatik üretilmiştir. Cari borç mutabakatı için resmi evrak niteliğindedir.
          </div>
        </div>
      `;
      document.body.appendChild(container);
      
      const element = container.querySelector('#cari-ekstre-pdf-template');
      const opt = {
        margin:       5,
        filename:     `Basyildiz_Cari_Ekstre_${doc.name.replace(/\s+/g, '_')}_${dateFileStr}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, scrollX: 0, scrollY: 0, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      html2pdf().set(opt).from(element).save().then(async () => {
        // İndirme başarılı olduktan sonra PDF blob'unu oluşturup sunucu arşivine yüklüyoruz
        const pdfWorker = html2pdf().set(opt).from(element);
        pdfWorker.output('blob').then(async (blob) => {
          const formData = new FormData();
          formData.append('pdf', blob, `Basyildiz_Cari_Ekstre_${doc.name.replace(/\s+/g, '_')}_${dateFileStr}.pdf`);
          formData.append('title', `Cari Ekstre (${typeof periodTitle !== 'undefined' ? periodTitle : 'Genel'} - ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`);

          try {
            const uploadRes = await fetch(`/api/doctors/${docId}/statements`, {
              method: 'POST',
              body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
              notifySuccess('Cari ekstre indirildi ve geçmiş arşivine eklendi.');
              // Eğer hekim modalı aktifse arşiv listesini anlık yenileyelim
              const modal = document.getElementById('doctor-detail-modal');
              if (modal && modal.classList.contains('active')) {
                showDoctorDetail(docId);
              }
            }
          } catch (uploadErr) {
            console.error('Ekstre arşivlenirken hata:', uploadErr);
          }
        });
        document.body.removeChild(container);
      }).catch(err => {
        console.error('Cari PDF oluşturma hatası:', err);
        document.body.removeChild(container);
      });
      
    } catch (err) {
      alert('Cari döküm alınırken bir hata oluştu: ' + err.message);
    }
  };

  // --------------------------------------------------
  window.generateReceiptPDF = function(id, doctorName, amount, dateStr, notes) {
    const formattedDate = new Date(dateStr).toLocaleDateString('tr-TR');
    const formattedAmount = parseFloat(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const amountInWords = "Yalnız: #" + numberToTurkishWords(parseFloat(amount)) + "# TL'dir.";

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.background = 'white';
    
    container.innerHTML = `
      <div id="receipt-pdf-template" style="font-family: 'Arial', sans-serif; padding: 20px; color: #0f172a; width: 100%; max-width: 750px; margin: 0 auto; box-sizing: border-box; display: block;">
         
         <!-- Header Table -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
           <tr>
             <td style="vertical-align: top; width: 60%;">
               <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #0f172a;">BAŞYILDIZ DİŞ STÜDYOSU</h1>
               <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 5px;">Ağız ve Diş Sağlığı Protez Laboratuvarı & Klinik Çözümleri</div>
             </td>
             <td style="vertical-align: top; text-align: right; width: 40%;">
               <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 10px 0; color: #0f172a;">RESMİ TAHSİLAT MAKBUZU</h2>
               <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a; border-radius: 6px; background: #f8fafc;">
                 <tr><td style="padding: 4px 10px; font-size: 13px; text-align: left;"><strong>Makbuz No:</strong> #${id}</td></tr>
                 <tr><td style="padding: 4px 10px; font-size: 13px; text-align: left;"><strong>Tarih:</strong> ${formattedDate}</td></tr>
                 <tr><td style="padding: 4px 10px; font-size: 13px; text-align: left;"><strong>Saat:</strong> ${currentTime}</td></tr>
                 <tr><td style="padding: 4px 10px 10px 10px; font-size: 13px; text-align: left;"><strong>Şube:</strong> Gaziantep Merkez Lab.</td></tr>
               </table>
             </td>
           </tr>
         </table>
         
         <div style="font-size: 11px; color: #475569; margin-bottom: 15px; display: block;">
           Adres: Şehitkapi Mah. Atatürk Cad. No:12/A Şahinbey / GAZİANTEP | Tel: 0 (342) 000 00 00 | E-posta: info@basyildizdis.com.tr | VD: Şahinbey - VKN: 1234567890
         </div>

         <hr style="border: none; border-top: 3px solid #0f172a; margin-bottom: 25px;">

         <!-- Payer Info Table -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
           <tr>
             <td style="width: 48%; border: 1px solid #cbd5e1; padding: 15px; background: #f8fafc; vertical-align: top;">
               <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">ÖDEMEYİ YAPAN / CARİ HESAP</div>
               <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${doctorName}</div>
             </td>
             <td style="width: 4%;"></td> <!-- Gutter -->
             <td style="width: 48%; border: 1px solid #cbd5e1; padding: 15px; background: #f8fafc; vertical-align: top;">
               <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">TAHSİLAT İŞLEMİ / ÖDEME TÜRÜ</div>
               <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">İşlem: <span style="font-weight: normal;">Laboratuvar Cari Hesabına Mahsuben Tahsilat</span></div>
               <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Şekli: <span style="font-weight: normal;">${notes || 'Nakit / Banka Havalesi'}</span></div>
             </td>
           </tr>
         </table>

         <!-- Main Table -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
           <thead>
             <tr>
               <th style="border: 1px solid #0f172a; padding: 10px; background: #0f172a; color: white; text-align: left; font-size: 13px;">Sıra No</th>
               <th style="border: 1px solid #0f172a; padding: 10px; background: #0f172a; color: white; text-align: left; font-size: 13px;">Açıklama</th>
               <th style="border: 1px solid #0f172a; padding: 10px; background: #0f172a; color: white; text-align: left; font-size: 13px;">Ödeme Yöntemi</th>
               <th style="border: 1px solid #0f172a; padding: 10px; background: #0f172a; color: white; text-align: right; font-size: 13px;">Tutar (TL)</th>
             </tr>
           </thead>
           <tbody>
             <tr>
               <td style="border: 1px solid #cbd5e1; padding: 12px; font-size: 14px; text-align: center;">1</td>
               <td style="border: 1px solid #cbd5e1; padding: 12px; font-size: 14px;">Klinik / Doktor Cari Hesap Ödemesi</td>
               <td style="border: 1px solid #cbd5e1; padding: 12px; font-size: 14px;">${notes || 'Nakit / Banka Havalesi'}</td>
               <td style="border: 1px solid #cbd5e1; padding: 12px; font-size: 14px; text-align: right; font-weight: bold;">${formattedAmount}</td>
             </tr>
           </tbody>
         </table>

         <!-- Total Table -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
           <tr>
             <td style="text-align: right;">
               <div style="border: 2px solid #0f172a; padding: 12px 20px; background: #f8fafc; display: inline-block;">
                 <span style="font-size: 14px; font-weight: bold; color: #334155; margin-right: 15px;">GENEL TOPLAM:</span>
                 <span style="font-size: 20px; font-weight: 900; color: #0f172a;">${formattedAmount}</span>
               </div>
             </td>
           </tr>
         </table>

         <div style="font-size: 14px; font-style: italic; font-weight: 600; color: #0f172a; margin-bottom: 25px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; display: block;">
            ${amountInWords}
         </div>

         <!-- Legal Text -->
         <div style="font-size: 11px; color: #475569; text-align: justify; line-height: 1.5; margin-bottom: 35px; display: block;">
           İşbu belge; yukarıda unvanı ve adı belirtilen klinik/hekim hesabından, karşılığında laboratuvar hizmet bedeli veya cari mahsup olmak üzere yukarıda belirtilen tutarın kuruma nakden / hesaben tahsil edildiğini tevsik ve beyan eder. 213 Sayılı Vergi Usul Kanunu hükümleri uyarınca cari hesap kaydına işlenmiştir.
         </div>

         <!-- Signatures Table -->
         <table style="width: 100%; border-collapse: collapse;">
           <tr>
             <td style="width: 45%; border: 1px solid #0f172a; text-align: center; vertical-align: top;">
               <div style="background: #0f172a; color: white; padding: 8px; font-size: 12px; font-weight: bold;">ÖDEMEYİ YAPAN (KLİNİK / DOKTOR)</div>
               <div style="height: 90px; padding-top: 75px; color: #94a3b8; font-size: 11px;">Adı Soyadı / İmza / Kaşe</div>
             </td>
             <td style="width: 10%;"></td> <!-- Gutter -->
             <td style="width: 45%; border: 1px solid #0f172a; text-align: center; vertical-align: top;">
               <div style="background: #0f172a; color: white; padding: 8px; font-size: 12px; font-weight: bold;">TAHSİLAT YAPAN (KURUM YETKİLİSİ)</div>
               <div style="height: 90px; padding-top: 75px; color: #94a3b8; font-size: 11px;">Başyıldız Diş Stüdyosu - Kaşe ve İmza</div>
             </td>
           </tr>
         </table>
      </div>
    `;
    document.body.appendChild(container);

    const element = container.querySelector('#receipt-pdf-template');
    const opt = {
        margin:       10,
        filename:     `Basyildiz_Tahsilat_Makbuzu_ID${id}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, scrollX: 0, scrollY: 0, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(container);
    });
  };

  // --------------------------------------------------
  // YENİ İŞ EKLE - TARİH KISITLAMALARI
  // --------------------------------------------------
  const stageMetal = document.getElementById('stage-metal');
  const stageDentin = document.getElementById('stage-dentin');
  const stageWax = document.getElementById('stage-wax');
  const stageFinish = document.getElementById('stage-finish');

  const updateDateMins = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minNow = now.toISOString().slice(0, 16);

    if (stageMetal) stageMetal.min = minNow;

    if (stageDentin) {
      stageDentin.min = (stageMetal && stageMetal.value) ? stageMetal.value : minNow;
    }

    if (stageWax) {
      let minWax = minNow;
      if (stageDentin && stageDentin.value) minWax = stageDentin.value;
      else if (stageMetal && stageMetal.value) minWax = stageMetal.value;
      stageWax.min = minWax;
    }

    if (stageFinish) {
      let minFinish = minNow;
      if (stageWax && stageWax.value) minFinish = stageWax.value;
      else if (stageDentin && stageDentin.value) minFinish = stageDentin.value;
      else if (stageMetal && stageMetal.value) minFinish = stageMetal.value;
      stageFinish.min = minFinish;
    }
  };

  const enforceDateOrder = () => {
    updateDateMins();
    if (stageMetal && stageDentin && stageDentin.value && stageDentin.value < stageMetal.value) stageDentin.value = '';
    if (stageMetal && stageWax && stageWax.value && stageWax.value < stageMetal.value) stageWax.value = '';
    if (stageMetal && stageFinish && stageFinish.value && stageFinish.value < stageMetal.value) stageFinish.value = '';
    
    if (stageDentin && stageWax && stageWax.value && stageWax.value < stageDentin.value) stageWax.value = '';
    if (stageDentin && stageFinish && stageFinish.value && stageFinish.value < stageDentin.value) stageFinish.value = '';
    
    if (stageWax && stageFinish && stageFinish.value && stageFinish.value < stageWax.value) stageFinish.value = '';
  };

  if (stageMetal) stageMetal.addEventListener('change', enforceDateOrder);
  if (stageDentin) stageDentin.addEventListener('change', enforceDateOrder);
  if (stageWax) stageWax.addEventListener('change', enforceDateOrder);
  if (stageFinish) stageFinish.addEventListener('change', enforceDateOrder);
  
  // İlk çalıştırma
  updateDateMins();

  // İLK YÜKLENME AŞAMASI
  // --------------------------------------------------
  fetchStats();
  // İlk görünüm olarak Dashboard'u yükle
  switchView('view-dashboard');
});
