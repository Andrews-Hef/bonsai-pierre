// Aide « ? » : règles et contrôles du jeu. Même pattern de modale que StatsModal
// (clic sur le fond = fermer, stopPropagation sur le panneau).
export default function HelpModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-bark-700/40 dark:bg-bark-900/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-beige-50 dark:bg-bark-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="font-zen text-2xl text-bark-700 dark:text-beige-50">Comment jouer</h2>
          <button
            onClick={onClose}
            className="text-bark-500 dark:text-beige-200 hover:text-bark-700 dark:hover:text-beige-50 text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-bark-600 dark:text-beige-100">
          Chaque jour, une pierre à tailler pour révéler une forme cachée. Retire la
          matière en trop jusqu'à approcher la forme du jour.
        </p>

        <Section title="🪨 Tailler">
          <li>
            <b>Clique</b> sur la pierre pour retirer de la matière à cet endroit.
          </li>
          <li>
            Le <span className="text-bark-500">brun</span> est l'excédent à enlever, le{' '}
            <span className="text-sage-600 dark:text-sage-400">vert</span> est la forme à
            garder — elle se révèle en creusant.
          </li>
        </Section>

        <Section title="🔧 Ciseaux & vues">
          <li>
            <b>Fin / Moyen / Gros</b> : taille de la zone retirée à chaque coup.
          </li>
          <li>
            <b>Face / Profil / Dessus</b> : trois angles fixes pour attaquer toutes les
            faces (pas de rotation libre).
          </li>
          <li>
            <b>Recommencer</b> : remet la pierre à son état de départ.
          </li>
        </Section>

        <Section title="🏆 Score">
          <li>
            Le <b>%</b> affiché pendant la taille est une <b>estimation locale</b>,
            indicative.
          </li>
          <li>
            Le <b>score officiel</b> est calculé par le serveur quand tu valides :
            ressemblance à la cible + bonus de rapidité.
          </li>
          <li>
            <b>Un seul essai par jour.</b> Reviens demain pour une nouvelle pierre.
          </li>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70 mb-2">
        {title}
      </p>
      <ul className="list-disc pl-5 space-y-1 text-sm text-bark-600 dark:text-beige-100/90">
        {children}
      </ul>
    </div>
  );
}
