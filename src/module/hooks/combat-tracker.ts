import { CombatantPF2e } from '@module/encounter/combatant.js';
import { PACKAGE_ID } from '../../constants.ts';
import { EncounterTrackerPF2e } from '@module/apps/sidebar/encounter-tracker.js';
import { EncounterPF2e } from '@module/encounter/document.js';
import { TEMPLATES } from '../../scripts/register-templates.ts';
import { TokenDocumentPF2e } from '@scene/index.js';
import {
    createHTMLElement,
    fontAwesomeIcon,
    htmlQuery,
    htmlQueryAll,
    localizeList,
} from 'src/system/src/util/index.ts';
import { Log } from '~module/logger.ts';

Hooks.on('renderEncounterTrackerPF2e', async (...args) => {
    const [document, $html, data] = args as [
        document: EncounterTrackerPF2e<EncounterPF2e>,
        $html: JQuery<HTMLElement>,
        data: CombatTrackerData
    ];
    if (!document.viewed || !canvas.ready) return;

    if ($html[0].checkVisibility()) Log.group('renderEncounterTrackerPF2e', document.id);
    else Log.groupCollapsed('renderEncounterTrackerPF2e', document.id);
    Log.args(args);

    //TODO: simplify things, use game.combats.viewed
    for (const combat of document.combats) {
        if (combat.active) Log.group(combat.uuid);
        else Log.groupCollapsed(combat.uuid);
        Log.info(combat);
        for (const combatant of combat.combatants) {
            const minionsUuid = (combatant.actor?.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
            if (!minionsUuid.length) continue;

            Log.groupCollapsed('combatant', combatant.name);
            Log.info(combatant);
            const $masterRow = $html.find<HTMLLIElement>(`li.combatant[data-combatant-id="${combatant.id}"]`);
            const masterRow = $masterRow[0];

            let minions = await Promise.all(
                minionsUuid.map(async uuid => {
                    const [, sceneId, , id] = uuid.split('.');

                    const minion = canvas.tokens.get(id);
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
                        img: minion.document.texture.src,
                        // active: i === combat.turn,
                        owner: minion.isOwner,
                        // defeated: combatant.isDefeated,
                        hidden: minion.document.hidden,
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
                        minion.document.effects.forEach(e => templateData.effects.add(e));
                        if (minion.document.overlayEffect) templateData.effects.add(minion.document.overlayEffect);
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
            if (minions.length === 0) {
                Log.groupEnd();
                continue;
            }
            const rows = await renderTemplate(TEMPLATES['pf2e-minions'].sidebar.combatTracker.minions, {
                minions,
                master: combatant.id,
            });
            $masterRow.after(rows);
            const $minionsList = $masterRow.siblings(`ul[data-combatant-id="${combatant.id}"]`);
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

            // const minionRows = htmlQueryAll(tracker, "li.combatant");
            for (const minionRow of $minionsList.find<HTMLLIElement>('li.combatant')) {
                const minion = canvas.tokens.get(minionRow.dataset.minionId!);
                if (!minion) {
                    debugger;
                    continue;
                }

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
                        if (game.scenes.viewed?.tokens.has(minion.id ?? '')) {
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

                refreshTargetDisplay.call(document, combatant, minion.document);
            }

            try {
                activateListeners($html);
            } catch (error) {
                Log.error('renderEncounterTrackerPF2e | listeners', error);
            }

            Log.groupEnd();
        }
        Log.groupEnd();
    }

    Log.groupEnd();
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
export function refreshTargetDisplay(
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
        if (!combatantRow) continue;
        const minionRow = htmlQuery(
            combatantRow.parentElement,
            `ul[data-combatant-id="${combatant?.id ?? null}"] li.combatant[data-minion-id="${minionDoc.id}"]`
        );
        if (!minionRow) continue;

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

function activateListeners($html: JQuery<HTMLElement>) {
    const tracker = $html.find('#combat-tracker');
    const minions = tracker.find('.combatant[data-minion-id]');

    const state = {};

    // Combatant control
    $html.find('.combatant-control').on('click', ev => _onCombatantControl(ev));

    // Hover on Combatant
    minions.on('mouseenter', _onCombatantHoverIn.bind(state)).on('mouseleave', _onCombatantHoverOut.bind(state));

    // Click on Combatant
    minions.on('click', _onCombatantMouseDown.bind(state));
}

/**
 * Handle a Combatant control toggle
 */
async function _onCombatantControl(event: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    // if (!this.viewed) return;

    const control = event.currentTarget.dataset.control;
    const li = event.currentTarget.closest<HTMLLIElement>('.combatant[data-minion-id]');
    const minion = canvas.tokens.get(li?.dataset.minionId || '')!;
    if (!minion) return;

    // Switch control action
    switch (control) {
        case 'toggleTarget': {
            return onToggleTarget(minion.document, event.originalEvent);
        }
        // Actively ping the Combatant
        case 'pingCombatant': {
            return _onPingCombatant(minion.document);
        }
    }
}

async function onToggleTarget(tokenDoc: TokenDocumentPF2e | null, event: MouseEvent | undefined): Promise<void> {
    if (!tokenDoc) return;

    const isTargeted = Array.from(game.user.targets).some(t => t.document === tokenDoc);
    if (!tokenDoc.object?.visible) {
        ui.notifications.warn('COMBAT.PingInvisibleToken', { localize: true });
        return;
    }

    tokenDoc.object.setTarget(!isTargeted, { releaseOthers: !event?.shiftKey });
}

async function _onPingCombatant(minion: TokenDocumentPF2e) {
    if (!canvas.ready || minion.scene?.id !== canvas.scene?.id) return;
    if (!minion.object?.visible) return ui.notifications.warn(game.i18n.localize('COMBAT.PingInvisibleToken'));
    await canvas.ping(minion.object.center, {});
}

/**
 * Handle mouse-hover events on a combatant in the tracker
 */
function _onCombatantHoverIn(event: JQuery.MouseEnterEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) {
    event.preventDefault();
    if (!canvas.ready) return;
    const li = event.currentTarget;
    const token = canvas.tokens.get(li?.dataset.minionId || '')!;
    if (token?.isVisible) {
        if (!token.controlled) token.emitHoverIn(event.originalEvent!);
        this._highlighted = token;
    }
}

/**
 * Handle mouse-unhover events for a combatant in the tracker
 */
function _onCombatantHoverOut(event: JQuery.MouseLeaveEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) {
    event.preventDefault();
    if (this._highlighted) this._highlighted.emitHoverOut(event.originalEvent);
    this._highlighted = null;
}

/**
 * Handle mouse-down event on a combatant name in the tracker
 */
async function _onCombatantMouseDown(event: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) {
    event.preventDefault();

    const li = event.currentTarget;
    const token = canvas.tokens.get(li?.dataset.minionId || '')!;
    const minion = token.document;
    if (!minion.actor?.testUserPermission(game.user, 'OBSERVER')) return;
    const now = Date.now();

    // Handle double-left click to open sheet
    const dt = now - this._clickTime;
    this._clickTime = now;
    if (dt <= 250) return minion.actor?.sheet.render(true);

    // Control and pan to Token object
    if (token) {
        token.control({ releaseOthers: true });
        return canvas.animatePan(token.center);
    }
}
