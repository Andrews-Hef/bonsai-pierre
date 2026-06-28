// Header strip showing the shape to sculpt today.
export default function TargetOverlay({ targetName }) {
  if (!targetName) return null;
  return (
    <div className="text-center">
      <p className="text-sm uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70">
        Pierre du jour
      </p>
      <h1 className="font-zen text-2xl md:text-3xl text-bark-700 dark:text-beige-50 mt-1">
        Sculptez cette pierre en forme de{' '}
        <span className="text-sage-600 dark:text-sage-400 font-semibold">{targetName}</span>
      </h1>
    </div>
  );
}
