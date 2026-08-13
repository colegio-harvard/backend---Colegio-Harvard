const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const s3 = require('../config/wasabi');

const BUCKET = process.env.WASABI_BUCKET || 'colegio-fernando-storage';

/**
 * Sube un archivo a Wasabi y retorna la URL publica.
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} key - Ruta dentro del bucket (ej: "fotos/alumno-123.jpg")
 * @param {string} contentType - MIME type (ej: "image/jpeg")
 * @returns {Promise<string>} URL publica del archivo subido
 */
const uploadFile = async (buffer, key, contentType) => {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  }));
  return getPublicUrl(key);
};

/**
 * Elimina un archivo de Wasabi.
 * @param {string} key - Ruta dentro del bucket
 */
const deleteFile = async (key) => {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
};

const getFile = async (key) => {
  return s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
};

const listFiles = async (prefix) => {
  const objetos = [];
  let continuationToken;
  do {
    const pagina = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    objetos.push(...(pagina.Contents || []));
    continuationToken = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (continuationToken);
  return objetos;
};

/**
 * Construye la URL publica de un objeto en Wasabi.
 * @param {string} key - Ruta dentro del bucket
 * @returns {string} URL publica
 */
const getPublicUrl = (key) => {
  const endpoint = process.env.WASABI_ENDPOINT || 'https://s3.us-east-1.wasabisys.com';
  return `${endpoint}/${BUCKET}/${key}`;
};

module.exports = { uploadFile, deleteFile, getFile, listFiles, getPublicUrl };
