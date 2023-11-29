import { CombatantPF2e } from '@module/encounter/combatant.js';
import { MODULE_NAME } from 'src/constants.ts';
import { createMinionsMessage } from './chat.ts';
import { EncounterTrackerPF2e } from '@module/apps/sidebar/encounter-tracker.js';
import { EncounterPF2e } from '@module/encounter/document.js';
import { TEMPLATES } from 'src/scripts/register-templates.ts';
import { TokenDocumentPF2e } from '@scene/index.js';

Hooks.on('pf2e.startTurn', async (...args) => {
    const combatant = args[0] as CombatantPF2e;
    if (!combatant.actor?.getFlag(MODULE_NAME, 'minions')) return;
    console.debug(`${MODULE_NAME} | pf2e.startTurn`, ...args);

    const minions = (combatant.actor.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
    if (minions.length > 0) createMinionsMessage(combatant, minions);
});

Hooks.on('renderEncounterTrackerPF2e', async (...args) => {
    const [document, $html, data] = args as [
        document: EncounterTrackerPF2e<EncounterPF2e>,
        $html: JQuery<HTMLElement>,
        data: CombatTrackerData
    ];
    if (!document.viewed || !canvas.ready) return;
    console.group(`${MODULE_NAME} | renderEncounterTrackerPF2e`, ...args);

    for (const combat of document.combats) {
        for (const combatant of combat.combatants) {
            const uuids = (combatant.actor?.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
            if (!uuids.length) continue;

            console.group(`${MODULE_NAME} | renderEncounterTrackerPF2e | combatant`, combatant, combat);
            const masterRow = $html.find<HTMLLIElement>(`li.combatant[data-combatant-id=${combatant.id}]`);
            console.log(uuids, masterRow);

            let minions = await Promise.all(
                uuids.map(async uuid => {
                    const [, sceneId, , id] = uuid.split('.');
                    if (sceneId !== combatant.sceneId) return;

                    const minion = await fromUuid<TokenDocumentPF2e>(uuid);
                    if (!minion) return;

                    return {
                        user: game.user,
                        id: id,
                        name: minion.name,
                        img: minion.texture.src,
                        ...('resource' in data.settings
                            ? {
                                  hasResource: 'resource' in data.settings,
                                  resource:
                                      foundry.utils.getProperty(
                                          minion.actor?.system || {},
                                          data.settings.resource as string
                                      ) || null,
                              }
                            : {}),
                    };
                })
            );
            minions = minions.filter(m => m);
            if (minions.length === 0) continue;
            const rows = await renderTemplate(TEMPLATES['pf2e-minions'].sidebar.combatTracker.minions, {
                minions,
                master: combatant.id,
            });
            masterRow.after(rows);

            console.groupEnd();
        }
    }

    console.groupEnd();
});
