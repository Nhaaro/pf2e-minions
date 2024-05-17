import { CreaturePF2e, CreatureTrait } from '@actor/creature/index.js';
import { PrototypeTokenPF2e } from '@actor/data/base.js';
import { ActorPF2e } from '@actor/index.js';
import { ConditionSource, ItemSourcePF2e } from '@item/base/data/index.js';
import { ConditionPF2e, ItemPF2e } from '@item/index.js';
import { MeasuredTemplatePF2e } from '@module/canvas/measured-template.js';
import { FlatModifierRuleElement } from '@module/rules/rule-element/flat-modifier.js';
import { ScenePF2e, TokenDocumentPF2e } from '@scene/index.js';
import { PACKAGE_ID } from '../../constants.ts';
import { isCharacterDocument, isConditionData, isConditionDocument, isSpellDocument } from '../utils.ts';
import { Log } from '~module/logger.ts';

type location = { x: number; y: number };
type sourceData = {
    amount: number;
    creatureActor: { docType: 'DocWrapper'; document: string };
    flags: { item?: ItemPF2e };
    location: MeasuredTemplatePF2e;
    noAnimation: boolean;
    player: string;
    sceneId: string;
    summonerTokenDocument: TokenDocumentPF2e<ScenePF2e>;
    updates: {};
    userId: string;
};
type updates = {
    actor: DeepPartial<ActorPF2e> & { flags: DocumentFlags };
    token: DeepPartial<PrototypeTokenPF2e<ActorPF2e>> & { flags: DocumentFlags };
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
    Log.group('fs-preSummon', ...args);

    const item = sourceData?.flags?.item;
    const master = game.actors.get(sourceData.summonerTokenDocument.actorId || '');

    if (!master) {
        Log.warn('Minions can only be tracked with a master');
        Log.groupEnd();
        return;
    }
    if (!item) {
        Log.warn('Summons can only be tracked from spells or actions');
        Log.groupEnd();
        return;
    }

    if (updates.token.sight) updates.token.sight.enabled = true;

    const tokenFlags = (updates.token.flags[PACKAGE_ID] ??= {});
    const actorFlags = (updates.actor.flags[PACKAGE_ID] ??= {});
    Log.debug('module flags', { tokenFlags, actorFlags });
    tokenFlags.master = master.id;
    tokenFlags.item = item.sourceId;
    tokenFlags.commanded = true;

    const creature = JSON.parse(sourceData.creatureActor.document) as CreaturePF2e;
    if (isCharacterDocument(creature) && creature.class?.name === 'Eidolon') tokenFlags.type = 'eidolon';

    if (isSpellDocument(item)) {
        actorFlags.rank = item.rank;
        actorFlags.spellDC = master.attributes.spellDC;

        if (item.system.duration.sustained) tokenFlags.type = 'sustained';

        const actorTraits = updates.actor.system?.traits?.value;
        if (actorTraits && !(['minion', 'eidolon'] as CreatureTrait[]).some(trait => actorTraits.includes(trait))) {
            actorTraits.push('summoned');
            actorTraits.push('minion');
        }
    }

    Log.groupEnd();
});

Hooks.on('createItem', async (...args) => {
    // for some reason type differs from what shows up in console
    const [document] = args as [document: ItemPF2e, options: object, userId: string];
    if (!isConditionDocument(document)) return;
    Log.group('createItem', ...args);

    await updateSpellDC(document);

    Log.groupEnd();
});
Hooks.on('updateItem', async (...args) => {
    const [document, change] = args as [
        document: ItemPF2e,
        change: DeepPartial<ItemSourcePF2e>,
        options: object,
        userId: string
    ];
    if (!(isConditionDocument(document) && isConditionData(document, change))) return;
    Log.group('updateItem', ...args);

    await updateSpellDC(document, change);

    Log.groupEnd();
});
Hooks.on('deleteItem', async (...args) => {
    const [document] = args as [document: ItemPF2e, options: object, userId: string];
    if (!isConditionDocument(document)) return;
    Log.group('deleteItem', ...args);

    await updateSpellDC(document);

    Log.groupEnd();
});
async function updateSpellDC(document: ConditionPF2e, change?: DeepPartial<ConditionSource>) {
    if (!game.user.isGM) return;
    if (!document.actor?.getFlag(PACKAGE_ID, 'minions')) {
        Log.info('No minions, skipping...');
        Log.groupEnd();
        return;
    }

    if (
        document.rules.find(rule =>
            (rule as FlatModifierRuleElement).selector?.find(selector => ['all', 'spell-dc'].includes(selector))
        ) && change
            ? change?.system?.value?.value
            : true
    ) {
        const minionsUuid = (document.actor?.getFlag(PACKAGE_ID, 'minions') as string[]) ?? [];
        Log.group('Cascading master changes', minionsUuid);
        minionsUuid.forEach(async uuid => {
            const [, , , id] = uuid.split('.');
            const minion = canvas.tokens.get(id);

            if (!(minion?.document?.getFlag(PACKAGE_ID, 'type') === 'sustained')) return;
            Log.debug('Minion', uuid, minion, minion.document.flags[PACKAGE_ID]);

            await minion.actor?.setFlag(PACKAGE_ID, 'spellDC', document.actor?.system.attributes.spellDC);
        });
        Log.groupEnd();
    }
}
