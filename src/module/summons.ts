import { CharacterSystemData } from '@actor/character/data.js';
import { ActorPF2e } from '@actor/index.js';
import { AbilityItemPF2e, SpellPF2e } from '@item/index.js';
import { MeasuredTemplatePF2e } from '@module/canvas/measured-template.js';
import { ScenePF2e, TokenDocumentPF2e } from '@scene/index.js';
import { MODULE_NAME } from 'src/constants.ts';

type location = { x: number; y: number };
type sourceData = {
    amount: number;
    creatureActor: unknown;
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
type updates = {
    actor: {
        system?: CharacterSystemData;
        flags: foundry.documents.ActorFlags & {
            warpgate: {
                control: {
                    actor: unknown;
                    user: string;
                };
            };
        };
    };
    token: DeepPartial<TokenDocumentPF2e> & { flags: DocumentFlags };
};

Hooks.on('fs-preSummon', async (...args) => {
    console.debug(`${MODULE_NAME} | fs-preSummon`, ...args);
    const { updates, sourceData } = args[0] as {
        location: location;
        updates: updates;
        sourceData: sourceData;
    };

    const item = sourceData?.flags?.item;
    const master = (await fromUuid(
        `Actor.${sourceData?.summonerTokenDocument?.actorId}`
    )) as ActorPF2e<TokenDocumentPF2e<ScenePF2e>>;

    if (!master) {
        console.warn(
            `${MODULE_NAME} | Minions can only be tracked with a master`
        );
        return;
    }
    if (!item) {
        console.warn(
            `${MODULE_NAME} | Summons can only be tracked from spells or actions`
        );
        return;
    }

    updates.token.flags[MODULE_NAME] ??= {};
    updates.token.flags[MODULE_NAME].master = master.id;

    if (updates.token.sight) updates.token.sight.enabled = true;

    if ('spellType' in item?.system) {
        updates.actor.system?.traits.value.push('summoned');
        updates.actor.system?.traits.value.push('minion');
    }
});
Hooks.on('fs-postSummon', async (...args) => {
    console.debug(`${MODULE_NAME} | fs-postSummon`, ...args);
    const { tokenDoc } = args[0] as {
        location: location;
        tokenDoc: TokenDocumentPF2e;
        updates: updates;
        iteration: number;
        sourceData: sourceData;
        animated: boolean;
    };

    const masterUuid = tokenDoc.getFlag(MODULE_NAME, 'master') as string;
    if (!masterUuid) {
        console.warn(`${MODULE_NAME} | Summon with no master, skipping...`);
        return;
    }

    const master = game.actors.get(masterUuid);
    if (!master) {
        ui.notifications.error(`${MODULE_NAME} | Invalid master`);
        return;
    }

    const summons = (master.getFlag(MODULE_NAME, 'summons') as string[]) ?? [];
    master.setFlag(MODULE_NAME, 'summons', [...summons, tokenDoc.uuid]);
});

Hooks.on('deleteToken', async (...args) => {
    console.debug(`${MODULE_NAME} | deleteToken`, ...args);
    const tokenDoc = args[0] as TokenDocumentPF2e<ScenePF2e>;

    const masterUuid = tokenDoc.getFlag(MODULE_NAME, 'master') as string;
    if (!masterUuid) {
        console.warn(`${MODULE_NAME} | Summon with no master, skipping...`);
        return;
    }

    const master = game.actors.get(masterUuid);
    if (!master) {
        ui.notifications.error(`${MODULE_NAME} | Invalid master`);
        return;
    }

    const summons = (master.getFlag(MODULE_NAME, 'summons') as string[]) ?? [];
    master.setFlag(
        MODULE_NAME,
        'summons',
        summons.filter(uuid => uuid != tokenDoc.uuid)
    );
});
