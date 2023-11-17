import { ActorPF2e } from '@actor/index.js';
import { TokenDocumentPF2e } from '@scene/index.js';
import { MODULE_NAME } from 'src/constants.ts';

Hooks.on('createToken', async (...args) => {
    const [document] = args as [document: TokenDocumentPF2e, options: object, userId: string];
    if (!document.flags[MODULE_NAME]?.master) return;
    console.group(`${MODULE_NAME} | createToken`, ...args);

    const master = (await fromUuid(`Actor.${document.flags[MODULE_NAME].master}`)) as ActorPF2e;
    if (master) {
        const minions = (master.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        console.debug(`${MODULE_NAME} | Adding minion to master`, document.uuid, document);
        if (!minions.find(uuid => uuid === document.uuid))
            master.setFlag(MODULE_NAME, 'minions', [...minions, document.uuid]);
    }
    console.groupEnd();
});

Hooks.on('deleteToken', async (...args) => {
    const [document] = args as [document: TokenDocumentPF2e, options: object, userId: string];
    if (!document.flags[MODULE_NAME]?.master) return;
    console.group(`${MODULE_NAME} | deleteToken`, ...args);

    const master = (await fromUuid(`Actor.${document.flags[MODULE_NAME].master}`)) as ActorPF2e;
    if (master) {
        const minions = (master.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        master.setFlag(
            MODULE_NAME,
            'minions',
            minions
                .filter(uuid => uuid != document.uuid)
                .filter(uuid => {
                    const [, scene, , id] = uuid.split('.');
                    if (scene !== document.scene?.id) return true;
                    return canvas.tokens.get(id);
                })
        );
    }
    console.groupEnd();
});
