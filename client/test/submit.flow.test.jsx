// @vitest-environment jsdom
//
// TEST CLÉ (exigence métier) : le score affiché après soumission vient de la
// RÉPONSE SERVEUR, jamais de l'estimation locale calculée pendant la taille.
// On fait renvoyer au serveur un score impossible à déduire localement et on
// vérifie qu'il s'affiche tel quel à l'écran.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GRID_SIZE, gridIndex } from '../src/voxel/grid.js';

// Pas de WebGL en jsdom -> on neutralise la scène R3F.
vi.mock('../src/three/SculptScene.jsx', () => ({ default: () => null }));

// L'encodage navigateur (Web Streams) n'est pas le sujet ici.
vi.mock('../src/voxel/codec.js', async (importActual) => ({
  ...(await importActual()),
  encodeGridBrowser: vi.fn().mockResolvedValue('FAKE_ENCODED_GRID'),
}));

// Réponse serveur : score 873 (avec bonus), ressemblance 0,90.
const SERVER_RESPONSE = {
  resemblance: 0.9,
  duration_ms: 42000,
  score: 873,
  rank: 3,
  percentile: 80,
  top: [{ rank: 1, display_name: 'Ana', score: 950, duration_ms: 30000 }],
};
const postSubmit = vi.fn().mockResolvedValue(SERVER_RESPONSE);
vi.mock('../src/api/daily.js', () => ({
  postSubmit: (...a) => postSubmit(...a),
  getLeaderboard: vi.fn(),
}));

import Sculptor from '../src/components/Sculptor.jsx';

function makeDay() {
  const n = GRID_SIZE;
  const startGrid = new Uint8Array(n * n * n).fill(1); // bloc plein
  const targetGrid = new Uint8Array(n * n * n);
  targetGrid[gridIndex(0, 0, 0, n)] = 1; // cible minuscule -> estimation locale ~0 %
  return {
    puzzle: { puzzleOn: '2026-06-28', gridSize: n, shapeName: 'Coeur' },
    startGrid,
    targetGrid,
    sessionToken: 'jwt.session.token',
    startedAt: '2026-06-28T10:00:00.000Z',
  };
}

afterEach(() => {
  cleanup();
  postSubmit.mockClear();
});

describe('soumission -> écran de résultat', () => {
  it('affiche le SCORE SERVEUR (873), pas l’estimation locale (~0 %)', async () => {
    const day = makeDay();
    render(<Sculptor day={day} />);

    // Estimation locale affichée avant soumission : bloc plein vs cible 1 voxel -> 0 %.
    expect(screen.getByText(/ressemblance estimée \(locale\)/i)).toBeTruthy();

    // Valider -> confirmer (un seul essai).
    fireEvent.click(screen.getByText('Valider'));
    fireEvent.click(screen.getByText(/Confirmer/i));

    // Le serveur a été appelé avec la grille encodée + le token de session.
    await waitFor(() => expect(postSubmit).toHaveBeenCalledTimes(1));
    expect(postSubmit.mock.calls[0][0]).toEqual({
      session_token: 'jwt.session.token',
      final_grid: 'FAKE_ENCODED_GRID',
    });

    // L'écran de résultat montre le score SERVEUR.
    const score = await screen.findByText('873');
    expect(score).toBeTruthy();
    expect(screen.getByText(/Score officiel/i)).toBeTruthy();

    // La ressemblance officielle (90 %) vient du serveur, distincte de l'estimation
    // locale (~0 %) qui n'apparaît qu'en comparaison étiquetée.
    expect(screen.getByText(/ressemblance officielle \(serveur\) : 90 %/i)).toBeTruthy();
    // 873 n'est jamais dérivable de l'estimation locale (qui est un % ~0).
    expect(screen.queryByText(/Score officiel/i)).toBeTruthy();
  });
});
