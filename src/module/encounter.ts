import { CombatantPF2e } from '@module/encounter/combatant.js';
import { MODULE_NAME } from 'src/constants.ts';
import { createMinionsMessage } from './chat.ts';

Hooks.on('pf2e.startTurn', async (...args) => {
    const combatant = args[0] as CombatantPF2e;
    if (!combatant.actor?.getFlag(MODULE_NAME, 'minions')) return;
    console.debug(`${MODULE_NAME} | pf2e.startTurn`, ...args);

    const minions = (combatant.actor.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
    if (minions.length > 0) createMinionsMessage(combatant, minions);
});
