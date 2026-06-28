// Codec voxel CÔTÉ NAVIGATEUR.
//
// Doit rester d'accord BIT POUR BIT avec shared/voxel.ts (la source de vérité,
// utilisée par /submit). shared/voxel.ts gzip via `node:zlib` (inutilisable au
// navigateur) ; on reproduit ici la MÊME convention avec les Web Streams natifs
// (CompressionStream / DecompressionStream), sans aucune dépendance.
//
// Format : base64( gzip( bits big-endian ) ), index = x*N*N + y*N + z, N=24,
// Y vertical. packbits big-endian = bit 7 (MSB) du 1er octet = 1er voxel
// (compatible numpy.packbits — cf. shared/voxel.ts).
//
// Le test d'accord (test/codec.agreement.test.js) prouve le round-trip dans les
// DEUX sens face à shared/voxel.ts : c'est lui qui garantit que ce que ce module
// envoie à /submit y sera décodé à l'identique.

export const GRID_SIZE = 24;
export const VOXEL_COUNT = GRID_SIZE * GRID_SIZE * GRID_SIZE; // 13824

export function gridIndex(x, y, z, n = GRID_SIZE) {
  return x * n * n + y * n + z;
}

// ---------- base64 <-> octets (natifs navigateur ; dispo aussi sous Node 22) ----------
function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000; // évite un dépassement de pile sur String.fromCharCode(...)
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- gzip via Web Streams ----------
async function gzip(bytes) {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}

async function gunzip(bytes) {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}

// ---------- packbits big-endian (convention EXACTE de shared/voxel.ts) ----------
function packBits(grid) {
  const len = grid.length;
  const packed = new Uint8Array((len + 7) >> 3);
  for (let i = 0; i < len; i++) {
    if (grid[i]) packed[i >> 3] |= 1 << (7 - (i & 7)); // bit 7 = premier voxel
  }
  return packed;
}

function unpackBits(packed, len) {
  const grid = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    grid[i] = (packed[i >> 3] >> (7 - (i & 7))) & 1;
  }
  return grid;
}

// ---------- API publique ----------
export async function encodeGridBrowser(grid, n = GRID_SIZE) {
  const len = n * n * n;
  if (grid.length !== len) throw new Error(`grid length ${grid.length} != ${len}`);
  const gz = await gzip(packBits(grid));
  return bytesToBase64(gz);
}

export async function decodeGridBrowser(b64, n = GRID_SIZE) {
  const len = n * n * n;
  const packed = await gunzip(base64ToBytes(b64));
  if (packed.length < (len + 7) >> 3) throw new Error("grille tronquée");
  return unpackBits(packed, len);
}
