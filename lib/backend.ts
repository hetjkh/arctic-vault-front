// Central place for the backend base URL used by client-side API calls.
// In production on Render, set NEXT_PUBLIC_BACKEND_URL to your Render backend URL.
export const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_BACKEND_URL as string | undefined) ||
  'https://arctic-vault-back.onrender.com';

export const BACKEND_URL = `${BACKEND_BASE}`.replace(/\/+$/, '');

