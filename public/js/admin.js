document.addEventListener('DOMContentLoaded', () => {
  // Global Durum Değişkenleri
  const selectedTeeth = new Set();
  let doctorsList = [];

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

  // Toast message notify
  const notifySuccess = (msg) => {
    alert('✓ Başarılı: ' + msg);
  };

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

  // Datalist ve Filtreler için Sadece Doktor Listesi
  const fetchDoctorsListOnly = async () => {
    try {
      const res = await fetch('/api/doctors');
      doctorsList = await res.json();

      // Doktor seçimi datalistini doldur
      const datalist = document.getElementById('doctors-list-datalist');
      if (datalist) {
        datalist.innerHTML = '';
        doctorsList.forEach(doc => {
          const opt = document.createElement('option');
          opt.value = doc.name;
          datalist.appendChild(opt);
        });
      }

      // Filtre barındaki doktor listesini doldur
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

  // 3. Cari Hesaplar (Doktorlar / Klinikler)
  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/doctors');
      const docs = await res.json();
      const body = document.getElementById('doctors-table-body');
      body.innerHTML = '';

      if (docs.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Kayıtlı doktor bulunamadı.</td></tr>';
        return;
      }

      docs.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>#${doc.id}</strong></td>
          <td><strong>${doc.name}</strong></td>
          <td>${doc.phone || '-'}</td>
          <td>${formatCurrency(doc.total_debt)}</td>
          <td>${formatCurrency(doc.total_paid)}</td>
          <td style="color: ${doc.balance > 0 ? 'var(--accent)' : 'var(--success)'}; font-weight: 700;">
            ${formatCurrency(doc.balance)}
          </td>
          <td>
            <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="showDoctorDetail(${doc.id})">Cari/Ödeme Geçmişi</button>
          </td>
        `;
        body.appendChild(row);
      });
    } catch (err) {
      console.error('Doktor carileri çekilirken hata:', err);
    }
  };

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
    document.getElementById('job-entry-date').value = new Date().toISOString().split('T')[0];
  };

  // --------------------------------------------------
  // DOKTOR DETAY / FİNANS DÜŞÜMÜ MANTIĞI
  // --------------------------------------------------
  const showDoctorDetail = async (docId) => {
    try {
      const res = await fetch(`/api/doctors/${docId}`);
      const data = await res.json();
      
      const doc = data.doctor;
      document.getElementById('doc-modal-title').textContent = `${doc.name} - Cari Hesap Ekstresi`;
      document.getElementById('doc-modal-total-debt').textContent = formatCurrency(doc.total_debt);
      document.getElementById('doc-modal-total-paid').textContent = formatCurrency(doc.total_paid);
      
      const balanceEl = document.getElementById('doc-modal-balance');
      balanceEl.textContent = formatCurrency(doc.balance);
      if (doc.balance > 0) {
        balanceEl.style.color = 'var(--accent)';
      } else {
        balanceEl.style.color = 'var(--success)';
      }

      // Ödeme formu gizli alanını ayarla
      document.getElementById('payment-doctor-id').value = doc.id;
      document.getElementById('payment-amount').value = '';
      document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
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
    const amount = document.getElementById('payment-amount').value;
    const paymentDate = document.getElementById('payment-date').value;
    const notes = document.getElementById('payment-notes').value;

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
    if (!confirm('Bu ödeme tahsilat kaydını silmek istediğinize emin misiniz? Alacak bakiyesi geri yüklenecektir.')) return;
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

    // Doktor id'sini bul (Datalistteki eşleşmeye göre)
    let doctorId = '';
    const matchedDoc = doctorsList.find(d => d.name.toLowerCase() === doctorName.toLowerCase());
    if (matchedDoc) {
      doctorId = matchedDoc.id;
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
    if (!confirm('Bu iş emrini silmek istediğinize emin misiniz? İlişkili borç tutarı hekim cari hesabından düşülecektir.')) return;
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
    if (!confirm('Bu galeri vakasını ve görsellerini silmek istediğinize emin misiniz?')) return;
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
  const todayDate = new Date().toISOString().split('T')[0];
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

  const fetchExpenses = () => {
    const tableBody = document.getElementById('expense-table-body');
    const emptyState = document.getElementById('expense-empty-state');
    const totalDisplay = document.getElementById('total-expenses');
    
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    let total = 0;

    if (localExpenses.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
    } else {
      emptyState.classList.add('hidden');
      emptyState.classList.remove('flex');

      localExpenses.forEach(exp => {
        total += parseFloat(exp.amount);
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
    }
    
    if(totalDisplay) {
      totalDisplay.innerText = total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
    }
  };
  window.fetchExpenses = fetchExpenses;

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
      fetchExpenses();
      
      expenseForm.reset();
      document.getElementById('expense-date').value = todayDate;
      notifySuccess('Yeni gider başarıyla kaydedildi.');
    });
  }

  window.deleteExpense = function(id) {
    if (confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) {
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
      <div id="receipt-pdf-template" style="font-family: 'Arial', sans-serif; padding: 20px; color: #0f172a; width: 100%; margin: 0 auto; box-sizing: border-box;">
         <!-- Header -->
         <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
           <div>
             <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #0f172a;">BAŞYILDIZ DİŞ STÜDYOSU</h1>
             <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 5px;">Ağız ve Diş Sağlığı Protez Laboratuvarı & Klinik Çözümleri</div>
           </div>
           <div style="text-align: right;">
             <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #0f172a;">RESMİ TAHSİLAT MAKBUZU</h2>
             <div style="border: 2px solid #0f172a; padding: 10px; margin-top: 10px; border-radius: 6px; display: inline-block; text-align: left; background: #f8fafc;">
                <div style="font-size: 13px; margin-bottom: 4px;"><strong>Makbuz No:</strong> #${id}</div>
                <div style="font-size: 13px; margin-bottom: 4px;"><strong>Tarih:</strong> ${formattedDate}</div>
                <div style="font-size: 13px; margin-bottom: 4px;"><strong>Saat:</strong> ${currentTime}</div>
                <div style="font-size: 13px;"><strong>Şube:</strong> Gaziantep Merkez Lab.</div>
             </div>
           </div>
         </div>
         
         <div style="font-size: 11px; color: #475569; margin-bottom: 15px;">
           Adres: Şehitkapi Mah. Atatürk Cad. No:12/A Şahinbey / GAZİANTEP | Tel: 0 (342) 000 00 00 | E-posta: info@basyildizdis.com.tr | VD: Şahinbey - VKN: 1234567890
         </div>

         <hr style="border: none; border-top: 3px solid #0f172a; margin-bottom: 30px;">

         <!-- Payer Info -->
         <div style="display: flex; gap: 20px; margin-bottom: 30px;">
            <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background: #f8fafc; box-sizing: border-box;">
               <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">ÖDEMEYİ YAPAN / CARİ HESAP</div>
               <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${doctorName}</div>
            </div>
            <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background: #f8fafc; box-sizing: border-box;">
               <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">TAHSİLAT İŞLEMİ / ÖDEME TÜRÜ</div>
               <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">İşlem: <span style="font-weight: normal;">Laboratuvar Cari Hesabına Mahsuben Tahsilat</span></div>
               <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Şekli: <span style="font-weight: normal;">${notes || 'Nakit / Banka Havalesi'}</span></div>
            </div>
         </div>

         <!-- Table -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
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

         <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
            <div style="border: 2px solid #0f172a; padding: 12px 20px; border-radius: 6px; background: #f8fafc; display: flex; align-items: center; gap: 15px;">
               <span style="font-size: 14px; font-weight: bold; color: #334155;">GENEL TOPLAM:</span>
               <span style="font-size: 20px; font-weight: 900; color: #0f172a;">${formattedAmount}</span>
            </div>
         </div>

         <div style="font-size: 14px; font-style: italic; font-weight: 600; color: #0f172a; margin-bottom: 30px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px;">
            ${amountInWords}
         </div>

         <!-- Legal Text -->
         <div style="font-size: 11px; color: #475569; text-align: justify; line-height: 1.5; margin-bottom: 40px;">
           İşbu belge; yukarıda unvanı ve adı belirtilen klinik/hekim hesabından, karşılığında laboratuvar hizmet bedeli veya cari mahsup olmak üzere yukarıda belirtilen tutarın kuruma nakden / hesaben tahsil edildiğini tevsik ve beyan eder. 213 Sayılı Vergi Usul Kanunu hükümleri uyarınca cari hesap kaydına işlenmiştir.
         </div>

         <!-- Signatures -->
         <div style="display: flex; gap: 30px;">
            <div style="flex: 1; border: 1px solid #0f172a; border-radius: 8px; text-align: center; overflow: hidden;">
               <div style="background: #0f172a; color: white; padding: 8px; font-size: 12px; font-weight: bold;">ÖDEMEYİ YAPAN (KLİNİK / DOKTOR)</div>
               <div style="height: 100px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; color: #94a3b8; font-size: 11px;">Adı Soyadı / İmza / Kaşe</div>
            </div>
            <div style="flex: 1; border: 1px solid #0f172a; border-radius: 8px; text-align: center; overflow: hidden;">
               <div style="background: #0f172a; color: white; padding: 8px; font-size: 12px; font-weight: bold;">TAHSİLAT YAPAN (KURUM YETKİLİSİ)</div>
               <div style="height: 100px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; color: #94a3b8; font-size: 11px;">Başyıldız Diş Stüdyosu - Kaşe ve İmza</div>
            </div>
         </div>
      </div>
    `;
    document.body.appendChild(container);

    const element = container.querySelector('#receipt-pdf-template');
    const opt = {
        margin:       15,
        filename:     `Basyildiz_Tahsilat_Makbuzu_ID${id}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, windowWidth: 794 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(container);
    });
  };

  // İLK YÜKLENME AŞAMASI
  // --------------------------------------------------
  fetchStats();
  // İlk görünüm olarak Dashboard'u yükle
  switchView('view-dashboard');
});
