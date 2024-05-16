import { ActorPF2e } from '@actor/index.js';
import { AbilityItemPF2e, SpellPF2e } from '@item/index.js';
import { ChatMessagePF2e } from '@module/chat-message/document.js';
import { ScenePF2e, TokenDocumentPF2e } from '@scene/index.js';
import { PACKAGE_ID } from '../../constants.ts';
import { TEMPLATES } from '../../scripts/register-templates.ts';
import { htmlClosest, sluggify } from '../../system/src/util/index.ts';
import { createAction, dispatch } from 'utils/socket/actions.ts';
import { Log } from '~module/logger.ts';

Hooks.on('renderChatMessage', async (...args) => {
    const [message, $html] = args;
    if (message.getFlag(PACKAGE_ID, 'type') !== 'minions-card' || !$html[0]) return;
    Log.group('renderChatMessage', ...args);

    const html = $html[0];

    Log.debug('finding rows...');
    html.querySelectorAll<HTMLLIElement>('.minion-row').forEach(element => {
        Log.group('Attaching listeners', element);
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
                updateMinionsCardAction({
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

    Log.groupEnd();
});

export const updateMinionsCardAction = createAction(
    'updateMinionsCard',
    (payload: { nativeEvent: MouseEvent; messageId: string; minionUuid?: string }) => {
        Log.info('updateMinionsCard', payload);
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
            Log.error('No minion found', minionRow.dataset);
            return;
        }

        const actionOverrides = (action: AbilityItemPF2e) => {
            const translation = `${PACKAGE_ID}.Actions.${sluggify(action.name, { camel: 'bactrian' })}`;
            return {
                img: minionToken.document.texture.src,
                flags,
                name: game.i18n.format(`${translation}.Title`, { name: minionToken.name }),
                system: {
                    description: {
                        value: game.i18n.format(`${translation}.Description`, {
                            spellCompendium: (item?.name && `@UUID[${item.uuid}]`) || 'that spell',
                            spellName: item?.name || 'the spell',
                            duration:
                                (item &&
                                    'duration' in item.system &&
                                    item.system.duration.value.includes('sustain') &&
                                    item.system.duration.value.replace('sustained up to ', '')) ||
                                '10 minutes',
                        }),
                    },
                },
            };
        };
        const flags = { [PACKAGE_ID]: { minionId, masterId, sourceId, type: 'command-card' } };

        let action = masterToken.actor.itemTypes.action.find(
            action => action.sourceId === actionAnchor.dataset.sourceUuid
        );
        if (action) {
            action = action.clone(actionOverrides(action));
            action.toMessage();
        } else {
            action = (await fromUuid<AbilityItemPF2e<ActorPF2e<TokenDocumentPF2e<ScenePF2e> | null>>>(
                actionAnchor.dataset.sourceUuid
            ))!;
            action = action.clone(actionOverrides(action));

            const template = (TEMPLATES.pf2e.chat.card as unknown as Record<string, string>)[sluggify(action.type)];
            const templateData = {
                actor: masterToken.actor,
                item: action,
                data: await action.getChatData(),
            };
            const chatData: Partial<foundry.documents.ChatMessageSource> = {
                speaker: ChatMessage.getSpeaker({ token: masterToken.document, actor: masterToken.actor }),
                flags: {
                    ...flags,
                    pf2e: {
                        origin: action.getOriginData(),
                    },
                },
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            };
            chatData.content = await renderTemplate(template, templateData);
            const isNPCEvent = !masterToken.actor?.hasPlayerOwner;
            if (isNPCEvent) chatData.whisper = ChatMessage.getWhisperRecipients('GM').map(u => u.id);

            ChatMessage.create(chatData);
        }

        actionsWrapper?.remove();
        await minionToken.document.setFlag(PACKAGE_ID, 'commanded', true);
        await message?.update({ content: content.outerHTML });
    }
);
