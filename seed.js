const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const seed = async () => {
  console.log('Veritabanı sıfırlanıyor ve örnek veriler yükleniyor...');
  
  try {
    // Tabloları temizle
    await dbRun('DROP TABLE IF EXISTS payments;');
    await dbRun('DROP TABLE IF EXISTS jobs;');
    await dbRun('DROP TABLE IF EXISTS doctors;');
    await dbRun('DROP TABLE IF EXISTS gallery;');

    // 1. Tabloları Yeniden Oluştur
    await dbRun(`
      CREATE TABLE doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        email TEXT,
        total_debt REAL DEFAULT 0.0,
        total_paid REAL DEFAULT 0.0,
        balance REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL,
        patient_name TEXT NOT NULL,
        sequence_no TEXT,
        entry_date DATE NOT NULL,
        delivery_date DATE,
        patient_age INTEGER,
        patient_gender TEXT,
        tooth_shape TEXT,
        tooth_color TEXT,
        selected_teeth TEXT,
        treatment_types TEXT,
        metal_trial_date DATETIME,
        dentin_trial_date DATETIME,
        wax_trial_date DATETIME,
        finish_trial_date DATETIME,
        status TEXT DEFAULT 'Yeni',
        notes TEXT,
        pdf_path TEXT,
        total_price REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT
      );
    `);

    await dbRun(`
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL,
        job_id INTEGER,
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
        FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE SET NULL
      );
    `);

    // 2. Doktor Kayıtlarını Ekle
    const doc1 = await dbRun("INSERT INTO doctors (name, phone, email) VALUES ('Dr. Ahmet Yılmaz (Kadıköy Diş)', '+90 532 111 22 33', 'ahmet@kadikoydis.com');");
    const doc2 = await dbRun("INSERT INTO doctors (name, phone, email) VALUES ('Dr. Selin Demir (Nişantaşı Estetik)', '+90 533 444 55 66', 'selin@nisantasidental.com');");
    const doc3 = await dbRun("INSERT INTO doctors (name, phone, email) VALUES ('Dr. Caner Koç (Bağdat Cad. Clinic)', '+90 542 777 88 99', 'caner@bagdatdental.com');");

    const docId1 = doc1.id;
    const docId2 = doc2.id;
    const docId3 = doc3.id;

    // 3. İş Kayıtlarını Ekle
    // İş 1 (Dr. Ahmet Yılmaz)
    const job1 = await dbRun(`
      INSERT INTO jobs (
        doctor_id, patient_name, sequence_no, entry_date, delivery_date,
        patient_age, patient_gender, tooth_shape, tooth_color, selected_teeth,
        treatment_types, status, notes, total_price
      ) VALUES (?, 'Mehmet Kaya', 'VAKA-101', '2026-07-15', '2026-07-22', 45, 'Erkek', 'Kare', 'A1', '11,12,21,22', 'Zirkon Cad. Cam', 'Yeni', 'Estetik kesim talep edildi', 6000.0)
    `, [docId1]);

    // İş 2 (Dr. Selin Demir)
    const job2 = await dbRun(`
      INSERT INTO jobs (
        doctor_id, patient_name, sequence_no, entry_date, delivery_date,
        patient_age, patient_gender, tooth_shape, tooth_color, selected_teeth,
        treatment_types, metal_trial_date, status, notes, total_price
      ) VALUES (?, 'Elif Acar', 'VAKA-102', '2026-07-12', '2026-07-20', 29, 'Kadın', 'Yuvarlak', 'B1', '13,12,11,21,22,23', 'IPS E-Max Ceram, Lamine', '2026-07-16 11:30', '1. Dentin Prova', 'Lamine kalınlığı minimumda tutulsun', 15000.0)
    `, [docId2]);

    // İş 3 (Dr. Caner Koç)
    const job3 = await dbRun(`
      INSERT INTO jobs (
        doctor_id, patient_name, sequence_no, entry_date, delivery_date,
        patient_age, patient_gender, tooth_shape, tooth_color, selected_teeth,
        treatment_types, metal_trial_date, dentin_trial_date, status, notes, total_price
      ) VALUES (?, 'Bora Altın', 'VAKA-103', '2026-07-08', '2026-07-16', 52, 'Erkek', 'Kare-Yuvarlak', 'A3', '46', 'İmplant, Custom Abutment', '2026-07-11 09:00', '2026-07-14 14:00', 'Bitim', 'Toronto tasarım', 8000.0)
    `, [docId3]);

    // 4. Ödeme Kayıtlarını Ekle
    // Dr. Ahmet Yılmaz ödeme yaptı
    await dbRun("INSERT INTO payments (doctor_id, amount, payment_date, notes) VALUES (?, 2000.0, '2026-07-16', 'Nakit Tahsilat');", [docId1]);
    
    // Dr. Selin Demir ödeme yaptı
    await dbRun("INSERT INTO payments (doctor_id, amount, payment_date, notes) VALUES (?, 5000.0, '2026-07-14', 'Banka Havalesi');", [docId2]);

    // Dr. Caner Koç ödeme yaptı (Tamamen kapattı)
    await dbRun("INSERT INTO payments (doctor_id, amount, payment_date, notes) VALUES (?, 8000.0, '2026-07-15', 'Kredi Kartı - Tek Çekim');", [docId3]);

    // 5. Doktor Bakiyelerini Güncelle (Cari Hesapları senkronize et)
    // Dr. Ahmet Yılmaz: Borç: 6000, Ödeme: 2000, Bakiye: 4000
    await dbRun("UPDATE doctors SET total_debt = 6000.0, total_paid = 2000.0, balance = 4000.0 WHERE id = ?;", [docId1]);

    // Dr. Selin Demir: Borç: 15000, Ödeme: 5000, Bakiye: 10000
    await dbRun("UPDATE doctors SET total_debt = 15000.0, total_paid = 5000.0, balance = 10000.0 WHERE id = ?;", [docId2]);

    // Dr. Caner Koç: Borç: 8000, Ödeme: 8000, Bakiye: 0
    await dbRun("UPDATE doctors SET total_debt = 8000.0, total_paid = 8000.0, balance = 0.0 WHERE id = ?;", [docId3]);

    // 6. Galeri Kayıtlarını Ekle
    await dbRun(`
      CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        before_image TEXT NOT NULL,
        after_image TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      INSERT INTO gallery (title, description, category, before_image, after_image)
      VALUES 
      ('Full Zirkonyum Köprü Restorasyonu', 'Çoklu diş kaybı ve renk bozukluğu olan vakada CAD/CAM zirkonyum köprü çalışması.', 'zirconium', '/images/teeth_before.png', '/images/teeth_after.png'),
      ('IPS E-Max Anterior Lamine Veneer', 'Ön bölge diastema kapatma ve mikro aşınma problemi yaşayan hastaya estetik lamine çalışması.', 'emax', '/images/teeth_before.png', '/images/teeth_after.png'),
      ('Hibrit İmplant Üstü Toronto Protez', 'Tam dişsiz çenede multi-unit abutmentlar üzerine vidalı metal destekli akrilik hibrit protez.', 'implant', '/images/teeth_before.png', '/images/teeth_after.png')
    `);

    console.log('✓ Veritabanı başarıyla örneklendirildi (Seeding tamamlandı).');
    process.exit(0);

  } catch (err) {
    console.error('Örnekleme hatası:', err);
    process.exit(1);
  }
};

seed();
