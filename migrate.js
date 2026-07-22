const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
require('dotenv').config();
const path = require('path');

const sqliteDbPath = path.join(__dirname, 'database.sqlite');

console.log('Eski SQLite veritabanına bağlanılıyor...');
const sqliteDb = new sqlite3.Database(sqliteDbPath, (err) => {
  if (err) {
    console.error('SQLite bağlantı hatası. database.sqlite dosyası projenin ana klasöründe olmalı!', err);
    process.exit(1);
  }
});

const getSqliteData = (query) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function migrate() {
  console.log('MySQL veritabanına bağlanılıyor...');
  const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'soner_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    // 1. DOKTORLAR
    console.log('-----------------------------------');
    console.log('Doktorlar/Klinikler okunuyor...');
    const doctors = await getSqliteData('SELECT * FROM doctors');
    for (const doc of doctors) {
      await mysqlPool.execute(`
        INSERT IGNORE INTO doctors (id, name, phone, email, total_debt, total_paid, balance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [doc.id, doc.name, doc.phone, doc.email, doc.total_debt, doc.total_paid, doc.balance, doc.created_at || new Date()]);
    }
    console.log(`${doctors.length} adet doktor aktarıldı.`);

    // 2. İŞ EMİRLERİ (JOBS)
    console.log('-----------------------------------');
    console.log('İş emirleri okunuyor (Bu işlem biraz sürebilir)...');
    const jobs = await getSqliteData('SELECT * FROM jobs');
    for (const job of jobs) {
      await mysqlPool.execute(`
        INSERT IGNORE INTO jobs (
          id, doctor_id, patient_name, sequence_no, entry_date, delivery_date, 
          patient_age, patient_gender, tooth_shape, tooth_color, selected_teeth, 
          treatment_types, metal_trial_date, dentin_trial_date, wax_trial_date, 
          finish_trial_date, status, notes, pdf_path, total_price, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        job.id, job.doctor_id, job.patient_name, job.sequence_no || null, job.entry_date, job.delivery_date || null,
        job.patient_age || null, job.patient_gender || null, job.tooth_shape || null, job.tooth_color || null, job.selected_teeth || '',
        job.treatment_types || '', job.metal_trial_date || null, job.dentin_trial_date || null, job.wax_trial_date || null,
        job.finish_trial_date || null, job.status || 'Yeni', job.notes || null, job.pdf_path || null, job.total_price || 0, job.created_at || new Date()
      ]);
    }
    console.log(`${jobs.length} adet iş emri aktarıldı.`);

    // 3. ÖDEMELER
    console.log('-----------------------------------');
    console.log('Ödemeler okunuyor...');
    const payments = await getSqliteData('SELECT * FROM payments');
    for (const pay of payments) {
      await mysqlPool.execute(`
        INSERT IGNORE INTO payments (id, doctor_id, job_id, amount, payment_date, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [pay.id, pay.doctor_id, pay.job_id || null, pay.amount, pay.payment_date, pay.notes || null, pay.created_at || new Date()]);
    }
    console.log(`${payments.length} adet ödeme aktarıldı.`);

    // 4. GALERİ
    console.log('-----------------------------------');
    console.log('Galeri verileri okunuyor...');
    let galleryCount = 0;
    try {
      const gallery = await getSqliteData('SELECT * FROM gallery');
      for (const item of gallery) {
        await mysqlPool.execute(`
          INSERT IGNORE INTO gallery (id, title, description, category, before_image, after_image, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [item.id, item.title, item.description || null, item.category, item.before_image, item.after_image || '', item.created_at || new Date()]);
      }
      galleryCount = gallery.length;
    } catch (gErr) {
      console.log('Galeri tablosu bulunamadı veya boş atlandı.');
    }
    console.log(`${galleryCount} adet galeri ögesi aktarıldı.`);

    console.log('-----------------------------------');
    console.log('TEBRİKLER! TÜM VERİLERİNİZ BAŞARIYLA MYSQL\'E AKTARILDI.');
    console.log('Artık projenize girip Tamer Başyıldız ve diğer tüm hesapları kontrol edebilirsiniz.');

  } catch (err) {
    console.error('Hata oluştu:', err);
  } finally {
    sqliteDb.close();
    process.exit(0);
  }
}

migrate();
