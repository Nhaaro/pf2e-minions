import { ActorPF2e } from '@actor/index.js';
import { AbilityItemPF2e, SpellPF2e } from '@item/index.js';
import { ChatMessagePF2e } from '@module/chat-message/index.js';
import { ScenePF2e, TokenDocumentPF2e } from '@scene/index.js';
import { ChatMessageSchema } from 'types/foundry/common/documents/chat-message';
import { createAction, dispatch } from 'utils/socket/actions.ts';
import { Log } from '~module/logger.ts';
import { PACKAGE_ID } from '../../constants.ts';
import { TEMPLATES } from '../../scripts/register-templates.ts';
import { htmlClosest, sluggify } from '../../system/src/util/index.ts';

Hooks.on('renderChatMessage', async (...args) => {
    const [message, $html] = args as [
        message: ChatMessagePF2e,
        JQuery<HTMLElement>,
        SourceFromSchema<ChatMessageSchema>
    ];
    const moduleFlags = message.flags[PACKAGE_ID];
    if (moduleFlags?.type !== 'minions-card' || !$html[0] || !game.combats.viewed?.started) return;

    if (
        (moduleFlags?.minions as Record<string, any>[]).every(minion => minion.commanded) ||
        (moduleFlags?.encounter as CombatHistoryData).round !== game.combat?.current.round
    )
        Log.groupCollapsed('renderChatMessage', moduleFlags.type, moduleFlags.combatant, moduleFlags.encounter);
    else Log.group('renderChatMessage', moduleFlags.type, moduleFlags.combatant, moduleFlags.encounter);
    Log.args(args);

    const html = $html[0];

    Log.debug('finding rows...');
    html.querySelectorAll<HTMLLIElement>('.minion-row').forEach(element => {
        Log.groupCollapsed('Attaching listeners', element.dataset.minionUuid);
        Log.info(element);
        /** Highlight the minion's corresponding token on the canvas */
        element.addEventListener('mouseenter', hoverHandler);
        /** Remove the token highlight */
        element.addEventListener('mouseleave', hoverHandler);
        /** Select the minion token */
        element.querySelector<HTMLHeadingElement>('.minion-name')?.addEventListener('click', clickHandler);
        element.querySelector<HTMLHeadingElement>('.minion-name')?.addEventListener('dblclick', clickHandler);
        /** Send action to chat */
        element.querySelector<HTMLAnchorElement>('a')?.addEventListener('click', nativeEvent => {
            if (!element.dataset.minionUuid) return;

            dispatch(
                commandMinionAction({
                    nativeEvent,
                    messageId: message.id,
                    minionUuid: element.dataset.minionUuid,
                })
            );

            const [, , , minionId] = element.dataset.minionUuid.split('.');
            const minionToken = canvas.tokens.get(minionId);
            !minionToken?.controlled && minionToken?.control({ releaseOthers: !nativeEvent.shiftKey });
        });
        Log.groupEnd();
    });

    async function hoverHandler(this: HTMLLIElement, nativeEvent: MouseEvent | PointerEvent) {
        if (!canvas.ready || !this.dataset.minionUuid) return;

        const [, _scene, , id] = this.dataset.minionUuid.split('.');
        const token = canvas.tokens.get(id);
        if (!token?.isVisible || token.controlled) return;

        if (!token.hover) {
            token.emitHoverIn(nativeEvent);
        } else {
            token.emitHoverOut(nativeEvent);
            // Revert highlight to message's corresponding token
            (message as ChatMessagePF2e).token?.object?.emitHoverIn(nativeEvent);
        }
    }

    async function clickHandler(this: HTMLHeadingElement, nativeEvent: MouseEvent) {
        const minionRow = htmlClosest(nativeEvent.target, '.minion-row');
        if (!canvas.ready || !minionRow?.dataset.minionUuid) return;

        const [, _scene, , id] = minionRow.dataset.minionUuid.split('.');
        const token = canvas.tokens.get(id);
        if (!token?.isVisible || !token.isOwner) return;

        token.controlled ? token.release() : token.control({ releaseOthers: !nativeEvent.shiftKey });
        // If a double click, also pan to the token
        if (nativeEvent.type === 'dblclick') {
            const scale = Math.max(1, canvas.stage.scale.x);
            canvas.animatePan({ ...token.center, scale, duration: 1000 });
        }
    }

    Log.info('Storing message ref', message.id);
    message.token?.combatant?.setFlag(PACKAGE_ID, 'minions-card', message.id);

    Log.debug('encounter::moduleFlags|game.combat.current', moduleFlags.encounter, game.combat?.current);
    if (
        foundry.utils.objectsEqual(
            moduleFlags.encounter as CombatHistoryData,
            game.combat?.current as CombatHistoryData
        )
    ) {
        Log.info('Sticking message');
        html.classList.add('sticky');
    }

    Log.groupEnd();
});

export const commandMinionAction = createAction(
    'commandMinion',
    (payload: { nativeEvent: MouseEvent; messageId: string; minionUuid?: string }) => {
        Log.info('commandMinion', payload);
        return {
            payload: {
                ...payload,
                nativeEvent: {
                    shiftKey: payload.nativeEvent.shiftKey,
                },
            },
        };
    },
    async payload => {
        const message = game.messages.get(payload.messageId);
        if (!message) {
            Log.error(`message ${payload.messageId} not found, unable to update`);
            return;
        }
        const $html = await message.getHTML();

        const html = $html[0];
        const content = html.querySelector<HTMLUListElement>(`[data-master-uuid]`);
        const minionRow = content?.querySelector<HTMLLIElement>(`[data-minion-uuid="${payload.minionUuid}"]`);
        const actionsWrapper = minionRow?.querySelector<HTMLDivElement>('.actions-wrapper');
        const actionAnchor = actionsWrapper?.querySelector<HTMLAnchorElement>('[data-source-uuid]');
        if (
            !canvas.ready ||
            !content?.dataset.masterUuid ||
            !minionRow?.dataset.minionUuid ||
            !actionsWrapper ||
            !actionAnchor?.dataset.sourceUuid
        )
            return;

        const [, , , masterId] = content.dataset.masterUuid.split('.');
        const [, , , minionId] = minionRow.dataset.minionUuid.split('.');
        const [, , , , sourceId] = actionAnchor.dataset.sourceUuid.split('.');

        const minionToken = canvas.tokens.get(minionId);
        const masterToken = canvas.tokens.get(masterId);
        const item = await fromUuid<SpellPF2e | AbilityItemPF2e>(minionRow.dataset.itemUuid || '');
        if (!masterToken?.actor || !masterToken?.isOwner) return;
        if (!minionToken) {
            Log.error('No minion found, removing element...', minionRow.dataset, minionRow);
            Log.debug('Verify the minions list is correct', masterToken.document.actor?.getFlag(PACKAGE_ID, 'minions'));
            minionRow.remove();
            await message?.update({ content: content.outerHTML });
            return;
        }

        const overrideAction = <T extends AbilityItemPF2e>(action: T): T => {
            const translation = `${PACKAGE_ID}.Actions.${sluggify(action.name, { camel: 'bactrian' })}`;
            return action.clone({
                img: minionToken.document.texture.src,
                flags,
                name: game.i18n.format(`${translation}.Title`, { name: minionToken.name }),
            });
        };
        const replaceDescription = (action: AbilityItemPF2e, value: string) => {
            const translation = `${PACKAGE_ID}.Actions.${sluggify(action.name, { camel: 'bactrian' })}`;
            const replacementString = game.i18n.format(`${translation}.Description`, {
                spellCompendium: (item?.name && `@UUID[${item.uuid}]`) || 'that spell',
                spellName: item?.name || 'the spell',
                duration:
                    (item &&
                        'duration' in item.system &&
                        item.system.duration.value.includes('sustain') &&
                        item.system.duration.value.replace('sustained up to ', '')) ||
                    '10 minutes',
            });

            const regex = /^(.*?)<div class="addendum">/s;
            const match = value.match(regex);

            let newContent;
            if (match) {
                newContent = value.replace(regex, replacementString + '\n<hr />\n' + '<div class="addendum">');
            } else {
                newContent = replacementString;
            }
            return newContent;
        };
        const flags = {
            [PACKAGE_ID]: { minionId, masterId, sourceId, type: 'command-card' },
        };

        const action =
            masterToken.actor.itemTypes.action.find(action => action.sourceId === actionAnchor.dataset.sourceUuid) ||
            (await fromUuid<AbilityItemPF2e<ActorPF2e<TokenDocumentPF2e<ScenePF2e> | null>>>(
                actionAnchor.dataset.sourceUuid
            ));
        if (!action) return Log.error('action not found');

        const actionChatData = await action.getChatData();

        // Basic template rendering data
        const template = (TEMPLATES.pf2e.chat.card as unknown as Record<string, string>)[sluggify(action.type)];
        const templateData = {
            actor: masterToken.actor,
            tokenId: masterToken.id,
            item: overrideAction(action),
            // TODO: find a better way to replace the original description; action.clone removes the addenda
            data: foundry.utils.mergeObject(actionChatData, {
                description: {
                    value: replaceDescription(action, actionChatData.description.value),
                },
            }),
        };
        const chatData: DeepPartial<foundry.documents.ChatMessageSource> = ChatMessage.applyRollMode(
            {
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                speaker: ChatMessage.getSpeaker({
                    actor: masterToken.actor,
                    token: masterToken.actor.getActiveTokens(false, true).at(0),
                }),
                content: await renderTemplate(template, templateData),
                flags: {
                    ...flags,
                    pf2e: { origin: action.getOriginData() },
                },
            },
            'publicroll'
        );
        const isNPCEvent = !masterToken.actor?.hasPlayerOwner;
        if (isNPCEvent) chatData.whisper = ChatMessage.getWhisperRecipients('GM').map(u => u.id);

        ChatMessage.create(chatData);

        actionsWrapper?.remove();
        await minionToken.document.setFlag(PACKAGE_ID, 'commanded', true);
        await message.setFlag(
            PACKAGE_ID,
            'minions',
            (message.getFlag(PACKAGE_ID, 'minions') as Record<string, any>[]).map(minion => {
                if (minion.id === minionId) minion.commanded = true;
                return minion;
            })
        );
        await message?.update({ content: content.outerHTML });
    }
);

export const clearMinionsCardAction = createAction(
    'clearMinionsCard',
    (payload: { messageId: string; minionUuid?: string }) => {
        Log.info('clearMinionsCard', payload);
        return {
            payload: {
                ...payload,
            },
        };
    },
    async payload => {
        const message = game.messages.get(payload.messageId);
        if (!message) {
            Log.error(`message ${payload.messageId} not found, unable to update`);
            return;
        }
        const $html = await message.getHTML();

        const html = $html[0];
        const content = html.querySelector<HTMLUListElement>(`[data-master-uuid]`);

        const minionRows = content?.querySelectorAll<HTMLLIElement>(`[data-minion-uuid]`);
        if (!canvas.ready || !content?.dataset.masterUuid || !minionRows) return;

        const [, , , masterId] = content.dataset.masterUuid.split('.');
        const masterToken = canvas.tokens.get(masterId);
        if (!masterToken?.actor || !masterToken?.isOwner) return;

        for (const minionRow of minionRows) {
            const actionsWrapper = minionRow?.querySelector<HTMLDivElement>('.actions-wrapper');
            const actionAnchor = actionsWrapper?.querySelector<HTMLAnchorElement>('[data-source-uuid]');
            if (!minionRow?.dataset.minionUuid || !actionsWrapper || !actionAnchor?.dataset.sourceUuid) continue;

            const [, , , minionId] = minionRow.dataset.minionUuid.split('.');
            const minionToken = canvas.tokens.get(minionId);

            if (!minionToken) {
                Log.error('No minion found, removing element...', minionRow.dataset, minionRow);
                Log.debug(
                    'Verify the minions list is correct',
                    masterToken.document.actor?.getFlag(PACKAGE_ID, 'minions')
                );
                minionRow.remove();
                await message?.update({ content: content.outerHTML });
                return;
            }

            actionsWrapper?.remove();
        }

        await message?.update({ content: content.outerHTML });
        message.token?.combatant?.unsetFlag(PACKAGE_ID, 'minions-card');
    }
);
