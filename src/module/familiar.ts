import { ActorSourcePF2e } from '@actor/data/index.js';
import { ActorPF2e } from '@actor/index.js';
import { MODULE_NAME } from 'src/constants.ts';
import { isFamiliarData, isFamiliarDocument } from 'src/lib/lib.ts';

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

    const newMaster = (await fromUuid(`Actor.${changes.system.master.id}`)) as ActorPF2e;
    if (newMaster) {
        console.group(`${MODULE_NAME} | Adding new master data`);
        tokenFlags.master = newMaster.id;

        const minions = (newMaster.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        document.getActiveTokens().forEach(token => {
            console.debug(`${MODULE_NAME} | Cascading new master changes`, token.document.uuid, token.document);
            token.document.setFlag(MODULE_NAME, 'master', newMaster.id);
            if (!minions.find(uuid => uuid === token.document.uuid))
                newMaster.setFlag(MODULE_NAME, 'minions', [...minions, token.document.uuid]);
        });
        console.groupEnd();
    }
    const oldMaster = (await fromUuid(`Actor.${document.system.master.id}`)) as ActorPF2e;
    if (oldMaster) {
        console.group(`${MODULE_NAME} | Removing old master data`);
        const minions = (newMaster.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        document.getActiveTokens().forEach(token => {
            console.debug(`${MODULE_NAME} | Cascading old master changes`, token.document.uuid, token.document);
            oldMaster.setFlag(
                MODULE_NAME,
                'minions',
                minions.filter(uuid => uuid != token.document.uuid)
            );
        });
        console.groupEnd();
    }
    console.groupEnd();
});
