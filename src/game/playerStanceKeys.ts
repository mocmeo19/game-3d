import type { CombatStance } from './combat/combatStateMachine';
import type { ControlAction } from './controlLayouts';

/** The player's stance from the controls: crouch and prone toggle, a held crouch lasts only until its key is let go. */
export class PlayerStanceKeys {
  value: CombatStance = 'stand';
  private crouchHeld = false;

  key(action: ControlAction, down: boolean) {
    if (action === 'crouchHold') this.holdCrouch(down);
    else if (down && action === 'crouchToggle') this.toggle('crouch');
    else if (down && action === 'prone') this.toggle('prone');
  }

  stand() {
    this.value = 'stand';
    this.crouchHeld = false;
  }

  private toggle(stance: CombatStance) {
    this.crouchHeld = false;
    this.value = this.value === stance ? 'stand' : stance;
  }

  private holdCrouch(down: boolean) {
    if (down) {
      if (this.value !== 'stand') return;
      this.value = 'crouch';
      this.crouchHeld = true;
      return;
    }
    if (this.crouchHeld && this.value === 'crouch') this.value = 'stand';
    this.crouchHeld = false;
  }
}
