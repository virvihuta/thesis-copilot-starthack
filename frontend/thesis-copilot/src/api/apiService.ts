// src/api/apiService.ts

// ─── CONFIG ────────────────────────────────────────────────────────────────
// When demoing live, replace this with your ngrok URL or local network IP.
// e.g. "https://abc123.ngrok.io"  or  "http://192.168.1.42:8000"
const BASE_URL = "http://localhost:8000";

// ─── TYPES ─────────────────────────────────────────────────────────────────
// This is what the Python backend actually sends back from /find-matches
interface RawMatch {
  id: string;
  title: string;
  company: string;
  expert: string;
  snippet: string;
  score?: number;  // real similarity % from Chroma, 0–100
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

// Converts a raw backend match into the shape the frontend components expect.
// This is the GLUE layer. The backend sends 5 fields, the frontend needs 9.
// We fill the missing ones with sensible defaults here.
function transformMatch(raw: RawMatch, index: number) {
  // Extract tags from the snippet text — grab any capitalized words as rough tags
  const words = raw.snippet?.split(" ") ?? [];
  const tags = words
    .filter((w) => w.length > 4 && w[0] === w[0].toUpperCase() && isNaN(Number(w[0])))
    .slice(0, 3)
    .map((w) => w.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);

  // If we couldn't extract tags from text, use generic defaults
  const finalTags = tags.length >= 2 ? tags : ["Research", "Industry", "Innovation"];

  return {
    id: raw.id ?? String(index),
    title: raw.title ?? "Untitled Project",
    company: raw.company ?? "Industry Partner",

    // The avatar letter shown in the purple circle on each card
    companyInitial: (raw.company ?? "C")[0].toUpperCase(),

    // Score — real similarity % from Chroma if available, fallback to descending fake
    score: raw.score ?? (94 - index * 5),

    tags: finalTags,

    // matchReason is shown as the small purple line under the company name.
    // We use the first 80 chars of the snippet as a teaser.
    matchReason: raw.snippet
      ? raw.snippet.slice(0, 75) + (raw.snippet.length > 75 ? "…" : "")
      : "Strong semantic match based on your profile.",

    // Full text shown in the expanded drawer
    summary: raw.snippet ?? "No description available.",

    // Contact info — backend returns expert name, we format it nicely
    contact: raw.expert ?? "Hiring Manager",
  };
}

// ─── API SERVICE ───────────────────────────────────────────────────────────
export const apiService = {

  // ── Save a student's profile to the backend session ──────────────────────
  // Called before searching so the pitch generator knows who the student is.
  saveProfile: async (fullName: string, skills: string, interests: string) => {
    const res = await fetch(`${BASE_URL}/save-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, skills, interests }),
    });
    if (!res.ok) throw new Error("Failed to save profile");
    return res.json();
  },

  // ── Search for matching thesis topics ────────────────────────────────────
  // Sends the student's text (from MemoryDump or CV) to the Python AI engine.
  // Transforms the raw results into the shape MatchCard + ActionDrawer expect.
  findMatches: async (searchText: string) => {
    const res = await fetch(`${BASE_URL}/find-matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: searchText }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Search failed (${res.status}): ${errorBody}`);
    }

    const rawResults: RawMatch[] = await res.json();

    // CRITICAL: transform each raw match into the full Match shape
    return rawResults.map(transformMatch);
  },

  // ── Upload a CV PDF and get matches back ─────────────────────────────────
  // Sends the actual PDF file to the backend, which extracts text and searches.
  uploadCV: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}/upload-cv`, {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type header — browser sets it automatically with boundary
    });

    if (!res.ok) {
      throw new Error(`CV upload failed (${res.status})`);
    }

    // Backend now returns { matches: [...], keywords: [...] }
    const data = await res.json();
    return {
      matches: (data.matches as RawMatch[]).map(transformMatch),
      keywords: (data.keywords as string[]) ?? [],
    };
  },

  // ── Find the best supervisor for a selected topic ────────────────────────
  findSupervisor: async (topicTitle: string, topicDescription: string, excludeName: string = "") => {
    const res = await fetch(`${BASE_URL}/find-supervisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic_title: topicTitle,
        topic_description: topicDescription,
        exclude_name: excludeName,
      }),
    });
    if (!res.ok) throw new Error(`Supervisor search failed (${res.status})`);
    return res.json();
  },

  // ── Generate a cold email to a supervisor asking for thesis supervision ──
  generateSupervisorPitch: async (
    supervisorName: string,
    supervisorEmail: string,
    supervisorInterests: string,
    topicTitle: string
  ) => {
    const res = await fetch(`${BASE_URL}/generate-supervisor-pitch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supervisor_name: supervisorName,
        supervisor_email: supervisorEmail,
        supervisor_interests: supervisorInterests,
        topic_title: topicTitle,
      }),
    });
    if (!res.ok) throw new Error(`Supervisor pitch failed (${res.status})`);
    return res.json(); // returns { pitch: "..." }
  },

  // ── Generate a cold-email pitch for a selected topic ─────────────────────
  // Sends the topic ID to the backend, which fetches the topic details
  // and uses the saved student profile to write a personalized email.
  generatePitch: async (topicId: string) => {
    const res = await fetch(`${BASE_URL}/generate-pitch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Pitch generation failed (${res.status}): ${errorBody}`);
    }

    return res.json(); // returns { pitch: "..." }
  },
};
