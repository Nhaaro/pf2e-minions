import { TokenDocumentPF2e } from '@scene/index.js';
import { PACKAGE_ID } from '../../constants.ts';
import { refreshTargetDisplay } from './combat-tracker.ts';
import { TokenPF2e } from '@module/canvas/index.js';
import { EncounterTrackerPF2e } from '@module/apps/sidebar/index.js';
import { EncounterPF2e } from '@module/encounter/index.js';
import { Log } from '~module/logger.ts';

Hooks.on('createToken', async (...args) => {
    const [document] = args as [document: TokenDocumentPF2e, options: object, userId: string];
    if (!document.flags[PACKAGE_ID]?.master) return;
    Log.groupCollapsed('createToken', document.name, document.id);
    Log.args(args);

    const master = game.actors.get(document.getFlag(PACKAGE_ID, 'master') as string);
    if (master) {
        const minionsUuid = (master.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
        Log.debug('Adding minion to master', document.uuid, document);
        if (!minionsUuid.find(uuid => uuid === document.uuid))
            await master.setFlag(PACKAGE_ID, 'minions', [...minionsUuid, document.uuid]);
    }
    Log.groupEnd();
});

Hooks.on('deleteToken', async (...args) => {
    const [document] = args as [document: TokenDocumentPF2e, options: object, userId: string];
    if (!document.flags[PACKAGE_ID]?.master) return;
    Log.groupCollapsed('deleteToken', document.name, document.id);
    Log.args(args);

    const master = game.actors.get(document.getFlag(PACKAGE_ID, 'master') as string);
    if (master) {
        const minionsUuid = (master.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
        await master.setFlag(
            PACKAGE_ID,
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
    Log.groupEnd();
});

Hooks.on('targetToken', (...args) => {
    const [, token] = args;
    if (!token.document?.flags[PACKAGE_ID]?.master) return;
    Log.groupCollapsed('targetToken', token.name);
    Log.args(args);

    const master = game.actors.get(token.document.getFlag(PACKAGE_ID, 'master') as string);
    const combatant = game.combat?.combatants.get(master?.combatant?.id || '');
    if (!master || !combatant || !token) {
        Log.groupEnd();
        return;
    }

    refreshTargetDisplay.call(
        game.combats.apps[0] as EncounterTrackerPF2e<EncounterPF2e>,
        combatant,
        (token as TokenPF2e).document
    );
    Log.groupEnd();
});

Hooks.on('hoverToken', (...args) => {
    const [token, hovered] = args as [token: TokenPF2e, boolean];
    if (!token.document?.flags[PACKAGE_ID]?.master) return;

    // Start console group on hover in
    if (hovered) Log.groupCollapsed('hoverToken', token.name);
    Log.args(args);

    const tracker = $('[id=combat-tracker ]');
    const minionRow = tracker.find(`.combatant[data-minion-id=${token.id}]`);

    if (hovered) minionRow.addClass('hover');
    else minionRow.removeClass('hover');

    // End console group on hover out
    if (!hovered) Log.groupEnd();
});
