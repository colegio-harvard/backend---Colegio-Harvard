const { exec } = require('child_process');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/wasabi');

const BUCKET = process.env.WASABI_BUCKET_BACKUPS || 'colegio-fernando-backups';

/**
 * Ejecuta pg_dump y sube el resultado a Wasabi.
 * Usa DATABASE_URL o las variables DB_* individuales.
 */
const ejecutarBackup = async () => {
  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10); // 2026-03-10
  const hora = ahora.toISOString().slice(11, 19).replace(/:/g, '-'); // 14-30-00
  const key = `db/${fecha}/backup-${fecha}_${hora}.sql`;

  // Construir connection string para pg_dump
  const dbUrl = process.env.DATABASE_URL
    || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

  return new Promise((resolve, reject) => {
    const cmd = `pg_dump "${dbUrl}" --no-owner --no-acl`;

    exec(cmd, { maxBuffer: 100 * 1024 * 1024 }, async (error, stdout, stderr) => {
      if (error) {
        console.error('[BACKUP] Error ejecutando pg_dump:', error.message);
        return reject(error);
      }

      if (!stdout || stdout.length === 0) {
        const msg = '[BACKUP] pg_dump retorno vacio';
        console.error(msg);
        return reject(new Error(msg));
      }

      try {
        const buffer = Buffer.from(stdout, 'utf-8');
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: 'application/sql',
        }));

        console.log(`[BACKUP] OK — ${key} (${sizeMB} MB)`);
        resolve({ key, sizeMB });
      } catch (uploadErr) {
        console.error('[BACKUP] Error subiendo a Wasabi:', uploadErr.message);
        reject(uploadErr);
      }
    });
  });
};

module.exports = { ejecutarBackup };
