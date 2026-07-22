const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Veritabanı bağlantı hatası:', err.message);
  } else {
    console.log('SQLite veritabanına başarıyla bağlanıldı.');
  }
});

// Yabancı anahtar (Foreign Key) desteğini etkinleştir
db.run('PRAGMA foreign_keys = ON;');

// Helper Promise Fonksiyonları
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('SQL Çalıştırma Hatası:', err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('SQL Sorgulama Hatası:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('SQL Tek Kayıt Sorgulama Hatası:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const dbTransaction = async (callback) => {
  await dbRun('BEGIN TRANSACTION');
  try {
    const txRun = dbRun;
    const txAll = dbAll;
    const txGet = dbGet;
    
    const result = await callback({ txRun, txAll, txGet });
    
    await dbRun('COMMIT');
    return result;
  } catch (error) {
    await dbRun('ROLLBACK');
    throw error;
  }
};

// Veritabanı Tablolarını Oluştur
const initDatabase = async () => {
  try {
    // 1. DOKTORLAR / KLİNİKLER TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS doctors (
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

    // 2. İŞLER (İŞ EMİRLERİ) TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS jobs (
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

    // 3. ÖDEMELER TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS payments (
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

    // 4. GALERİ VAKALARI TABLOSU
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

    console.log('SQLite veritabanı tabloları kontrol edildi / oluşturuldu.');
  } catch (error) {
    console.error('Veritabanı ilklendirme hatası:', error);
  }
};

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  dbTransaction,
  initDatabase
};
