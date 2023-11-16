import { MODULE_NAME } from 'src/constants.ts';

export const registerHooks = () => {
    console.debug(`${MODULE_NAME} | registerHooks`);
    import('./summons.ts');
    import('./familiar.ts');
};

declare global {
    var pf2eMinions: {
        cleanUuids?(masterUuid?: string): void;
    };
}
globalThis.pf2eMinions = {};
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
