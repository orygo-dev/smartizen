import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// Resolve a stored media reference (e.g. "/api/uploads/<id>") to an absolute URL
export function mediaUrl(u) {
  if (!u) return u;
  if (/^(https?:|data:|blob:)/.test(u) || u.startsWith("/music/")) return u;
  return `${BACKEND_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

// Upload a File/Blob to the backend, returns { id, url, content_type, filename, size }
export async function uploadFile(file, filename) {
  const form = new FormData();
  form.append("file", file, filename || file.name || "upload");
  const { data } = await api.post("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sz_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Terjadi kesalahan. Silakan coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function setToken(token) {
  if (token) localStorage.setItem("sz_token", token);
  else localStorage.removeItem("sz_token");
}
