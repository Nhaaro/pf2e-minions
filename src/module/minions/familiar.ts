import { ActorSourcePF2e } from '@actor/data/index.js';
import { ActorPF2e } from '@actor/index.js';
import { MODULE_NAME } from '../../constants.ts';
import { isFamiliarData, isFamiliarDocument } from '../utils.ts';

Hooks.on('preUpdateActor', async (...args) => {
    const [document, changes] = args as [
        document: ActorPF2e,
        changes: DeepPartial<ActorSourcePF2e>,
        options: object,
        userId: string
    ];
    if (!(isFamiliarDocument(document) && isFamiliarData(document, changes))) return;
    console.group(`${MODULE_NAME} | preUpdateActor`, ...args);

    if (!changes.system?.master?.id) {
        console.info(`${MODULE_NAME} | No master change, skipping...`);
        console.groupEnd();
        return;
    }

    const updates = mergeObject(changes, { prototypeToken: { flags: { [MODULE_NAME]: {} } } });
    const tokenFlags = updates.prototypeToken.flags[MODULE_NAME] as Record<string, unknown>;
    console.debug(`${MODULE_NAME} | tokenFlags`, document.prototypeToken?.flags[MODULE_NAME], tokenFlags);
    tokenFlags.type ??= 'familiar';

    const newMaster = game.actors.get(changes.system.master.id);
    if (newMaster) {
        console.group(`${MODULE_NAME} | Adding new master data`);
        tokenFlags.master = newMaster.id;

        const minionsUuid = (newMaster.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        document.getActiveTokens().forEach(token => {
            console.debug(`${MODULE_NAME} | Cascading new master changes`, token.document.uuid, token.document);
            token.document.setFlag(MODULE_NAME, 'master', newMaster.id);
            if (!minionsUuid.find(uuid => uuid === token.document.uuid))
                newMaster.setFlag(MODULE_NAME, 'minions', [...minionsUuid, token.document.uuid]);
        });
        console.groupEnd();
    }
    const oldMaster = game.actors.get(document.system.master.id || '');
    if (oldMaster) {
        console.group(`${MODULE_NAME} | Removing old master data`);
        const minionsUuid = (oldMaster.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        document.getActiveTokens().forEach(token => {
            console.debug(`${MODULE_NAME} | Cascading old master changes`, token.document.uuid, token.document);
            oldMaster.setFlag(
                MODULE_NAME,
                'minions',
                minionsUuid.filter(uuid => uuid != token.document.uuid)
            );
        });
        console.groupEnd();
    }
    console.groupEnd();
});
