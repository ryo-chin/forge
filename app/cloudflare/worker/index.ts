const SPA_FALLBACK_PATH = '/';

interface Env {
  ASSETS: AssetsFetcher;
}

interface AssetsFetcher {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (shouldServeSpaDocument(request, url)) {
      return serveSpaFallback(request, env, url);
    }

    const assetResponse = await env.ASSETS.fetch(request);

    if (shouldServeSpaFallback(request, url, assetResponse.status)) {
      return serveSpaFallback(request, env, url);
    }

    return assetResponse;
  },
};

function serveSpaFallback(request: Request, env: Env, url: URL): Promise<Response> {
  const fallbackUrl = new URL(SPA_FALLBACK_PATH, url.origin);
  const fallbackRequest = new Request(fallbackUrl.toString(), request);
  return env.ASSETS.fetch(fallbackRequest);
}

function shouldServeSpaFallback(request: Request, url: URL, status: number): boolean {
  if (status !== 404) {
    return false;
  }

  return shouldServeSpaDocument(request, url);
}

function shouldServeSpaDocument(request: Request, url: URL): boolean {
  if (request.method !== 'GET') {
    return false;
  }

  if (url.pathname.includes('.')) {
    return false;
  }

  const acceptHeader = request.headers.get('Accept');
  return acceptHeader?.includes('text/html') ?? false;
}

export default worker;
