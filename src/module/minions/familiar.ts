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
    Log.group('preUpdateActor', ...args);

    if (!changes.system?.master?.id) {
        Log.info('No master change, skipping...');
        Log.groupEnd();
        return;
    }

    const updates = mergeObject(changes, { prototypeToken: { flags: { [PACKAGE_ID]: {} } } });
    const tokenFlags = updates.prototypeToken.flags[PACKAGE_ID] as Record<string, unknown>;
    Log.debug('tokenFlags', document.prototypeToken?.flags[PACKAGE_ID], tokenFlags);
    tokenFlags.type ??= 'familiar';

    const newMaster = game.actors.get(changes.system.master.id);
    if (newMaster) {
        Log.group('Adding new master data');
        tokenFlags.master = newMaster.id;

        const minionsUuid = (newMaster.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
        document.getActiveTokens().forEach(async token => {
            Log.debug('Cascading new master changes', token.document.uuid, token.document);
            await token.document.setFlag(PACKAGE_ID, 'master', newMaster.id);
            if (!minionsUuid.find(uuid => uuid === token.document.uuid))
                await newMaster.setFlag(PACKAGE_ID, 'minions', [...minionsUuid, token.document.uuid]);
        });
        Log.groupEnd();
    }
    const oldMaster = game.actors.get(document.system.master.id || '');
    if (oldMaster) {
        Log.group('Removing old master data');
        const minionsUuid = (oldMaster.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
        document.getActiveTokens().forEach(async token => {
            Log.debug('Cascading old master changes', token.document.uuid, token.document);
            await oldMaster.setFlag(
                PACKAGE_ID,
                'minions',
                minionsUuid.filter(uuid => uuid != token.document.uuid)
            );
        });
        Log.groupEnd();
    }
    Log.groupEnd();
});
