import { ChatMessagePF2e } from '@module/chat-message/document.js';
import { CombatantPF2e } from '@module/encounter/combatant.js';
import { MODULE_NAME } from 'src/constants.ts';
import { TEMPLATES } from 'src/scripts/register-templates.ts';
import { htmlClosest } from 'src/system/src/util/dom.ts';

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
                master: token.uuid,
            };
        })
    );
    minions = minions.filter(m => m);
    if (minions.length === 0) return null;

    const content = await renderTemplate(TEMPLATES['pf2e-minions'].minions, { minions });
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
