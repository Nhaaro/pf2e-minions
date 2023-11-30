import { CombatantPF2e } from '@module/encounter/combatant.js';
import { MODULE_NAME } from 'src/constants.ts';
import { createMinionsMessage } from './chat.ts';
import { EncounterTrackerPF2e } from '@module/apps/sidebar/encounter-tracker.js';
import { EncounterPF2e } from '@module/encounter/document.js';
import { TEMPLATES } from 'src/scripts/register-templates.ts';
import { TokenDocumentPF2e } from '@scene/index.js';
import {
    createHTMLElement,
    fontAwesomeIcon,
    htmlQuery,
    htmlQueryAll,
    localizeList,
} from 'src/system/src/util/index.ts';
import { TokenPF2e } from '@module/canvas/index.js';

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
            const $masterRow = $html.find<HTMLLIElement>(`li.combatant[data-combatant-id=${combatant.id}]`);
            const masterRow = $masterRow[0];

            let minions = await Promise.all(
                uuids.map(async uuid => {
                    const [, sceneId, , id] = uuid.split('.');

                    const minion = await fromUuid<TokenDocumentPF2e>(uuid);
                    if (!minion) return;

                    // Prepare template data
                    const resource =
                        combatant.permission >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
                            ? 'resource' in data.settings
                                ? foundry.utils.getProperty(
                                      minion.actor?.system || {},
                                      data.settings.resource as string
                                  )
                                : null
                            : null;

                    const templateData: Record<string, any> = {
                        id: id,
                        name: minion.name,
                        img: minion.texture.src,
                        // active: i === combat.turn,
                        owner: minion.isOwner,
                        // defeated: combatant.isDefeated,
                        hidden: minion.hidden,
                        hasResource: resource !== null,
                        resource: resource,
                        canPing:
                            sceneId === canvas.scene?.id &&
                            game.user.hasPermission('PING_CANVAS' as unknown as UserPermission),
                    };
                    templateData.css = [
                        templateData.active ? 'active' : '',
                        templateData.hidden ? 'hidden' : '',
                        templateData.defeated ? 'defeated' : '',
                    ]
                        .join(' ')
                        .trim();

                    // Actor and Token status effects
                    templateData.effects = new Set();
                    if (minion) {
                        minion.effects.forEach(e => templateData.effects.add(e));
                        if (minion.overlayEffect) templateData.effects.add(minion.overlayEffect);
                    }
                    if (minion.actor) {
                        for (const effect of minion.actor.temporaryEffects) {
                            if (effect.statuses.has(CONFIG.specialStatusEffects.DEFEATED)) templateData.defeated = true;
                            else if (effect.icon) templateData.effects.add(effect.icon);
                        }
                    }
                    templateData.user = game.user;
                    return templateData;
                })
            );
            minions = minions.filter(m => m);
            if (minions.length === 0) continue;
            const rows = await renderTemplate(TEMPLATES['pf2e-minions'].sidebar.combatTracker.minions, {
                minions,
                master: combatant.id,
            });
            $masterRow.after(rows);
            const $minionsList = $masterRow.siblings(`ul[data-combatant-id=${combatant.id}]`);
            const minionsList = $minionsList[0] as unknown as HTMLUListElement;

            const allyColor = (c: CombatantPF2e<EncounterPF2e>) =>
                c.actor?.hasPlayerOwner
                    ? CONFIG.Canvas.dispositionColors.PARTY
                    : CONFIG.Canvas.dispositionColors.FRIENDLY;

            // Highlight the active-turn participant's alliance color
            if (combatant?.actor && document.viewed?.combatant === combatant) {
                const alliance = combatant.actor.alliance;
                const dispositionColor = new foundry.utils.Color(
                    alliance === 'party'
                        ? allyColor(combatant)
                        : alliance === 'opposition'
                        ? CONFIG.Canvas.dispositionColors.HOSTILE
                        : CONFIG.Canvas.dispositionColors.NEUTRAL
                );
                if (minionsList) {
                    masterRow.style.borderBottomStyle = 'dashed';
                    minionsList.style.background = dispositionColor.toRGBA(0.1);
                    minionsList.style.borderColor = dispositionColor.toString();
                }
            }

            for (const minionRow of $minionsList.find<HTMLLIElement>('li.combatant')) {
                const minion = canvas.tokens.get(minionRow.dataset.minionId!);

                // Create section for list of users targeting a combatant's token
                const nameHeader = htmlQuery(minionRow, '.token-name h4')!;
                nameHeader.innerHTML = [
                    createHTMLElement('span', { classes: ['name'], children: [nameHeader.innerText] }).outerHTML,
                    createHTMLElement('span', { classes: ['users-targeting'] }).outerHTML,
                ].join('');

                // Adjust controls with system extensions
                for (const control of htmlQueryAll(minionRow, 'a.combatant-control')) {
                    const controlIcon = htmlQuery(control, 'i');
                    if (!controlIcon) continue;

                    // Ensure even spacing between combatant controls
                    controlIcon.classList.remove('fas');
                    controlIcon.classList.add('fa-solid', 'fa-fw');

                    if (control.dataset.control === 'pingCombatant') {
                        // Use an icon for the `pingCombatant` control that looks less like a targeting reticle
                        controlIcon.classList.remove('fa-bullseye-arrow');
                        controlIcon.classList.add('fa-signal-stream');

                        // Add a `targetCombatant` control after `toggleDefeated`
                        if (game.scenes.viewed?.tokens.has(minion?.id ?? '')) {
                            const targetControl = createHTMLElement('a', {
                                classes: ['combatant-control'],
                                dataset: { control: 'toggleTarget', tooltip: 'COMBAT.ToggleTargeting' },
                                children: [
                                    fontAwesomeIcon('location-crosshairs', { style: 'duotone', fixedWidth: true }),
                                ],
                            });
                            control.before(targetControl);
                        }
                    }
                }

                refreshTargetDisplay.call(document, combatant, minion?.document!);
            }

            console.groupEnd();
        }
    }

    console.groupEnd();
});
Hooks.on('targetToken', (...args) => {
    const [, token] = args;
    if (!token.document?.flags[MODULE_NAME]?.master) return;
    console.group(`${MODULE_NAME} | createToken`, ...args);

    // const master = (await fromUuid(`Actor.${token.document.flags[MODULE_NAME].master}`)) as ActorPF2e;
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

function combatantAndTokenDoc(document: CombatantPF2e | TokenDocumentPF2e): {
    combatant: CombatantPF2e | null;
    tokenDoc: TokenDocumentPF2e | null;
} {
    return 'token' in document
        ? { combatant: document, tokenDoc: document.token }
        : { combatant: document.combatant, tokenDoc: document };
}

/** Refresh the list of users targeting a combatant's token as well as the active state of the target toggle */
function refreshTargetDisplay(
    this: EncounterTrackerPF2e<EncounterPF2e>,
    combatantOrToken: CombatantPF2e | TokenDocumentPF2e,
    minionDoc: TokenDocumentPF2e
): void {
    if (!this.viewed || !canvas.ready) return;

    const { combatant, tokenDoc } = combatantAndTokenDoc(combatantOrToken);
    if (combatant?.encounter !== this.viewed || tokenDoc?.combatant !== combatant) {
        return;
    }

    for (const tracker of htmlQueryAll(document, '#combat, #combat-popout')) {
        const combatantRow = htmlQuery(tracker, `li.combatant[data-combatant-id="${combatant?.id ?? null}"]`);
        if (!combatantRow) return;
        const minionRow = htmlQuery(
            combatantRow.parentElement,
            `ul[data-combatant-id="${combatant?.id ?? null}"] li.combatant[data-minion-id=${minionDoc.id}]`
        );
        if (!minionRow) return;

        const usersTargetting = game.users.filter(u => Array.from(u.targets).some(t => t.document === minionDoc));

        const userIndicators = usersTargetting.map((user): HTMLElement => {
            const icon = fontAwesomeIcon('location-crosshairs', { style: 'duotone', fixedWidth: true });
            icon.style.color = user.color;
            return icon;
        });

        const targetingSection = htmlQuery(minionRow, '.users-targeting');
        if (targetingSection) {
            targetingSection.innerHTML = userIndicators.map(i => i.outerHTML).join('');
            targetingSection.dataset.tooltip = game.i18n.format('COMBAT.TargetedBy', {
                list: localizeList(
                    usersTargetting.map(u => u.name),
                    { conjunction: 'and' }
                ),
            });
        }

        const targetControlIcon = htmlQuery(minionRow, 'a.combatant-control[data-control=toggleTarget]');
        if (usersTargetting.includes(game.user)) {
            targetControlIcon?.classList.add('active');
        } else {
            targetControlIcon?.classList.remove('active');
        }
    }
}
