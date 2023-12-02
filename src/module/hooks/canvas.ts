import { TokenDocumentPF2e } from '@scene/index.js';
import { MODULE_NAME } from '../../constants.ts';
import { refreshTargetDisplay } from './combat-tracker.ts';
import { TokenPF2e } from '@module/canvas/index.js';
import { EncounterTrackerPF2e } from '@module/apps/sidebar/index.js';
import { EncounterPF2e } from '@module/encounter/index.js';

Hooks.on('createToken', async (...args) => {
    const [document] = args as [document: TokenDocumentPF2e, options: object, userId: string];
    if (!document.flags[MODULE_NAME]?.master) return;
    console.group(`${MODULE_NAME} | createToken`, ...args);

    const master = game.actors.get(document.getFlag(MODULE_NAME, 'master') as string);
    if (master) {
        const minionsUuid = (master.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        console.debug(`${MODULE_NAME} | Adding minion to master`, document.uuid, document);
        if (!minionsUuid.find(uuid => uuid === document.uuid))
            await master.setFlag(MODULE_NAME, 'minions', [...minionsUuid, document.uuid]);
    }
    console.groupEnd();
});

Hooks.on('deleteToken', async (...args) => {
    const [document] = args as [document: TokenDocumentPF2e, options: object, userId: string];
    if (!document.flags[MODULE_NAME]?.master) return;
    console.group(`${MODULE_NAME} | deleteToken`, ...args);

    const master = game.actors.get(document.getFlag(MODULE_NAME, 'master') as string);
    if (master) {
        const minionsUuid = (master.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        await master.setFlag(
            MODULE_NAME,
            'minions',
            minionsUuid
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

Hooks.on('targetToken', (...args) => {
    const [, token] = args;
    if (!token.document?.flags[MODULE_NAME]?.master) return;
    console.group(`${MODULE_NAME} | targetToken`, ...args);

    const master = game.actors.get(token.document.getFlag(MODULE_NAME, 'master') as string);
    const combatant = game.combat?.combatants.get(master?.combatant?.id || '');
    if (!master || !combatant || !token) {
        console.groupEnd();
        return;
    }

    refreshTargetDisplay.call(
        game.combats.apps[0] as EncounterTrackerPF2e<EncounterPF2e>,
        combatant,
        (token as TokenPF2e).document
    );
    console.groupEnd();
});

Hooks.on('hoverToken', (...args) => {
    const [token, hovered] = args as [token: TokenPF2e, boolean];
    if (!token.document?.flags[MODULE_NAME]?.master) return;
    console.group(`${MODULE_NAME} | hoverToken`, ...args);

    const tracker = $('[id=combat-tracker ]');
    const minionRow = tracker.find(`.combatant[data-minion-id=${token.id}]`);

    if (hovered) minionRow.addClass('hover');
    else minionRow.removeClass('hover');

    console.groupEnd();
});
