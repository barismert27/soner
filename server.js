const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { initDatabase, dbRun, dbAll, dbGet, dbTransaction } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON ve URL-encoded veri çözümleme desteği
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads dizinini oluştur ve statik olarak dışarı aç
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Multer Dosya Yükleme Yapılandırması (PDF Sınırlandırmalı)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Yalnızca PDF dosyaları yüklenebilir!'), false);
    }
  }
});

const uploadImages = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Yalnızca resim dosyaları yüklenebilir!'), false);
    }
  }
});

// Statik Dosyalar (Frontend ve Admin)
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// DOKTOR / KLİNİK APIS
// ----------------------------------------------------

// Tüm doktorları borç/alacak bakiyeleriyle listele
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await dbAll('SELECT * FROM doctors ORDER BY name ASC');
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Doktor detayını ödemeleriyle ve işleriyle getir
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doctor = await dbGet('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doktor bulunamadı.' });
    }
    const jobs = await dbAll('SELECT * FROM jobs WHERE doctor_id = ? ORDER BY created_at DESC', [req.params.id]);
    const payments = await dbAll('SELECT * FROM payments WHERE doctor_id = ? ORDER BY payment_date DESC, id DESC', [req.params.id]);
    res.json({ doctor, jobs, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manuel Doktor/Klinik Ekleme
app.post('/api/doctors', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Doktor/Klinik adı zorunludur.' });
    }
    const result = await dbRun(
      'INSERT INTO doctors (name, phone, email) VALUES (?, ?, ?)',
      [name.trim(), phone || null, email || null]
    );
    res.status(201).json({ success: true, id: result.id, message: 'Doktor/Klinik kaydı başarıyla oluşturuldu.' });
  } catch (error) {
    if (error.message.includes('Duplicate') || error.message.includes('UNIQUE')) {
      res.status(400).json({ success: false, message: 'Bu isimde bir doktor/klinik zaten kayıtlı.' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// ----------------------------------------------------
// İŞ / İŞ EMRİ APIS
// ----------------------------------------------------

// İşleri listele (Filtreleme desteği ile)
app.get('/api/jobs', async (req, res) => {
  try {
    const { doctor_id, status, search, start_date, end_date } = req.query;
    let query = `
      SELECT jobs.*, doctors.name as doctor_name 
      FROM jobs 
      JOIN doctors ON jobs.doctor_id = doctors.id
      WHERE 1=1
    `;
    const params = [];

    if (doctor_id) {
      query += ' AND jobs.doctor_id = ?';
      params.push(doctor_id);
    }
    if (status) {
      query += ' AND jobs.status = ?';
      params.push(status);
    }
    if (start_date) {
      query += ' AND jobs.entry_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND jobs.entry_date <= ?';
      params.push(end_date);
    }
    if (search) {
      query += ' AND (jobs.patient_name LIKE ? OR doctors.name LIKE ? OR jobs.sequence_no LIKE ?)';
      const searchParam = \`%\${search}%\`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY jobs.id DESC';

    const jobs = await dbAll(query, params);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tekil iş detayı
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await dbGet(`
      SELECT jobs.*, doctors.name as doctor_name 
      FROM jobs 
      JOIN doctors ON jobs.doctor_id = doctors.id 
      WHERE jobs.id = ?
    `, [req.params.id]);

    if (!job) {
      return res.status(404).json({ success: false, message: 'İş emri bulunamadı.' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Yeni İş Ekleme (İlişkili bakiye düşümü / eklemesi içerir)
app.post('/api/jobs', upload.single('pdf'), async (req, res) => {
  try {
    let {
      doctor_name,
      doctor_id,
      patient_name,
      sequence_no,
      entry_date,
      delivery_date,
      patient_age,
      patient_gender,
      tooth_shape,
      tooth_color,
      selected_teeth,
      treatment_types,
      metal_trial_date,
      dentin_trial_date,
      wax_trial_date,
      finish_trial_date,
      status,
      notes,
      total_price
    } = req.body;

    if (!patient_name) {
      return res.status(400).json({ success: false, message: 'Hasta adı zorunludur.' });
    }

    total_price = parseFloat(total_price) || 0;
    patient_age = parseInt(patient_age) || null;
    const pdf_path = req.file ? \`/uploads/\${req.file.filename}\` : null;

    const { jobId } = await dbTransaction(async (tx) => {
      let finalDoctorId = doctor_id;

      if (!finalDoctorId && doctor_name) {
        const docNameClean = doctor_name.trim();
        let doctor = await tx.txGet('SELECT id FROM doctors WHERE name = ?', [docNameClean]);
        if (!doctor) {
          const result = await tx.txRun('INSERT INTO doctors (name) VALUES (?)', [docNameClean]);
          finalDoctorId = result.id;
        } else {
          finalDoctorId = doctor.id;
        }
      }

      if (!finalDoctorId) {
        throw new Error('Geçerli bir Doktor veya Klinik seçilmelidir.');
      }

      const jobResult = await tx.txRun(`
        INSERT INTO jobs (
          doctor_id, patient_name, sequence_no, entry_date, delivery_date,
          patient_age, patient_gender, tooth_shape, tooth_color, selected_teeth,
          treatment_types, metal_trial_date, dentin_trial_date, wax_trial_date,
          finish_trial_date, status, notes, pdf_path, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        finalDoctorId,
        patient_name.trim(),
        sequence_no || null,
        entry_date || new Date().toISOString().split('T')[0],
        delivery_date || null,
        patient_age,
        patient_gender || null,
        tooth_shape || null,
        tooth_color || null,
        selected_teeth || '',
        treatment_types || '',
        metal_trial_date || null,
        dentin_trial_date || null,
        wax_trial_date || null,
        finish_trial_date || null,
        status || 'Yeni',
        notes || null,
        pdf_path,
        total_price
      ]);

      await tx.txRun(`
        UPDATE doctors 
        SET total_debt = total_debt + ?, 
            balance = balance + ?
        WHERE id = ?
      `, [total_price, total_price, finalDoctorId]);

      return { jobId: jobResult.id };
    });

    res.status(201).json({
      success: true,
      message: 'İş emri başarıyla oluşturuldu ve doktor cari hesabına yansıtıldı.',
      jobId: jobId,
      pdf_path
    });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// İş Güncelleme
app.put('/api/jobs/:id', upload.single('pdf'), async (req, res) => {
  const jobId = req.params.id;
  try {
    const existingJob = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!existingJob) {
      return res.status(404).json({ success: false, message: 'Güncellenecek iş bulunamadı.' });
    }

    let {
      patient_name,
      sequence_no,
      entry_date,
      delivery_date,
      patient_age,
      patient_gender,
      tooth_shape,
      tooth_color,
      selected_teeth,
      treatment_types,
      metal_trial_date,
      dentin_trial_date,
      wax_trial_date,
      finish_trial_date,
      status,
      notes,
      total_price
    } = req.body;

    const newPrice = total_price !== undefined ? parseFloat(total_price) : existingJob.total_price;
    const priceDiff = newPrice - existingJob.total_price;
    const newPdfPath = req.file ? \`/uploads/\${req.file.filename}\` : existingJob.pdf_path;

    await dbTransaction(async (tx) => {
      await tx.txRun(`
        UPDATE jobs SET
          patient_name = ?, sequence_no = ?, entry_date = ?, delivery_date = ?,
          patient_age = ?, patient_gender = ?, tooth_shape = ?, tooth_color = ?, selected_teeth = ?,
          treatment_types = ?, metal_trial_date = ?, dentin_trial_date = ?, wax_trial_date = ?,
          finish_trial_date = ?, status = ?, notes = ?, pdf_path = ?, total_price = ?
        WHERE id = ?
      `, [
        patient_name !== undefined ? patient_name.trim() : existingJob.patient_name,
        sequence_no !== undefined ? sequence_no : existingJob.sequence_no,
        entry_date !== undefined ? entry_date : existingJob.entry_date,
        delivery_date !== undefined ? delivery_date : existingJob.delivery_date,
        patient_age !== undefined ? (parseInt(patient_age) || null) : existingJob.patient_age,
        patient_gender !== undefined ? patient_gender : existingJob.patient_gender,
        tooth_shape !== undefined ? tooth_shape : existingJob.tooth_shape,
        tooth_color !== undefined ? tooth_color : existingJob.tooth_color,
        selected_teeth !== undefined ? selected_teeth : existingJob.selected_teeth,
        treatment_types !== undefined ? treatment_types : existingJob.treatment_types,
        metal_trial_date !== undefined ? metal_trial_date : existingJob.metal_trial_date,
        dentin_trial_date !== undefined ? dentin_trial_date : existingJob.dentin_trial_date,
        wax_trial_date !== undefined ? wax_trial_date : existingJob.wax_trial_date,
        finish_trial_date !== undefined ? finish_trial_date : existingJob.finish_trial_date,
        status !== undefined ? status : existingJob.status,
        notes !== undefined ? notes : existingJob.notes,
        newPdfPath,
        newPrice,
        jobId
      ]);

      if (priceDiff !== 0) {
        await tx.txRun(`
          UPDATE doctors
          SET total_debt = total_debt + ?,
              balance = balance + ?
          WHERE id = ?
        `, [priceDiff, priceDiff, existingJob.doctor_id]);
      }
    });

    res.json({ success: true, message: 'İş başarıyla güncellendi.' });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// İş Silme
app.delete('/api/jobs/:id', async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Silinecek iş bulunamadı.' });
    }

    await dbTransaction(async (tx) => {
      await tx.txRun('DELETE FROM jobs WHERE id = ?', [jobId]);
      await tx.txRun(`
        UPDATE doctors
        SET total_debt = total_debt - ?,
            balance = balance - ?
        WHERE id = ?
      `, [job.total_price, job.total_price, job.doctor_id]);
    });

    res.json({ success: true, message: 'İş başarıyla silindi, cari hesap bakiye düzeltmesi yapıldı.' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// ÖDEME VE FİNANS APIS
// ----------------------------------------------------

// Ödemeleri Listele
app.get('/api/payments', async (req, res) => {
  try {
    const payments = await dbAll(`
      SELECT payments.*, doctors.name as doctor_name 
      FROM payments 
      JOIN doctors ON payments.doctor_id = doctors.id
      ORDER BY payments.payment_date DESC, payments.id DESC
    `);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ödeme Ekleme (Bakiye Düşümü)
app.post('/api/payments', async (req, res) => {
  try {
    let { doctor_id, amount, payment_date, notes, job_id } = req.body;
    amount = parseFloat(amount);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Lütfen geçerli bir ödeme tutarı giriniz.' });
    }
    if (!doctor_id) {
      return res.status(400).json({ success: false, message: 'İlgili Doktor/Klinik seçilmelidir.' });
    }

    await dbTransaction(async (tx) => {
      await tx.txRun(`
        INSERT INTO payments (doctor_id, job_id, amount, payment_date, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [
        doctor_id,
        job_id || null,
        amount,
        payment_date || new Date().toISOString().split('T')[0],
        notes || null
      ]);

      await tx.txRun(`
        UPDATE doctors
        SET total_paid = total_paid + ?,
            balance = balance - ?
        WHERE id = ?
      `, [amount, amount, doctor_id]);
    });

    res.status(201).json({ success: true, message: 'Ödeme başarıyla işlendi, borç bakiyesi düşüldü.' });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Ödeme Silme (Bakiyeyi Geri Yansıtma)
app.delete('/api/payments/:id', async (req, res) => {
  const paymentId = req.params.id;
  try {
    const payment = await dbGet('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Silinecek ödeme kaydı bulunamadı.' });
    }

    await dbTransaction(async (tx) => {
      await tx.txRun('DELETE FROM payments WHERE id = ?', [paymentId]);
      await tx.txRun(`
        UPDATE doctors
        SET total_paid = total_paid - ?,
            balance = balance + ?
        WHERE id = ?
      `, [payment.amount, payment.amount, payment.doctor_id]);
    });

    res.json({ success: true, message: 'Ödeme kaydı silindi, borç bakiyesi güncellendi.' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// İSTATİSTİKLER VE DASHBOARD APIS
// ----------------------------------------------------
app.get('/api/stats', async (req, res) => {
  try {
    const activeJobs = await dbGet("SELECT COUNT(*) as count FROM jobs WHERE status NOT IN ('Bitim', 'Teslim Edildi')");
    const totalJobs = await dbGet("SELECT COUNT(*) as count FROM jobs");
    
    // Cari finansal durum
    const financial = await dbGet(`
      SELECT 
        SUM(total_debt) as totalDebt, 
        SUM(total_paid) as totalPaid, 
        SUM(balance) as totalBalance 
      FROM doctors
    `);

    // En son eklenen 5 iş emri
    const recentJobs = await dbAll(`
      SELECT jobs.*, doctors.name as doctor_name 
      FROM jobs 
      JOIN doctors ON jobs.doctor_id = doctors.id 
      ORDER BY jobs.created_at DESC 
      LIMIT 5
    `);

    res.json({
      activeJobsCount: activeJobs ? activeJobs.count : 0,
      totalJobsCount: totalJobs ? totalJobs.count : 0,
      totalDebt: financial ? (financial.totalDebt || 0) : 0,
      totalPaid: financial ? (financial.totalPaid || 0) : 0,
      totalBalance: financial ? (financial.totalBalance || 0) : 0,
      recentJobs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// GALERİ VAKALARI APIS
// ----------------------------------------------------

// Tüm galeri ögelerini getir
app.get('/api/gallery', async (req, res) => {
  try {
    const items = await dbAll('SELECT * FROM gallery ORDER BY id DESC');
    res.json(items);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Yeni galeri ögesi ekle (Öncesi ve Sonrası resimleri yüklemeli)
app.post('/api/gallery', uploadImages.fields([
  { name: 'before_image', maxCount: 1 },
  { name: 'after_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title || !category) {
      return res.status(400).json({ success: false, message: 'Başlık ve kategori alanları zorunludur.' });
    }
    if (!req.files || !req.files['before_image'] || !req.files['after_image']) {
      return res.status(400).json({ success: false, message: 'Öncesi ve Sonrası fotoğraflarının her ikisi de yüklenmelidir.' });
    }

    const before_image = \`/uploads/\${req.files['before_image'][0].filename}\`;
    const after_image = \`/uploads/\${req.files['after_image'][0].filename}\`;

    const result = await dbRun(
      'INSERT INTO gallery (title, description, category, before_image, after_image) VALUES (?, ?, ?, ?, ?)',
      [title.trim(), description || null, category, before_image, after_image]
    );

    res.status(201).json({ success: true, id: result.id, message: 'Galeri vakası başarıyla oluşturuldu.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Galeri ögesi sil
app.delete('/api/gallery/:id', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Silinecek vaka bulunamadı.' });
    }

    // Diskten resimleri sil (Varsayılan resimleri silme)
    // Sadece sonradan yüklenen (uploads dizinindeki) resimleri diskten sil
    const deleteFile = (imagePath) => {
      if (!imagePath || !imagePath.startsWith('/uploads/')) return;
      const fullPath = path.join(__dirname, imagePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    };

    deleteFile(item.before_image);
    deleteFile(item.after_image);

    await dbRun('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Galeri vakası ve ilişkili resimleri başarıyla silindi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// BAŞLANGIÇ
// ----------------------------------------------------

// Veritabanını ilklendir ve sunucuyu dinlemeye başla
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(\`Sunucu http://localhost:\${PORT} portunda çalışıyor.\`);
  });
}).catch(err => {
  console.error('Sunucu başlatılamadı:', err);
});
