import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const buf = readFileSync("public/models/mannequin/mannequin.glb");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
new GLTFLoader().parse(ab, "", (g) => {
  const s = g.scene;
  s.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(s);
  console.log("box", box.min.toArray().map((v) => v.toFixed(2)), box.max.toArray().map((v) => v.toFixed(2)));
  s.traverse((o) => {
    if (["root", "pelvis", "spine_01", "spine_03", "Head", "hand_r", "hand_l", "upperarm_r", "thigh_l", "foot_l"].includes(o.name) || (o as THREE.SkinnedMesh).isSkinnedMesh) {
      const p = new THREE.Vector3(); o.getWorldPosition(p);
      const q = new THREE.Quaternion(); o.getWorldQuaternion(q);
      const e = new THREE.Euler().setFromQuaternion(q);
      console.log(o.type, o.name, "pos", p.toArray().map((v) => v.toFixed(3)).join(","), "rot", [e.x, e.y, e.z].map((v) => ((v * 180) / Math.PI).toFixed(0)).join(","), (o as THREE.Mesh).material ? ((o as THREE.Mesh).material as THREE.Material[]).length ?? 1 : "");
    }
  });
  console.log("clips", g.animations.map((a) => `${a.name}:${a.duration.toFixed(2)}`).join(" "));
  const tracks = g.animations[0].tracks.map((t) => t.name);
  console.log("tracks sample", tracks.slice(0, 8).join(" | "), tracks.length);
  console.log("materials", (s.children.flatMap((c) => { const out: string[] = []; c.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]; if (m) for (const x of Array.isArray(m) ? m : [m]) out.push(`${x.name}:${x.color?.getHexString()}`); }); return out; })).join(" "));
}, (e) => console.log("err", e));
