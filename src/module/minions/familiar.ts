import { ActorSourcePF2e } from '@actor/data/index.js';
import { ActorPF2e } from '@actor/index.js';
import { PACKAGE_ID } from '../../constants.ts';
import { isFamiliarData, isFamiliarDocument } from '../utils.ts';
import { Log } from '~module/logger.ts';

Hooks.on('preUpdateActor', async (...args) => {
    const [document, changes] = args as [
        document: ActorPF2e,
        changes: DeepPartial<ActorSourcePF2e>,
        options: object,
        userId: string
    ];
    if (!(isFamiliarDocument(document) && isFamiliarData(document, changes))) return;
    Log.groupCollapsed('preUpdateActor', document.name, document.type);
    Log.info('~args~', args);

    if (!changes.system?.master?.id) {
        Log.info('No master change, skipping...');
        Log.groupEnd();
        return;
    }

    const updates = mergeObject(changes, { prototypeToken: { flags: { [PACKAGE_ID]: {} } } });
    const tokenFlags = updates.prototypeToken.flags[PACKAGE_ID] as Record<string, unknown>;
    Log.debug('tokenFlags', document.prototypeToken?.flags[PACKAGE_ID], tokenFlags);
    tokenFlags.type ??= 'familiar';

    const oldMaster = game.actors.get(document.system.master.id || '');
    if (oldMaster) {
        Log.groupCollapsed('Removing old master data');
        let minionsUuid = (oldMaster.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
        Log.debug(minionsUuid);
        Promise.all(
            document.getActiveTokens().flatMap(token => {
                Log.info('Cascading old master changes', token.document.uuid, token.document);
                minionsUuid = minionsUuid.filter(uuid => uuid != token.document.uuid);
                return oldMaster.setFlag(PACKAGE_ID, 'minions', minionsUuid);
            })
        );
        Log.groupEnd();
    }
    const newMaster = game.actors.get(changes.system.master.id);
    if (newMaster) {
        Log.groupCollapsed('Adding new master data');
        tokenFlags.master = newMaster.id;

        const minionsUuid = (newMaster.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
        Log.debug(minionsUuid);
        Promise.all(
            document.getActiveTokens().flatMap(token => {
                const promises = [];
                Log.info('Cascading new master changes', token.document.uuid, token.document);
                promises.push(token.document.setFlag(PACKAGE_ID, 'master', newMaster.id));
                if (!minionsUuid.find(uuid => uuid === token.document.uuid)) minionsUuid.push(token.document.uuid);
                promises.push(newMaster.setFlag(PACKAGE_ID, 'minions', minionsUuid));
                return promises;
            })
        );
        Log.groupEnd();
    }
    Log.groupEnd();
});
