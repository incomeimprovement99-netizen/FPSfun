// three.js walks the whole scene every frame to bring every object's world
// matrix up to date, hidden ones included. In a SpeedKills match that was
// 6,741 of the scene's 9,892 objects (the range's props and figures, every
// figure's spare guns and outfits, hidden until wanted) and a third of the
// frame's CPU time (tools/profile-frame.ts: updateMatrixWorld and
// multiplyMatrices, 2.8 ms of 8.4).
//
// So a hidden object with children is skipped, children and all, and marks
// itself to catch up: the frame it is shown, it recomputes and forces its
// children to, before anything is drawn. A hidden leaf still updates itself,
// because a hit box is an invisible mesh and its matrix must stay true (the
// shots skip invisible meshes anyway, projectile.ts, but a hit box's owner
// can turn it on at any moment). Code that needs a hidden object's place
// asks for it with getWorldPosition or updateWorldMatrix, which walk up on
// their own and never come through here.
import * as THREE from "three";

const base = THREE.Object3D.prototype.updateMatrixWorld;
let installed = false;

export function skipHiddenSubtrees(): void {
  if (installed) return;
  installed = true;
  THREE.Object3D.prototype.updateMatrixWorld = function (this: THREE.Object3D, force?: boolean): void {
    if (!this.visible && this.children.length > 0 && this.parent !== null) {
      // a move of a parent while hidden is carried until it is shown
      if (force) this.matrixWorldNeedsUpdate = true;
      return;
    }
    base.call(this, force);
  };
}
