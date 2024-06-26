import { Log } from '~module/logger.ts';
import { PACKAGE_ID } from '../constants.ts';

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

    if (!master) return Log.error('No master found');

    const uuids = (master.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
    Log.log('uuids', uuids);
    const actors = await Promise.all(uuids.map(async uuid => await fromUuid(uuid)));
    const minions = actors.filter(minion => minion).map(minion => minion?.uuid);
    await master.setFlag(PACKAGE_ID, 'minions', minions);
    Log.log('minions', minions);
};
globalThis.pf2eMinions.linkMinion = async type => {
    const master = canvas.tokens.controlled[0];
    const minion = Array.from(game.user.targets)[0];

    if (!master) return Log.error('no token selected');
    if (!minion) return Log.error('no token targeted');

    await Promise.all([
        minion.document.setFlag('pf2e-minions', 'master', master.id),
        minion.document.setFlag('pf2e-minions', 'type', type),
        minion.actor?.setFlag('pf2e-minions', 'master', master.id),
        minion.actor?.setFlag('pf2e-minions', 'type', type),
        (minion.actor?.prototypeToken as any).setFlag?.('pf2e-minions', 'master', master.id),
        (minion.actor?.prototypeToken as any).setFlag?.('pf2e-minions', 'type', type),
    ]);

    const minions = (master.actor?.getFlag('pf2e-minions', 'minions') as string[]) ?? [];
    if (!minions.find(uuid => uuid === minion.document.uuid))
        await master.actor?.setFlag('pf2e-minions', 'minions', [...minions, minion.document.uuid]);
};
