import { CombatantPF2e } from '@module/encounter/index.js';
import { MODULE_NAME } from '../../constants.ts';
import { TEMPLATES } from '../../scripts/register-templates.ts';

Hooks.on('pf2e.startTurn', async (...args) => {
    const combatant = args[0] as CombatantPF2e;
    if (!combatant.actor?.getFlag(MODULE_NAME, 'minions')) return;
    console.debug(`${MODULE_NAME} | pf2e.startTurn`, ...args);

    const minions = (combatant.actor.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
    if (minions.length > 0) createMinionsMessage(combatant, minions);
});

export async function createMinionsMessage(combatant: CombatantPF2e, uuids: string[]): Promise<Maybe<ChatMessage>> {
    if (!combatant.token?.actor) return null;
    const { token } = combatant;

    let minions = await Promise.all(
        uuids.map(async uuid => {
            const [, sceneId, , id] = uuid.split('.');
            if (sceneId !== combatant.sceneId) return;

            const minion = canvas.tokens.get(id);
            if (!minion) return;

            return {
                uuid: uuid,
                name: minion.document.name,
                img: minion.document.texture.src,
                type: minion.document.flags[MODULE_NAME].type,
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
        flags: {
            [MODULE_NAME]: {
                type: 'minions-card',
                master: token.uuid,
                minions,
            },
        },
    };
    const isNPCEvent = !token.actor?.hasPlayerOwner;
    if (isNPCEvent) messageSource.whisper = ChatMessage.getWhisperRecipients('GM').map(u => u.id);

    return await ChatMessage.create(messageSource);
}