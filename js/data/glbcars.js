// REVOLUTION DRIVE — external 3D car packs (.glb)
// Register a pack here, then point a car at it in js/data/cars.js:
//   model: { pack: 'mypack', node: 'NodeNameOfTheCar' }   (optional: rotY, scale)
// Cars fall back to the built-in procedural model while a pack is loading or if it fails.
// Only use packs whose licence allows redistribution in a public web game, and do not use
// models of real, recognisable production cars (manufacturer design/trademark rights).
import { loadPack } from '../world/glbCar.js';

export const PACKS = [
  // { id: 'example', url: 'assets/cars/example_pack.glb', credit: 'Model: AUTHOR (CC-BY 4.0) https://...' },
];

export function preloadPacks() {
  return Promise.allSettled(PACKS.map(p => loadPack(p.id, p.url)));
}
