import { useEffect, useRef, useState } from 'react';
import { getDaily } from '../api/daily.js';
import { fetchGridText } from '../api/client.js';
import { decodeGridBrowser } from '../voxel/codec.js';

// Charge le puzzle du jour et prépare l'état de jeu.
//
// INVARIANT TEMPS (anti-triche) : /daily émet le `session_token` et le
// `started_at` mesuré SERVEUR. On l'appelle EXACTEMENT une fois et on garde le
// token dans un état stable jusqu'au /submit. Un re-fetch /daily ré-émettrait un
// nouveau `started_at` -> durée serveur faussée. Le garde `startedRef` assure
// l'appel unique, y compris sous React.StrictMode (double-montage en dev), et on
// n'abandonne PAS la requête au démontage pour ne pas la relancer.
//
// DEUX grilles aux rôles distincts :
//   - startGrid  = grille-VÉRITÉ à tailler (source d'état, base du /submit)
//   - targetGrid = FANTÔME (onion-skin) + estimation locale UNIQUEMENT,
//                  jamais renvoyée au serveur, jamais source de score.
//
// status : 'loading' | 'ready' | 'already_played' | 'error'.
export function useDaily() {
  const [state, setState] = useState({ status: 'loading' });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const daily = await getDaily();

        const [startB64, targetB64] = await Promise.all([
          fetchGridText(daily.start_grid_url),
          fetchGridText(daily.target_grid_url),
        ]);
        const [startGrid, targetGrid] = await Promise.all([
          decodeGridBrowser(startB64, daily.grid_size),
          decodeGridBrowser(targetB64, daily.grid_size),
        ]);

        setState({
          status: daily.already_played ? 'already_played' : 'ready',
          puzzle: {
            puzzleOn: daily.puzzle_on,
            gridSize: daily.grid_size,
            shapeName: daily.shape_name,
          },
          sessionToken: daily.session.token,
          startedAt: daily.session.started_at,
          startGrid,
          targetGrid,
        });
      } catch (err) {
        setState({ status: 'error', error: err });
      }
    })();
  }, []);

  return state;
}
