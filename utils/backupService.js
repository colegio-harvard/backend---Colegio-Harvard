const { exec } = require('child_process');
const crypto = require('crypto');
const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/wasabi');

const BUCKET = process.env.WASABI_BUCKET_BACKUPS || 'colegio-fernando-backups';
let ultimoEstado = { estado: 'sin_ejecutar', fecha: null };
const getBackupStatus = () => ({ ...ultimoEstado });

/**
 * Ejecuta pg_dump y sube el resultado a Wasabi.
 * Usa DATABASE_URL o las variables DB_* individuales.
 */
const ejecutarBackup = async () => {
  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10); // 2026-03-10
  const hora = ahora.toISOString().slice(11, 19).replace(/:/g, '-'); // 14-30-00
  const key = `db/${fecha}/backup-${fecha}_${hora}.sql`;
  ultimoEstado = { estado: 'en_proceso', fecha: ahora.toISOString(), key };

  // Construir connection string para pg_dump
  const dbUrl = process.env.DATABASE_URL
    || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

  return new Promise((resolve, reject) => {
    const cmd = `pg_dump "${dbUrl}" --no-owner --no-acl`;

    exec(cmd, { maxBuffer: 100 * 1024 * 1024 }, async (error, stdout, stderr) => {
      if (error) {
        ultimoEstado = { estado: 'error', fecha: new Date().toISOString(), key, detalle: error.message };
        console.error('[BACKUP] Error ejecutando pg_dump:', error.message);
        return reject(error);
      }

      if (!stdout || stdout.length === 0) {
        const msg = '[BACKUP] pg_dump retorno vacio';
        ultimoEstado = { estado: 'error', fecha: new Date().toISOString(), key, detalle: msg };
        console.error(msg);
        return reject(new Error(msg));
      }

      try {
        const buffer = Buffer.from(stdout, 'utf-8');
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: 'application/sql',
          Metadata: { sha256 },
        }));

        const remoto = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        if (Number(remoto.ContentLength || 0) !== buffer.length || remoto.Metadata?.sha256 !== sha256) {
          throw new Error('La verificacion del respaldo remoto no coincide con el archivo generado');
        }

        console.log(`[BACKUP] OK — ${key} (${sizeMB} MB)`);
        ultimoEstado = { estado: 'verificado', fecha: new Date().toISOString(), key, sizeMB, sha256 };
        resolve({ key, sizeMB, sha256, verificado: true });
      } catch (uploadErr) {
        ultimoEstado = { estado: 'error', fecha: new Date().toISOString(), key, detalle: uploadErr.message };
        console.error('[BACKUP] Error subiendo a Wasabi:', uploadErr.message);
        reject(uploadErr);
      }
    });
  });
};

module.exports = { ejecutarBackup, getBackupStatus };
