import * as THREE from 'three';
import type { CharacterState } from '../types/character';
import { CharacterModel } from './CharacterModel';

/** The text over a squad member's head. */
export interface SquadTag {
  name: string;
  role: string;
  ready: boolean;
}

export interface SquadMate extends SquadTag {
  key: string;
  state: CharacterState;
}

/** The player (in the middle of the stage) and the squad mates standing around them. */
export interface StageSquad {
  player: SquadTag;
  mates: readonly SquadMate[];
}

/** Where mates stand around the player at the origin: a shallow arc, each turned a little towards the middle. */
const MATE_SPOTS = [
  { x: -0.8, z: -0.3, yaw: 0.18 },
  { x: 0.8, z: -0.3, yaw: -0.18 },
  { x: -1.55, z: -0.75, yaw: 0.3 },
  { x: 1.55, z: -0.75, yaw: -0.3 },
] as const;
/** Name tags float this far above the top of the head (m). */
const TAG_LIFT_M = 0.12;

/** CSS variables on the stage element that place tag `index` (0 = the player) on the screen. */
export const squadTagVars = (index: number) => ({ x: `--squad-tag-x-${index}`, y: `--squad-tag-y-${index}`, shown: `--squad-tag-shown-${index}` });

/** The squad mates' characters on the stage: created and removed as the squad changes, animated and tagged each frame. */
export class SquadLineup {
  private readonly models = new Map<string, CharacterModel>();
  private order: string[] = [];
  private readonly head = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene) {}

  set(mates: readonly SquadMate[]) {
    const placed = mates.slice(0, MATE_SPOTS.length);
    const keep = new Set(placed.map((mate) => mate.key));
    for (const [key, model] of this.models) {
      if (keep.has(key)) continue;
      model.dispose();
      this.models.delete(key);
    }
    placed.forEach((mate, index) => {
      let model = this.models.get(mate.key);
      if (!model) {
        model = new CharacterModel(mate.state);
        model.setWeaponsVisible(true);
        this.scene.add(model.group);
        this.models.set(mate.key, model);
      }
      const spot = MATE_SPOTS[index];
      model.group.position.set(spot.x, 0, spot.z);
      model.setYaw(spot.yaw);
    });
    this.order = placed.map((mate) => mate.key);
  }

  animate(dt: number) {
    for (const model of this.models.values()) model.animate(dt);
  }

  /** Projects each head (the player's first) onto the screen into CSS variables on `element`, for the name tags. */
  placeTags(camera: THREE.Camera, element: HTMLElement, player: CharacterModel) {
    const width = element.clientWidth;
    const height = element.clientHeight;
    const all = [player, ...this.order.map((key) => this.models.get(key))];
    all.forEach((model, index) => {
      const vars = squadTagVars(index);
      if (!model?.shown) {
        element.style.setProperty(vars.shown, '0');
        return;
      }
      this.head.copy(model.group.position);
      this.head.y += model.getAnchors().headY + TAG_LIFT_M;
      this.head.project(camera);
      element.style.setProperty(vars.shown, this.head.z < 1 ? '1' : '0');
      element.style.setProperty(vars.x, `${(((this.head.x + 1) / 2) * width).toFixed(1)}px`);
      element.style.setProperty(vars.y, `${(((1 - this.head.y) / 2) * height).toFixed(1)}px`);
    });
  }

  dispose() {
    for (const model of this.models.values()) model.dispose();
    this.models.clear();
    this.order = [];
  }
}
