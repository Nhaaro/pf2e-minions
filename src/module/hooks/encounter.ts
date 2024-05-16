import { CombatantPF2e, EncounterPF2e } from '@module/encounter/index.js';
import { PACKAGE_ID } from '../../constants.ts';
import { TEMPLATES } from '../../scripts/register-templates.ts';
import { TokenPF2e } from '@module/canvas/index.js';
import { ItemPF2e } from '@item/index.js';
import { transformTraits } from '../utils.ts';
import { ItemTrait } from '@item/base/data/system.js';
import { Log } from '~module/logger.ts';

Hooks.on('pf2e.startTurn', async (...args) => {
    const [combatant] = args as [combatant: CombatantPF2e, encounter: EncounterPF2e, userId: string];
    if (!combatant.actor?.getFlag(PACKAGE_ID, 'minions')) return;
    Log.group('pf2e.startTurn', ...args);

    const minionsUuid = (combatant.actor.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
    if (minionsUuid.length > 0) await createMinionsCard(combatant, minionsUuid);
    Log.groupEnd();
});

Hooks.on('pf2e.endTurn', async (...args) => {
    const [combatant] = args as [combatant: CombatantPF2e, encounter: EncounterPF2e, userId: string];
    if (!combatant.actor?.getFlag(PACKAGE_ID, 'minions')) return;
    Log.group('pf2e.endTurn', ...args);

    const minionsUuid = (combatant.actor.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
    for (const uuid of minionsUuid) {
        const [, sceneId, , id] = uuid.split('.');
        if (sceneId !== combatant.sceneId) return;

        const minionToken = canvas.tokens.get(id);
        if (!minionToken) {
            Log.error('No minion found', uuid);
            return;
        }

        const flags = minionToken.document.flags[PACKAGE_ID];
        if (flags?.type === 'sustained' && !flags.commanded) {
            await createNotSustainedCard(combatant, minionToken);
            await window?.warpgate?.dismiss(minionToken.id);
        }
    }

    Log.groupEnd();
});

export async function createMinionsCard(combatant: CombatantPF2e, uuids: string[]): Promise<Maybe<ChatMessage>> {
    if (!combatant.token?.actor) return null;
    const { token } = combatant;

    let minions = await Promise.all(
        uuids.map(async uuid => {
            const [, sceneId, , id] = uuid.split('.');
            if (sceneId !== combatant.sceneId) return;

            const minion = canvas.tokens.get(id);
            if (!minion) return;

            await minion.document.unsetFlag(PACKAGE_ID, 'commanded');

            return {
                uuid: uuid,
                name: minion.document.name,
                img: minion.document.texture.src,
                type: minion.document.flags[PACKAGE_ID].type,
                item: minion.document.flags[PACKAGE_ID].item,
            };
        })
    );
    minions = minions.filter(m => m);
    if (minions.length === 0) return null;

    const content = await renderTemplate(TEMPLATES['pf2e-minions'].minions, { minions, master: token.uuid });
    const messageSource: Partial<foundry.documents.ChatMessageSource> = {
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ token, actor: token.actor }),
        content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        flags: {
            [PACKAGE_ID]: {
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

async function createNotSustainedCard(combatant: CombatantPF2e, minionToken: TokenPF2e) {
    if (!combatant.token?.actor) return null;
    const { token: masterToken } = combatant;

    let item = await fromUuid<ItemPF2e>(minionToken.document.getFlag(PACKAGE_ID, 'item') as string);
    if (!item) {
        Log.error('No item found', minionToken.document);
        return;
    }

    item.system.traits.value;
    const template = TEMPLATES[PACKAGE_ID].chat.card.notSustained;
    const templateData = {
        master: masterToken.actorId,
        actor: minionToken.actor,
        token: minionToken.document.toObject(),
        item: {
            id: item.id,
            img: item.img,
            name: game.i18n.format(`${PACKAGE_ID}.Actions.NotSustained.Title`, { name: item.name }),
            description: game.i18n.format(`${PACKAGE_ID}.Actions.NotSustained.Description`),
        },
        data: {
            traits: minionToken.actor?.system.traits?.value
                ? transformTraits(minionToken.actor.system.traits.value as ItemTrait[])
                : [],
            properties: [game.i18n.format(`${PACKAGE_ID}.Minions`, { name: masterToken.name }), item.name],
        },
    };
    const chatData: Partial<foundry.documents.ChatMessageSource> = {
        // user: game.user.id,
        speaker: ChatMessage.getSpeaker({ token: minionToken.document, actor: minionToken.actor }),
        flags: {
            pf2e: {
                origin: item.getOriginData(),
            },
            [PACKAGE_ID]: {
                type: 'not-sustained-card',
                masterId: masterToken.actor?.id,
                minionId: minionToken.id,
            },
        },
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    };
    chatData.content = await renderTemplate(template, templateData);
    const isNPCEvent = !masterToken.actor?.hasPlayerOwner;
    if (isNPCEvent) chatData.whisper = ChatMessage.getWhisperRecipients('GM').map(u => u.id);

    return await ChatMessage.create(chatData);
}
