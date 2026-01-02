const SPA_FALLBACK_PATH = '/index.html';

interface Env {
  ASSETS: AssetsFetcher;
}

interface AssetsFetcher {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(request);

    if (shouldServeSpaFallback(request, url, assetResponse.status)) {
      const fallbackUrl = new URL(SPA_FALLBACK_PATH, url.origin);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return env.ASSETS.fetch(fallbackRequest);
    }

    return assetResponse;
  },
};

function shouldServeSpaFallback(request: Request, url: URL, status: number): boolean {
  if (request.method !== 'GET') {
    return false;
  }

  if (status !== 404) {
    return false;
  }

  if (url.pathname.includes('.')) {
    return false;
  }

  const acceptHeader = request.headers.get('Accept');
  return acceptHeader?.includes('text/html');
}

export default worker;
