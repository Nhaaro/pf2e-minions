import { ActorSourcePF2e } from '@actor/data/index.js';
import { ActorPF2e } from '@actor/index.js';
import { PACKAGE_ID } from '~constants';
import { Log } from '~module/logger.ts';
import * as PF2eToolbelt from '../../../types/modules/pf2e-toolbelt.ts';
import { isCharacterData } from '../utils.ts';

Hooks.on('preUpdateActor', async (...args) => {
    const [document, changes] = args as [
        document: ActorPF2e,
        changes: DeepPartial<ActorSourcePF2e>,
        options: object,
        userId: string
    ];
    if (!(document.isOfType('character') && isCharacterData(document, changes) && document.class?.name === 'Eidolon'))
        return;
    Log.group('preUpdateActor', document.name, document.ancestry?.name);
    Log.info('~args~', args);

    if (!PF2eToolbelt.getShareConfig(changes)?.master) {
        Log.info('No master change, skipping...');
        Log.groupEnd();
        return;
    }

    const updates = mergeObject(changes, { prototypeToken: { flags: { [PACKAGE_ID]: {} } } });
    const tokenFlags = updates.prototypeToken.flags[PACKAGE_ID] as Record<string, unknown>;
    Log.debug('tokenFlags', document.prototypeToken?.flags[PACKAGE_ID], tokenFlags);
    tokenFlags.type ??= 'eidolon';

    const oldMaster = game.actors.get(PF2eToolbelt.getShareConfig(document)?.master || '');
    if (oldMaster) {
        Log.groupCollapsed('Removing old master data', `(${oldMaster.name})`);
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
    const newMaster = game.actors.get(PF2eToolbelt.getShareConfig(changes)?.master || '');
    if (newMaster) {
        Log.groupCollapsed('Adding new master data', `(${newMaster.name})`);
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
