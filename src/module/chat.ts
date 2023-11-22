import { ActorPF2e } from '@actor/index.js';
import { AbilityItemPF2e, SpellPF2e } from '@item/index.js';
import { ChatMessagePF2e } from '@module/chat-message/document.js';
import { CombatantPF2e } from '@module/encounter/combatant.js';
import { ScenePF2e, TokenDocumentPF2e } from '@scene/index.js';
import { MODULE_NAME } from 'src/constants.ts';
import { ActionRequest } from 'src/module.ts';
import { TEMPLATES } from 'src/scripts/register-templates.ts';
import { htmlClosest, sluggify } from 'src/system/src/util/index.ts';

export async function createMinionsMessage(combatant: CombatantPF2e, uuids: string[]): Promise<Maybe<ChatMessage>> {
    if (!combatant.token?.actor) return null;
    const { token } = combatant;

    let minions = await Promise.all(
        uuids.map(async uuid => {
            const [, scene, , id] = uuid.split('.');
            if (scene !== combatant.sceneId) return;

            const minion = canvas.tokens.get(id);
            if (!minion) return;

            return {
                name: minion.document.name,
                img: minion.document.texture.src,
                type: minion.document.flags[MODULE_NAME].type,
                uuid: uuid,
                item: minion.document.flags[MODULE_NAME].item,
            };
        })
    );
    minions = minions.filter(m => m);
    if (minions.length === 0) return null;

    const content = await renderTemplate(TEMPLATES['pf2e-minions'].minions, { minions, master: token.uuid });
    const messageSource: Partial<foundry.documents.ChatMessageSource> = {
        user: game.user.id,
        speaker: {
            ...ChatMessage.getSpeaker({ token, actor: token.actor }),
            alias: game.i18n.format(`${MODULE_NAME}.Minions`, { name: token.name }),
        },
        content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    };
    const isNPCEvent = !token.actor?.hasPlayerOwner;
    if (isNPCEvent) messageSource.whisper = ChatMessage.getWhisperRecipients('GM').map(u => u.id);

    return await ChatMessage.create(messageSource);
}

Hooks.on('renderChatMessage', async (...args) => {
    const [message, $html] = args;
    const html = $html[0]!;

    html.querySelectorAll<HTMLLIElement>('.minion-row').forEach(element => {
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

            const payload: Omit<ActionRequest, 'callback'> = {
                action: 'commandHandler',
                nativeEvent: {
                    shiftKey: nativeEvent.shiftKey,
                },
                messageId: message.id,
                minionUuid: element.dataset.minionUuid,
            };
            if (game.user.isGM) actionHandler(payload);
            else game.socket.emit(`module.${MODULE_NAME}`, payload);

            const [, , , minionId] = element.dataset.minionUuid.split('.');
            const minionToken = canvas.tokens.get(minionId);
            !minionToken?.controlled && minionToken?.control({ releaseOthers: !payload.nativeEvent.shiftKey });
        });
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
});

export const actionHandler = async (payload: Omit<ActionRequest, 'action' | 'callback'>) => {
    const message = game.messages.get(payload.messageId);
    if (!message) {
        console.error(MODULE_NAME, `message ${payload.messageId} not found, unable to update`);
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
        console.error(`${MODULE_NAME} | No minion found`, minionRow.dataset);
        return;
    }

    const actionOverrides = (action: AbilityItemPF2e) => {
        const translation = `${MODULE_NAME}.Actions.${sluggify(action.name, { camel: 'bactrian' })}`;
        return {
            img: minionToken.document.texture.src,
            flags,
            name: game.i18n.format(`${translation}.Title`, { name: minionToken.name }),
            system: {
                description: {
                    value: game.i18n.format(`${translation}.Description`, {
                        spellCompendium: (item?.name && `@UUID[${item.sourceId}]`) || 'that spell',
                        spellName: item?.name || 'the spell',
                        duration:
                            (item &&
                                'duration' in item.system &&
                                item.system.duration.value.includes('sustain') &&
                                item.system.duration.value.replace('sustained up to ', '')) ||
                            '10 minute',
                    }),
                },
            },
        };
    };
    const flags = { [MODULE_NAME]: { minionId, masterId, sourceId, type: 'command-card' } };

    let action = masterToken.actor.itemTypes.action.find(action => action.sourceId === actionAnchor.dataset.sourceUuid);
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
    message?.update({ content: content.outerHTML });
};
