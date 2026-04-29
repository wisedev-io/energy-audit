const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://157.180.28.98:5050';

export const api = {
  // List all cases
  getCases: async () => {
    const res = await fetch(`${BASE_URL}/cases`);
    return res.json();
  },

  // Get form data for a case
  getCaseForm: async (caseName: string) => {
    const res = await fetch(`${BASE_URL}/cases/${caseName}/form`);
    return res.json();
  },

  // Delete a case
  deleteCase: async (caseName: string, passcode: string) => {
    const res = await fetch(`${BASE_URL}/cases/${caseName}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    return res.json();
  },

  // Submit new audit
  generate: async (formData: FormData) => {
    const res = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  // Health check
  health: async () => {
    const res = await fetch(`${BASE_URL}/healthz`);
    return res.json();
  },

  // File download URL
  fileUrl: (caseName: string, filename: string) =>
    `${BASE_URL}/cases/${caseName}/${filename}`,
};
