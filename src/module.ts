import '../utils/vite/hmr.ts';
import './styles/module.css';

import { MODULE_NAME } from 'src/constants.ts';
import { registerTemplates } from './scripts/register-templates.ts';
import { registerHooks } from './module/index.ts';

declare global {
    interface Module {
        cleanUuids?(masterUuid?: string): void;
    }
    var pf2eMinions: Module;
}
globalThis.pf2eMinions = globalThis.pf2eMinions ?? {};
globalThis.pf2eMinions.cleanUuids = async masterUuid => {
    let master;
    if (masterUuid) master = game.actors.get(masterUuid);
    else master = canvas.tokens.controlled.find(token => token.actor?.type === 'character')?.actor;

    if (!master) {
        console.error(`${MODULE_NAME} | No master found`);
        return;
    }

    const uuids = (master.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
    let actors = await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    const minions = actors.filter(minion => minion).map(minion => minion?.uuid);
    master.setFlag(MODULE_NAME, 'minions', minions);
};

Hooks.once('init', async function () {
    // Register stuff with the Foundry client
    registerTemplates();
    registerHooks();
});

Hooks.once('ready', async function () {
    console.log(`${MODULE_NAME} | Ready`);
});
