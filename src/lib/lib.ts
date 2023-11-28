import { ActorSourcePF2e, FamiliarSource } from '@actor/data/index.js';
import { ActorPF2e, FamiliarPF2e } from '@actor/index.js';
import { ConditionSource, ItemSourcePF2e } from '@item/base/data/index.js';
import { ConditionPF2e, ItemPF2e } from '@item/index.js';

const actorTypes = ['character', 'npc', 'hazard', 'loot', 'familiar', 'vehicle'];
const itemTypes = [
    'action',
    'ancestry',
    'armor',
    'background',
    'backpack',
    'campaignFeature',
    'class',
    'condition',
    'consumable',
    'deity',
    'effect',
    'equipment',
    'feat',
    'formula',
    'heritage',
    'kit',
    'lore',
    'martial',
    'melee',
    'spell',
    'spellcastingEntry',
    'status',
    'treasure',
    'weapon',
];

type CompendiumSource = CompendiumDocument['_source'];

// Generics
export const isActorData = (docSource: CompendiumSource): docSource is ActorSourcePF2e => {
    return 'type' in docSource && actorTypes.includes(docSource.type);
};
export const isItemData = (docSource: CompendiumSource): docSource is ItemSourcePF2e => {
    return 'type' in docSource && itemTypes.includes(docSource.type);
};

// Actors
export function isFamiliarDocument(document: ActorPF2e): document is FamiliarPF2e {
    return document.type === 'familiar';
}
export function isFamiliarData(
    document: ActorPF2e,
    _data: DeepPartial<ActorSourcePF2e>
): _data is DeepPartial<FamiliarSource> {
    return document.type === 'familiar';
}

// Items
export function isConditionDocument(document: ItemPF2e): document is ConditionPF2e {
    return document.type === 'condition';
}
export function isConditionData(
    document: ItemPF2e,
    _data: DeepPartial<ItemSourcePF2e>
): _data is DeepPartial<ConditionSource> {
    return document.type === 'condition';
}
