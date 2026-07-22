require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'soner_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper Promise Fonksiyonları (Uyumluluk için)
const dbRun = async (sql, params = []) => {
  try {
    const [result] = await pool.execute(sql, params);
    return { id: result.insertId, changes: result.affectedRows };
  } catch (err) {
    console.error('SQL Çalıştırma Hatası:', err);
    throw err;
  }
};

const dbAll = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    console.error('SQL Sorgulama Hatası:', err);
    throw err;
  }
};

const dbGet = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error('SQL Tek Kayıt Sorgulama Hatası:', err);
    throw err;
  }
};

// Transaction wrapper helper for server.js
const dbTransaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Geçici olarak transaction objesi üzerinden helper fonksiyonlar
    const txRun = async (sql, params = []) => {
      const [result] = await connection.execute(sql, params);
      return { id: result.insertId, changes: result.affectedRows };
    };
    const txAll = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };
    const txGet = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows.length ? rows[0] : null;
    };

    const result = await callback({ txRun, txAll, txGet });
    
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Veritabanı Tablolarını Oluştur
const initDatabase = async () => {
  try {
    // 1. DOKTORLAR / KLİNİKLER TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(255),
        email VARCHAR(255),
        total_debt DOUBLE DEFAULT 0.0,
        total_paid DOUBLE DEFAULT 0.0,
        balance DOUBLE DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. İŞLER (İŞ EMİRLERİ) TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT NOT NULL,
        patient_name VARCHAR(255) NOT NULL,
        sequence_no VARCHAR(255),
        entry_date DATE NOT NULL,
        delivery_date DATE,
        patient_age INT,
        patient_gender VARCHAR(50),
        tooth_shape VARCHAR(100),
        tooth_color VARCHAR(100),
        selected_teeth TEXT,
        treatment_types TEXT,
        metal_trial_date DATETIME,
        dentin_trial_date DATETIME,
        wax_trial_date DATETIME,
        finish_trial_date DATETIME,
        status VARCHAR(100) DEFAULT 'Yeni',
        notes TEXT,
        pdf_path TEXT,
        total_price DOUBLE DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT
      );
    `);

    // 3. ÖDEMELER TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT NOT NULL,
        job_id INT,
        amount DOUBLE NOT NULL,
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
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        before_image VARCHAR(255) NOT NULL,
        after_image VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. GİDERLER TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        amount DOUBLE NOT NULL,
        expense_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('MySQL veritabanı tabloları kontrol edildi / oluşturuldu.');
  } catch (error) {
    console.error('Veritabanı ilklendirme hatası:', error);
  }
};

module.exports = {
  db: pool,
  dbRun,
  dbAll,
  dbGet,
  dbTransaction,
  initDatabase
};
