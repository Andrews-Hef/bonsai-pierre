import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError, fetchGridText } from '../src/api/client.js';

// Réponse fetch minimale simulée.
function mockRes({ ok = true, status = 200, body = '', json } = {}) {
  const text = json !== undefined ? JSON.stringify(json) : body;
  return { ok, status, text: async () => text };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it("injecte l'en-tête x-user-id et parse le JSON sur 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes({ json: { hello: 'world' } }));
    vi.stubGlobal('fetch', fetchMock);

    const data = await apiFetch('/v1/daily');

    expect(data).toEqual({ hello: 'world' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/daily');
    expect(init.headers['x-user-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('sérialise le body en JSON et pose le content-type sur un POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes({ json: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/v1/daily/submit', { method: 'POST', body: { final_grid: 'abc' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ final_grid: 'abc' });
  });

  it('mappe une réponse non-2xx en ApiError (status + code + message)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockRes({ ok: false, status: 422, json: { error: 'invalid_grid', message: 'grille malformée' } }),
      ),
    );

    const err = await apiFetch('/v1/daily/submit', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('invalid_grid');
    expect(err.message).toBe('grille malformée');
  });

  it('enveloppe un échec réseau en ApiError status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const err = await apiFetch('/v1/daily').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe('network_error');
  });

  it('propage AbortError sans le transformer', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    const err = await apiFetch('/v1/daily').catch((e) => e);
    expect(err.name).toBe('AbortError');
    expect(err).not.toBeInstanceOf(ApiError);
  });
});

describe('fetchGridText', () => {
  it('renvoie le texte base64 trimé', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes({ body: '  H4sIabc==\n' })));
    const txt = await fetchGridText('/v1/grids/2026-06-28/start.b64');
    expect(txt).toBe('H4sIabc==');
  });

  it('lève ApiError grid_fetch_failed sur 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes({ ok: false, status: 404 })));
    const err = await fetchGridText('/v1/grids/missing').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('grid_fetch_failed');
  });
});
