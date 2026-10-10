// All settings your backend developer needs to know about live here.
export const CONFIG = {
  // Base URL of the backend. No trailing slash.
  // Local development example: "http://localhost:3000"
  API_BASE_URL: "http://localhost:3000",

  // Paths appended to API_BASE_URL (see API.md for the request/response format).
  ENDPOINTS: {
    define: "/api/define",
    explain: "/api/explain",
  },

  // Optional bearer token sent as "Authorization: Bearer <token>".
  // Anything in an extension is readable by users, so this is NOT a secret.
  // Leave empty if the backend doesn't need it.
  AUTH_TOKEN: "",

  // Send the surrounding paragraph and page URL/title with each request so the
  // backend can give better, context-aware explanations. Set to false for privacy.
  SEND_PAGE_CONTEXT: true,

  // How long to wait for the backend before showing an error.
  // Deeper explanations (especially AI-generated ones) can take a while.
  TIMEOUT_MS: 30000,

  // true = skip the network and return fake data, so you can build and test
  // the UI before the backend exists. Set to false once the backend is running.
  USE_MOCK: true,
};
