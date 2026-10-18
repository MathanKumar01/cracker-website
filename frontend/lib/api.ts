/**
 * Helper to get the backend API base URL and format user-friendly errors.
 */

export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
  return url.replace(/\/+$/, "");
}

export function getApiErrorMessage(error: unknown, targetUrl?: string): string {
  const apiUrl = targetUrl || getApiUrl();

  if (error instanceof TypeError) {
    if (typeof window !== "undefined") {
      const isLiveSite =
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";

      const isLocalApi =
        apiUrl.includes("127.0.0.1") || apiUrl.includes("localhost");

      // Case 1: Site is deployed on Vercel/domain, but API is pointing to localhost
      if (isLiveSite && isLocalApi) {
        return `Backend connection error: This site is running live on ${window.location.hostname}, but NEXT_PUBLIC_API_URL is still pointing to ${apiUrl}. Please set NEXT_PUBLIC_API_URL to your deployed backend URL (e.g. https://your-backend.onrender.com/api) in your Vercel Dashboard and redeploy.`;
      }

      // Case 2: Frontend is on HTTPS, but backend URL is HTTP
      if (window.location.protocol === "https:" && apiUrl.startsWith("http://")) {
        return `Security block: The website is loaded over HTTPS, but your backend API is using insecure HTTP (${apiUrl}). Browsers block this mixed content. Please update NEXT_PUBLIC_API_URL to use HTTPS (e.g. https://...).`;
      }
    }

    return `Could not connect to Django API backend (${apiUrl}). Please ensure the backend is running, awake, and configured with CORS.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while communicating with the server.";
}
