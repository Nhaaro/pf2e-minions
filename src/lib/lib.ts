import { MODULE_NAME } from '../constants.ts';

declare global {
    interface Module {
        cleanUuids(masterUuid?: string): void;
        linkMinion(type: string): void;
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
globalThis.pf2eMinions.linkMinion = async type => {
    const master = canvas.tokens.controlled[0];
    const minion = Array.from(game.user.targets)[0];

    if (!master) {
        console.error('no token selected');
        return;
    }
    if (!minion) {
        console.error('no token targeted');
        return;
    }

    minion.document.setFlag('pf2e-minions', 'master', master.id);
    minion.document.setFlag('pf2e-minions', 'type', type);
    minion.actor?.setFlag('pf2e-minions', 'master', master.id);
    minion.actor?.setFlag('pf2e-minions', 'type', type);
    (minion.actor?.prototypeToken as any).setFlag?.('pf2e-minions', 'master', master.id);
    (minion.actor?.prototypeToken as any).setFlag?.('pf2e-minions', 'type', type);

    var minions = (master.actor?.getFlag('pf2e-minions', 'minions') as string[]) ?? [];
    if (!minions.find(uuid => uuid === minion.document.uuid))
        master.actor?.setFlag('pf2e-minions', 'minions', [...minions, minion.document.uuid]);
};
