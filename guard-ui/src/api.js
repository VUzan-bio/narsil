/**
 * GUARD Platform API client.
 *
 * All functions return { data, error } for consistent error handling.
 * The frontend falls back to mock data if the API is unreachable.
 */

async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const body = await res.text();
      return { data: null, error: `${res.status}: ${body}` };
    }
    if (res.status === 204) return { data: null, error: null };
    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// Health
export async function healthCheck() {
  return request("/api/health");
}

// Pipeline
export async function submitRun(name, mode, mutations) {
  return request("/api/pipeline/run", {
    method: "POST",
    body: JSON.stringify({ name, mode, mutations }),
  });
}

export async function listJobs() {
  return request("/api/pipeline/jobs");
}

export async function getJob(jobId) {
  return request(`/api/pipeline/jobs/${jobId}`);
}

// Results
export async function getResults(jobId) {
  return request(`/api/results/${jobId}`);
}

export async function exportResults(jobId, format = "json") {
  try {
    const res = await fetch(`/api/results/${jobId}/export?format=${format}`);
    if (!res.ok) return { data: null, error: `${res.status}` };
    const blob = await res.blob();
    return { data: blob, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// Figures — returns URL string, not a fetch
export function getFigureUrl(jobId, type) {
  return `/api/figures/${jobId}/${type}`;
}

// Panels
export async function listPanels() {
  return request("/api/panels");
}

export async function createPanel(name, description, mutations) {
  return request("/api/panels", {
    method: "POST",
    body: JSON.stringify({ name, description, mutations }),
  });
}

export async function deletePanel(panelId) {
  return request(`/api/panels/${panelId}`, { method: "DELETE" });
}

// Scoring
export async function listScoringModels() {
  return request("/api/scoring/models");
}

// WebSocket for live progress
export function connectJobWS(jobId, onMessage, onClose) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/jobs/${jobId}`);
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  ws.onclose = onClose || (() => {});
  ws.onerror = () => ws.close();
  return ws;
}
