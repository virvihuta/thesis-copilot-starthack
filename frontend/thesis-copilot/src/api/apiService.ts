// src/api/apiService.ts

// Change this to your live backend URL (e.g., ngrok) when you present!
const BASE_URL = "http://localhost:8000"; 

export const apiService = {
  saveProfile: async (fullName: string, skills: string, interests: string) => {
    const res = await fetch(`${BASE_URL}/save-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, skills, interests }),
    });
    return res.json();
  },

  findMatches: async (searchText: string) => {
    const res = await fetch(`${BASE_URL}/find-matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: searchText }),
    });
    if (!res.ok) throw new Error("Search failed");
    return res.json();
  },

  generatePitch: async (topicId: string) => {
    const res = await fetch(`${BASE_URL}/generate-pitch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId }),
    });
    if (!res.ok) throw new Error("Pitch failed");
    return res.json();
  }
};