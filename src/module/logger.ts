import chalk from 'chalk';
import { MODULE_NAME, PACKAGE_ID } from '~constants';

export enum VERBOSITY {
    'ZERO' = 0,
    'TRACE' = 100,
    'DEBUG' = 200,
    'INFO' = 300,
    'WARNING' = 400,
    'ERROR' = 500,
    'CRITICAL' = Number.MAX_SAFE_INTEGER - 1,
    'ALWAYS' = Number.MAX_SAFE_INTEGER,
}

const VERBOSITY_ALIASES_MAP = {
    NEVER: VERBOSITY.ZERO,
    ALL: VERBOSITY.ZERO,
    WARN: VERBOSITY.WARNING,
};

export function generateChoices(): { [key: number]: string } {
    const choices: { [key: number]: string } = {};
    // Add entries from the VERBOSITY enum
    for (const [level, value] of Object.entries(VERBOSITY)) {
        if (typeof value === 'number' && ![VERBOSITY.ALWAYS, VERBOSITY.CRITICAL].includes(value)) {
            choices[value] = game.i18n.localize(`${PACKAGE_ID}.Settings.Verbosity.Choices.${level}`);
        }
    }

    // Add entries from the VERBOSITY_ALIASES_MAP
    for (const [alias, value] of Object.entries(VERBOSITY_ALIASES_MAP)) {
        if (typeof value === 'number') {
            choices[value] = game.i18n.localize(`${PACKAGE_ID}.Settings.Verbosity.Choices.${alias}`);
        }
    }
    return choices;
}

const VERBOSITY_CONSOLE_MAP: { [key: number]: [Console, keyof Console] } = {
    [VERBOSITY.ZERO]: [console, 'debug'],
    [VERBOSITY.TRACE]: [console, 'debug'],
    [VERBOSITY.DEBUG]: [console, 'debug'],
    [VERBOSITY.INFO]: [console, 'info'],
    [VERBOSITY.WARNING]: [console, 'warn'],
    [VERBOSITY.ERROR]: [console, 'error'],
    [VERBOSITY.CRITICAL]: [console, 'error'],
    [VERBOSITY.ALWAYS]: [console, 'log'],
};

const VERBOSITY_LEVEL_MAP = {
    never: VERBOSITY.ZERO,
    trace: VERBOSITY.TRACE,
    debug: VERBOSITY.DEBUG,
    info: VERBOSITY.INFO,
    log: VERBOSITY.INFO,
    warning: VERBOSITY.WARNING,
    warn: VERBOSITY.WARNING,
    error: VERBOSITY.ERROR,
    critical: VERBOSITY.CRITICAL,
    always: VERBOSITY.ALWAYS,
};

let CURRENT_VERBOSITY: number = VERBOSITY.WARNING; // Initialize the current verbosity

export const Log: Record<keyof typeof VERBOSITY_LEVEL_MAP, (...args: any[]) => void> & {
    group: Console['group'];
    groupCollapsed: Console['groupCollapsed'];
    groupEnd: Console['groupEnd'];
} = {} as any;
function generate_console_aliases() {
    try {
        Log.group = console.group.bind(Log.group, Logger.prefix());
        Log.groupCollapsed = console.groupCollapsed.bind(Log.groupCollapsed, Logger.prefix());
        Log.groupEnd = console.groupEnd.bind(Log.groupEnd);

        for (const key in VERBOSITY_LEVEL_MAP) {
            const verbosity = VERBOSITY_LEVEL_MAP[key as keyof typeof VERBOSITY_LEVEL_MAP];
            const fn = Logger.fn(verbosity);

            // Default logging function, logs or does nothing depending on enabled verbosity
            Log[key as keyof typeof VERBOSITY_LEVEL_MAP] = fn ?? (() => {});
        }
    } catch (error) {
        throw new Error(`${Logger.prefix()} | Unable to generate aliases | ${error}`);
    }
}

export class Logger {
    /** Common prefix for all log messages */
    static prefixBase = chalk.bold(`${MODULE_NAME}`);

    static get verbosity(): number {
        // Note: This default value is only used until we hook to Hook.once('init')
        return CURRENT_VERBOSITY ?? VERBOSITY.WARNING;
    }

    static set verbosity(in_value: number | keyof typeof VERBOSITY) {
        try {
            let value: number;

            // Determine if the input is a number or a VERBOSITY key
            if (typeof in_value === 'number') {
                value = in_value;
            } else {
                value = VERBOSITY[in_value];
            }

            // Sanity check types
            if (value === undefined || !Number.isInteger(value)) {
                throw new Error(
                    `Parameter 'in_value' must be a 'VERBOSITY' enum value or an integer, but got '${in_value}'.`
                );
            }

            // Store verbosity
            CURRENT_VERBOSITY = value;

            // We generate the logging methods statically any time the verbosity changes in order to:
            // 1. Log with the highest performance possible (no need to dynamically check verbosity)
            // 2. Not affect the log file/line from the caller that is shown in the JS console
            generate_console_aliases();
        } catch (error) {
            throw new Error(`${Logger.prefix()} | verbosity | ${error}`);
        }
    }

    /**
     * Returns the common prefix for all log messages, optionally colored to signal the severity
     */
    static prefix(color = chalk.blue) {
        return `${color(this.prefixBase)} |`;
    }

    static init(force = false) {
        try {
            // We do nothing if the verbosity is already set, unless forced
            if (!force && CURRENT_VERBOSITY !== undefined && CURRENT_VERBOSITY !== null) return;

            // Grab verbosity from settings
            const value = game.settings.get(PACKAGE_ID, 'log-verbosity') as number;

            // We do nothing if the setting is null/undefined
            if (value === undefined || value === null) return;

            // Use try-catch in case something goes wrong, as this method runs in critical code paths...
            console.debug(Logger.prefix(), 'setting verbosity level to', value);
            this.verbosity = value;
        } catch (e) {
            console.error(Logger.prefix(), `Unable to set logging verbosity.\n`, e);
        }
    }

    static enabled(verbosity: VERBOSITY | keyof typeof VERBOSITY) {
        try {
            let verbosity_level: number;

            // Determine if the input is a number or a VERBOSITY key
            if (typeof verbosity === 'number') {
                verbosity_level = verbosity;
            } else {
                verbosity_level = VERBOSITY[verbosity];
            }

            return verbosity_level >= this.verbosity;
        } catch (error) {
            throw new Error(`${Logger.prefix()} | enabled | ${error}`);
        }
    }

    static fn(verbosity: VERBOSITY, fn_verbosity = verbosity): ((...args: any[]) => void) | null {
        try {
            if (!this.enabled(verbosity)) return null;

            const [consoleObj, method] = VERBOSITY_CONSOLE_MAP[fn_verbosity];
            const consoleMethod = consoleObj[method] as (...args: any[]) => void;
            return consoleMethod.bind(consoleObj, this.prefix());
        } catch (error) {
            throw new Error(`${Logger.prefix()} | fn | ${error}`);
        }
    }
}

generate_console_aliases();

Logger.init(true);

Object.seal(Logger);
Object.seal(Log);