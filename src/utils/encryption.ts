import CryptoJS from 'crypto-js';

const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || '';

export function decryptApiKey(encryptedApiKey: string): string {
  return CryptoJS.AES.decrypt(encryptedApiKey, ENCRYPTION_SALT).toString(CryptoJS.enc.Utf8);
}

export function encryptApiKey(apiKey: string): string {
  return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_SALT).toString();
}