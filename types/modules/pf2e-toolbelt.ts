const characterShareOptions = ['health', 'turn', 'skills', 'hero', 'weapon', 'armor'] as const;
const npcShareOptions = ['health', 'turn', 'armor'] as const;

export type ConfigOption = (typeof characterShareOptions)[number];

export type ShareConfigFlags = { [k in ConfigOption]: boolean } & {
    master: string;
};

export default {
    characterShareOptions,
    npcShareOptions,
};

export function getShareConfig(document: object) {
    return foundry.utils.getProperty(document, `flags.pf2e-toolbelt.share.config`) as ShareConfigFlags | undefined;
}
