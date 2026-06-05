// Deterministic target-of-the-day selection.
// File extension is SVG — we render simple geometric silhouettes that the
// client converts to a solid black mask on a canvas (same pixel-matching
// pipeline as a PNG would give us).

export const TARGETS = [
  { id: 'heart',     name: '❤️ Coeur',        file: 'heart.svg' },
  { id: 'star',      name: '⭐ Étoile',        file: 'star.svg' },
  { id: 'cat',       name: '🐱 Chat',         file: 'cat.svg' },
  { id: 'dog',       name: '🐶 Chien',        file: 'dog.svg' },
  { id: 'rabbit',    name: '🐰 Lapin',        file: 'rabbit.svg' },
  { id: 'bird',      name: '🐦 Oiseau',       file: 'bird.svg' },
  { id: 'fish',      name: '🐟 Poisson',      file: 'fish.svg' },
  { id: 'butterfly', name: '🦋 Papillon',     file: 'butterfly.svg' },
  { id: 'elephant',  name: '🐘 Éléphant',     file: 'elephant.svg' },
  { id: 'bear',      name: '🐻 Ours',         file: 'bear.svg' },
  { id: 'turtle',    name: '🐢 Tortue',       file: 'turtle.svg' },
  { id: 'snail',     name: '🐌 Escargot',     file: 'snail.svg' },
  { id: 'house',     name: '🏠 Maison',       file: 'house.svg' },
  { id: 'car',       name: '🚗 Voiture',      file: 'car.svg' },
  { id: 'plane',     name: '✈️ Avion',         file: 'plane.svg' },
  { id: 'boat',      name: '⛵ Bateau',       file: 'boat.svg' },
  { id: 'key',       name: '🔑 Clé',          file: 'key.svg' },
  { id: 'cup',       name: '☕ Tasse',        file: 'cup.svg' },
  { id: 'umbrella',  name: '☂️ Parapluie',    file: 'umbrella.svg' },
  { id: 'anchor',    name: '⚓ Ancre',        file: 'anchor.svg' },
  { id: 'leaf',      name: '🍃 Feuille',      file: 'leaf.svg' },
  { id: 'mountain',  name: '⛰️ Montagne',     file: 'mountain.svg' },
  { id: 'sun',       name: '☀️ Soleil',       file: 'sun.svg' },
  { id: 'cloud',     name: '☁️ Nuage',        file: 'cloud.svg' },
  { id: 'tree',      name: '🌳 Arbre',        file: 'tree.svg' },
  { id: 'flower',    name: '🌸 Fleur',        file: 'flower.svg' },
  { id: 'mushroom',  name: '🍄 Champignon',   file: 'mushroom.svg' },
  { id: 'drop',      name: '💧 Goutte',       file: 'drop.svg' },
  { id: 'snowflake', name: '❄️ Flocon',       file: 'snowflake.svg' },
  { id: 'wave',      name: '🌊 Vague',        file: 'wave.svg' },
  { id: 'arrow',     name: '➡️ Flèche',       file: 'arrow.svg' },
  { id: 'bolt',      name: '⚡ Éclair',       file: 'bolt.svg' },
  { id: 'moon',      name: '🌙 Croissant',    file: 'moon.svg' },
  { id: 'diamond',   name: '💎 Diamant',      file: 'diamond.svg' },
  { id: 'circle',    name: '⚪ Cercle',       file: 'circle.svg' },
  { id: 'square',    name: '⬛ Carré',        file: 'square.svg' },
  { id: 'triangle',  name: '🔺 Triangle',     file: 'triangle.svg' },
  { id: 'cross',     name: '➕ Croix',        file: 'cross.svg' },
  { id: 'hourglass', name: '⌛ Sablier',      file: 'hourglass.svg' },
  { id: 'bell',      name: '🔔 Cloche',       file: 'bell.svg' },
  { id: 'crown',     name: '👑 Couronne',     file: 'crown.svg' },
  { id: 'pencil',    name: '✏️ Crayon',       file: 'pencil.svg' },
  { id: 'book',      name: '📕 Livre',        file: 'book.svg' },
  { id: 'gift',      name: '🎁 Cadeau',       file: 'gift.svg' },
  { id: 'cake',      name: '🍰 Gâteau',       file: 'cake.svg' },
  { id: 'apple',     name: '🍎 Pomme',        file: 'apple.svg' },
  { id: 'mug',       name: '🍵 Bol',          file: 'mug.svg' },
  { id: 'fan',       name: '🪭 Éventail',     file: 'fan.svg' },
  { id: 'lantern',   name: '🏮 Lanterne',     file: 'lantern.svg' },
  { id: 'koi',       name: '🎏 Koï',          file: 'koi.svg' },
];

export function getTargetForDate(dateString) {
  // dateString = "YYYY-MM-DD"
  const seed = parseInt(dateString.replace(/-/g, ''), 10);
  const index = seed % TARGETS.length;
  return TARGETS[index];
}
