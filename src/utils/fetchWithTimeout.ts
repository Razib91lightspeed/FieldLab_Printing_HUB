export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
) {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}