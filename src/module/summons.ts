import { CreaturePF2e, CreatureTrait } from '@actor/creature/index.js';
import { PrototypeTokenPF2e } from '@actor/data/base.js';
import { ActorPF2e, CharacterPF2e, NPCPF2e } from '@actor/index.js';
import { ConditionSource, ItemSourcePF2e } from '@item/base/data/index.js';
import { AbilityItemPF2e, ConditionPF2e, ItemPF2e, SpellPF2e } from '@item/index.js';
import { MeasuredTemplatePF2e } from '@module/canvas/measured-template.js';
import { FlatModifierRuleElement } from '@module/rules/rule-element/flat-modifier.js';
import { ScenePF2e, TokenDocumentPF2e } from '@scene/index.js';
import { MODULE_NAME } from 'src/constants.ts';
import { isConditionData, isConditionDocument } from 'src/lib/lib.ts';

type location = { x: number; y: number };
type sourceData = {
    amount: number;
    creatureActor: { docType: 'DocWrapper'; document: string };
    flags: {
        item?:
            | (SpellPF2e<ActorPF2e<TokenDocumentPF2e<ScenePF2e>>> & { type: 'spell' })
            | (AbilityItemPF2e<ActorPF2e<TokenDocumentPF2e<ScenePF2e>>> & { type: 'action' });
    };
    location: MeasuredTemplatePF2e;
    noAnimation: boolean;
    player: string;
    sceneId: string;
    summonerTokenDocument: TokenDocumentPF2e<ScenePF2e>;
    updates: {};
    userId: string;
};
type updates<Actor extends CreaturePF2e | NPCPF2e = CreaturePF2e | NPCPF2e> = {
    actor: DeepPartial<Actor> & { flags: DocumentFlags };
    token: DeepPartial<PrototypeTokenPF2e<Actor>> & { flags: DocumentFlags };
};

Hooks.on('fs-preSummon', async (...args) => {
    const [{ updates, sourceData }] = args as [
        {
            location: location;
            updates: updates;
            sourceData: sourceData;
        }
    ];

    if (!(sourceData.flags.item && sourceData.summonerTokenDocument)) return;
    console.group(`${MODULE_NAME} | fs-preSummon`, ...args);

    const item = sourceData?.flags?.item;
    const master = (await fromUuid(`Actor.${sourceData?.summonerTokenDocument?.actorId}`)) as ActorPF2e<
        TokenDocumentPF2e<ScenePF2e>
    >;

    if (!master) {
        console.warn(`${MODULE_NAME} | Minions can only be tracked with a master`);
        console.groupEnd();
        return;
    }
    if (!item) {
        console.warn(`${MODULE_NAME} | Summons can only be tracked from spells or actions`);
        console.groupEnd();
        return;
    }

    if (updates.token.sight) updates.token.sight.enabled = true;

    const tokenFlags = (updates.token.flags[MODULE_NAME] ??= {});
    const actorFlags = (updates.actor.flags[MODULE_NAME] ??= {});
    console.debug(`${MODULE_NAME} | module flags`, { tokenFlags, actorFlags });
    tokenFlags.master = master.id;
    tokenFlags.item = item.sourceId;

    const character = JSON.parse(sourceData.creatureActor.document) as
        | (CharacterPF2e & { type: 'character' })
        | (NPCPF2e & { type: 'npc' });
    if (character.type === 'character' && character.class?.name === 'Eidolon') tokenFlags.type = 'eidolon';

    if (item.type === 'spell') {
        actorFlags.rank = item.rank;
        actorFlags.spellDC = master.attributes.spellDC;

        if (item.system.duration.value.includes('sustain')) tokenFlags.type = 'sustained';

        const actorTraits = updates.actor.system?.traits?.value;
        if (actorTraits && !(['minion', 'eidolon'] as CreatureTrait[]).some(trait => actorTraits.includes(trait))) {
            actorTraits.push('summoned');
            actorTraits.push('minion');
        }
    }

    console.groupEnd();
});

Hooks.on('createItem', async (...args) => {
    // for some reason type differs from what shows up in console
    const [document] = args as [document: ItemPF2e, options: object, userId: string];
    if (!isConditionDocument(document)) return;
    console.group(`${MODULE_NAME} | preCreateItem`, ...args);

    await updateSpellDC(document);

    console.groupEnd();
});
Hooks.on('updateItem', async (...args) => {
    const [document, change] = args as [
        document: ItemPF2e,
        change: DeepPartial<ItemSourcePF2e>,
        options: object,
        userId: string
    ];
    if (!(isConditionDocument(document) && isConditionData(document, change))) return;
    console.group(`${MODULE_NAME} | preUpdateItem`, ...args);

    await updateSpellDC(document, change);

    console.groupEnd();
});
Hooks.on('deleteItem', async (...args) => {
    const [document] = args as [document: ItemPF2e, options: object, userId: string];
    if (!isConditionDocument(document)) return;
    console.group(`${MODULE_NAME} | preDeleteItem`, ...args);

    await updateSpellDC(document);

    console.groupEnd();
});
async function updateSpellDC(document: ConditionPF2e, change?: DeepPartial<ConditionSource>) {
    if (!document.actor?.getFlag(MODULE_NAME, 'minions')) {
        console.info(`${MODULE_NAME} | No minions, skipping...`);
        console.groupEnd();
        return;
    }

    if (
        document.rules.find(rule =>
            (rule as FlatModifierRuleElement).selector.find(selector => ['all', 'spell-dc'].includes(selector))
        ) && change
            ? change?.system?.value?.value
            : true
    ) {
        const minions = (document.actor?.getFlag(MODULE_NAME, 'minions') as string[]) ?? [];
        console.group(`${MODULE_NAME} | Cascading master changes`, minions);
        minions.forEach(async uuid => {
            const minion = await fromUuid<TokenDocumentPF2e>(uuid);
            if (!(minion?.getFlag(MODULE_NAME, 'type') === 'sustained')) return;
            console.debug(`${MODULE_NAME} | Minion`, uuid, minion, minion.flags[MODULE_NAME]);

            minion.actor?.setFlag(MODULE_NAME, 'spellDC', document.actor?.system.attributes.spellDC);
        });
        console.groupEnd();
    }
}
