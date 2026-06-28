// Parser MagicaVoxel .vox (format RIFF par chunks).
// On lit le premier modèle : chunk SIZE (dims) + chunk XYZI (voxels).
// MagicaVoxel est Z-up -> à canonicaliser avec perm [0,2,1] pour passer en Y-up.
//
// Sortie : grille indexée x*dy*dz + y*dz + z (layout attendu par canonicalize)
// + dims {dx,dy,dz}. La palette/couleurs est ignorée (présence = matière).

export interface VoxModel {
  grid: Uint8Array; // dx*dy*dz, 1 = voxel présent
  dims: { dx: number; dy: number; dz: number };
}

export function parseVox(buf: Buffer): VoxModel {
  if (buf.length < 8 || buf.toString("ascii", 0, 4) !== "VOX ") {
    throw new Error("fichier .vox invalide (entête 'VOX ' manquante)");
  }

  let dims: { dx: number; dy: number; dz: number } | null = null;
  let voxels: { x: number; y: number; z: number }[] | null = null;

  // Parcours linéaire des chunks à partir de l'offset 8 (après VOX + version).
  // Chunk = id[4] + contentBytes[4] + childrenBytes[4] + content + children.
  let off = 8;
  while (off + 12 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const contentBytes = buf.readUInt32LE(off + 4);
    const childrenBytes = buf.readUInt32LE(off + 8);
    const content = off + 12;

    if (id === "SIZE" && !dims) {
      dims = {
        dx: buf.readUInt32LE(content),
        dy: buf.readUInt32LE(content + 4),
        dz: buf.readUInt32LE(content + 8),
      };
    } else if (id === "XYZI" && !voxels) {
      const num = buf.readUInt32LE(content);
      const list: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i < num; i++) {
        const p = content + 4 + i * 4;
        list.push({ x: buf.readUInt8(p), y: buf.readUInt8(p + 1), z: buf.readUInt8(p + 2) });
      }
      voxels = list;
    }

    // MAIN n'a que des enfants : on descend dedans ; sinon on saute le chunk entier.
    off = id === "MAIN" ? content : content + contentBytes + childrenBytes;
  }

  if (!dims) throw new Error("chunk SIZE absent du .vox");
  if (!voxels) throw new Error("chunk XYZI absent du .vox");

  const { dx, dy, dz } = dims;
  const grid = new Uint8Array(dx * dy * dz);
  for (const v of voxels) {
    if (v.x < dx && v.y < dy && v.z < dz) grid[v.x * dy * dz + v.y * dz + v.z] = 1;
  }
  return { grid, dims };
}
