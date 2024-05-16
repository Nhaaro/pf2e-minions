import { PACKAGE_ID } from '~constants';
import { Log } from '~module/logger.ts';

const moduleTemplates = {
    [PACKAGE_ID]: {
        minions: `modules/${PACKAGE_ID}/templates/minions.hbs`,
        sidebar: {
            combatTracker: {
                minions: `modules/${PACKAGE_ID}/templates/sidebar/combat-tracker/minions.hbs`,
            },
        },
        chat: {
            card: {
                notSustained: `modules/${PACKAGE_ID}/templates/chat/not-sustained-card.hbs`,
            },
        },
    },
};
const systemTemplates = {
    pf2e: {
        chat: {
            card: {
                action: 'systems/pf2e/templates/chat/action-card.hbs',
                affliction: 'systems/pf2e/templates/chat/affliction-card.hbs',
                armor: 'systems/pf2e/templates/chat/armor-card.hbs',
                backpack: 'systems/pf2e/templates/chat/backpack-card.hbs',
                campaign: 'systems/pf2e/templates/chat/campaign-feature-card.hbs',
                condition: 'systems/pf2e/templates/chat/condition-card.hbs',
                consumable: 'systems/pf2e/templates/chat/consumable-card.hbs',
                effect: 'systems/pf2e/templates/chat/effect-card.hbs',
                equipment: 'systems/pf2e/templates/chat/equipment-card.hbs',
                feat: 'systems/pf2e/templates/chat/feat-card.hbs',
                melee: 'systems/pf2e/templates/chat/melee-card.hbs',
                spell: 'systems/pf2e/templates/chat/spell-card.hbs',
                strike: 'systems/pf2e/templates/chat/strike-card.hbs',
                treasure: 'systems/pf2e/templates/chat/treasure-card.hbs',
                weapon: 'systems/pf2e/templates/chat/weapon-card.hbs',
            },
        },
    },
};

export const TEMPLATES = {
    ...moduleTemplates,
    ...systemTemplates,
};

/** Register Handlebars template partials */
export function registerTemplates(): void {
    function* flattenObject(obj: Record<string, unknown>, path: string[] = []): Generator<string> {
        for (const [key, value] of Object.entries(obj)) {
            const newPath = path.concat(key);
            if (typeof value === 'string') {
                yield value;
                Log.always('Retrieved and compiled template', value);
            } else if (typeof value === 'object') {
                yield* flattenObject(value as typeof obj, newPath);
            }
        }
    }

    const flattenedTemplates = [...flattenObject(moduleTemplates)];
    loadTemplates(flattenedTemplates);
}
