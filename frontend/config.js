// All settings your backend developer needs to know about live here.
export const CONFIG = {
  // Base URL of the backend. No trailing slash.
  API_BASE_URL: "http://localhost:8000",

  ENDPOINT: "/analyze",

  // How long to wait for the backend before showing an error.
  TIMEOUT_MS: 35000,

  // true = skip the network and return fake data, so you can build and test
  // the UI before the backend exists. Set to false once the backend is running.
  USE_MOCK: false,
};
