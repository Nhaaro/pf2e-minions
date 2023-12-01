import { ActorSourcePF2e, CharacterSource, FamiliarSource } from '@actor/data/index.js';
import { ActorPF2e, CharacterPF2e, FamiliarPF2e } from '@actor/index.js';
import { AbilityItemSource, ConditionSource, ItemSourcePF2e, SpellSource } from '@item/base/data/index.js';
import { AbilityItemPF2e, ConditionPF2e, ItemPF2e, SpellPF2e } from '@item/index.js';

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
export function isCharacterDocument(document: ActorPF2e): document is CharacterPF2e {
    return document.type === 'familiar';
}
export function isCharacterData(
    document: ActorPF2e,
    _data: DeepPartial<ActorSourcePF2e>
): _data is DeepPartial<CharacterSource> {
    return document.type === 'familiar';
}
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
export function isActionDocument(document: ItemPF2e): document is AbilityItemPF2e {
    return document.type === 'action';
}
export function isActionData(
    document: ItemPF2e,
    _data: DeepPartial<ItemSourcePF2e>
): _data is DeepPartial<AbilityItemSource> {
    return document.type === 'action';
}
export function isConditionDocument(document: ItemPF2e): document is ConditionPF2e {
    return document.type === 'condition';
}
export function isConditionData(
    document: ItemPF2e,
    _data: DeepPartial<ItemSourcePF2e>
): _data is DeepPartial<ConditionSource> {
    return document.type === 'condition';
}
export function isSpellDocument(document: ItemPF2e): document is SpellPF2e {
    return document.type === 'spell';
}
export function isSpellData(document: ItemPF2e, _data: DeepPartial<ItemSourcePF2e>): _data is DeepPartial<SpellSource> {
    return document.type === 'spell';
}