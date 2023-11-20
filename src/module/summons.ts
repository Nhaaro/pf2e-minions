import { CreaturePF2e, CreatureTrait } from '@actor/creature/index.js';
import { PrototypeTokenPF2e } from '@actor/data/base.js';
import { ActorPF2e, CharacterPF2e, NPCPF2e } from '@actor/index.js';
import { AbilityItemPF2e, SpellPF2e } from '@item/index.js';
import { MeasuredTemplatePF2e } from '@module/canvas/measured-template.js';
import { ScenePF2e, TokenDocumentPF2e } from '@scene/index.js';
import { MODULE_NAME } from 'src/constants.ts';

type location = { x: number; y: number };
type sourceData = {
    amount: number;
    creatureActor: { docType: 'DocWrapper'; document: string };
    flags: {
        item?:
            | SpellPF2e<ActorPF2e<TokenDocumentPF2e<ScenePF2e>>>
            | AbilityItemPF2e<ActorPF2e<TokenDocumentPF2e<ScenePF2e>>>;
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
    actor: DeepPartial<Actor>;
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
    console.debug(`${MODULE_NAME} | tokenFlags`, tokenFlags);
    tokenFlags.master = master.id;
    tokenFlags.item = item.sourceId;

    const character = JSON.parse(sourceData.creatureActor.document) as
        | (CharacterPF2e & { type: 'character' })
        | (NPCPF2e & { type: 'npc' });
    if (character.type === 'character' && character.class?.name === 'Eidolon') tokenFlags.type = 'eidolon';

    if ('duration' in item.system && item.system.duration.value.includes('sustain')) tokenFlags.type = 'sustained';

    const actorTraits = updates.actor.system?.traits?.value;
    if (actorTraits && !(['minion', 'eidolon'] as CreatureTrait[]).some(trait => actorTraits.includes(trait))) {
        actorTraits.push('summoned');
        actorTraits.push('minion');
    }
    console.groupEnd();
});
