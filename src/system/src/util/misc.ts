const wordCharacter = String.raw`[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
const nonWordCharacter = String.raw`[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
const nonWordCharacterRE = new RegExp(nonWordCharacter, 'gu');

const wordBoundary = String.raw`(?:${wordCharacter})(?=${nonWordCharacter})|(?:${nonWordCharacter})(?=${wordCharacter})`;
const nonWordBoundary = String.raw`(?:${wordCharacter})(?=${wordCharacter})`;
const lowerCaseLetter = String.raw`\p{Lowercase_Letter}`;
const upperCaseLetter = String.raw`\p{Uppercase_Letter}`;
const lowerCaseThenUpperCaseRE = new RegExp(`(${lowerCaseLetter})(${upperCaseLetter}${nonWordBoundary})`, 'gu');

const nonWordCharacterHyphenOrSpaceRE = /[^-\p{White_Space}\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]/gu;
const upperOrWordBoundariedLowerRE = new RegExp(`${upperCaseLetter}|(?:${wordBoundary})${lowerCaseLetter}`, 'gu');

/**
 * The system's sluggification algorithm for labels and other terms.
 * @param text The text to sluggify
 * @param [options.camel=null] The sluggification style to use
 */
function sluggify(text: string, { camel = null }: { camel?: SlugCamel } = {}): string {
    // Sanity check
    if (typeof text !== 'string') {
        console.warn('Non-string argument passed to `sluggify`');
        return '';
    }

    // A hyphen by its lonesome would be wiped: return it as-is
    if (text === '-') return text;

    switch (camel) {
        case null:
            return text
                .replace(lowerCaseThenUpperCaseRE, '$1-$2')
                .toLowerCase()
                .replace(/['’]/g, '')
                .replace(nonWordCharacterRE, ' ')
                .trim()
                .replace(/[-\s]+/g, '-');
        case 'bactrian': {
            const dromedary = sluggify(text, { camel: 'dromedary' });
            return dromedary.charAt(0).toUpperCase() + dromedary.slice(1);
        }
        case 'dromedary':
            return text
                .replace(nonWordCharacterHyphenOrSpaceRE, '')
                .replace(/[-_]+/g, ' ')
                .replace(upperOrWordBoundariedLowerRE, (part, index) =>
                    index === 0 ? part.toLowerCase() : part.toUpperCase()
                )
                .replace(/\s+/g, '');
        default:
            throw ErrorPF2e("I don't think that's a real camel.");
    }
}

type SlugCamel = 'dromedary' | 'bactrian' | null;

function ErrorPF2e(message: string): Error {
    return Error(`PF2e System | ${message}`);
}

/** Localizes a list of strings into a (possibly comma-delimited) list for the current language */
function localizeList(items: string[], { conjunction = 'or' }: { conjunction?: 'and' | 'or' } = {}): string {
    items = [...items].sort((a, b) => a.localeCompare(b, game.i18n.lang));
    const parts = conjunction === 'or' ? 'PF2E.ListPartsOr' : 'PF2E.ListPartsAnd';

    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) {
        return game.i18n.format(`${parts}.two`, { first: items[0], second: items[1] });
    }

    let result = game.i18n.format(`${parts}.start`, { first: items[0], second: '{second}' });
    for (let i = 1; i <= items.length - 2; i++) {
        if (i === items.length - 2) {
            const end = game.i18n.format(`${parts}.end`, { first: items[i], second: items[items.length - 1] });
            result = result.replace('{second}', end);
        } else {
            const newSegment = game.i18n.format(`${parts}.middle`, { first: items[i], second: '{second}' });
            result = result.replace('{second}', newSegment);
        }
    }

    return result;
}

/** Generate and return an HTML element for a FontAwesome icon */
type FontAwesomeStyle = 'solid' | 'regular' | 'duotone';

function fontAwesomeIcon(
    glyph: string,
    { style = 'solid', fixedWidth = false }: { style?: FontAwesomeStyle; fixedWidth?: boolean } = {}
): HTMLElement {
    const styleClass = `fa-${style}`;
    const glyphClass = glyph.startsWith('fa-') ? glyph : `fa-${glyph}`;
    const icon = document.createElement('i');
    icon.classList.add(styleClass, glyphClass);
    if (fixedWidth) icon.classList.add('fa-fw');

    return icon;
}

export { fontAwesomeIcon, localizeList, sluggify };
