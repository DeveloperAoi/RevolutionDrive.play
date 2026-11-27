// REVOLUTION DRIVE — external 3D car packs (.glb)
// Register a pack here, then point a car at it in js/data/cars.js:
//   model: { pack: 'mypack', node: 'NodeNameOfTheCar' }   (optional: rotY, scale)
// Cars fall back to the built-in procedural model while a pack is loading or if it fails.
// Only use packs whose licence allows redistribution in a public web game, and do not use
// models of real, recognisable production cars (manufacturer design/trademark rights).
import { loadPack } from '../world/glbCar.js';

export const PACKS = [
  { id: 'lowpoly', url: 'assets/cars/lowpoly_car_pack.glb', credit: '"Ultimate Low-Poly Car Pack" by ProbablyNotG (https://sketchfab.com/mr_c0neDude) — CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)' },
  { id: 'kaze', url: 'assets/cars/kaze_rs.glb', credit: 'KAZE RS model: based on "Toyota Corolla AE86 Trueno" by Lexyc16 (https://sketchfab.com/Lexyc16) — CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified: maker lettering, number plate and door decal removed.' },
];

export function preloadPacks() {
  return Promise.allSettled(PACKS.map(p => loadPack(p.id, p.url)));
}
