import { PACKAGE_ID } from '../../constants.ts';
import { registerTemplates } from '../../scripts/register-templates.ts';
import { Log, Logger, VERBOSITY, generateChoices } from '../logger.ts';
import { setupSocket } from '../socket.ts';

Hooks.once('init', async function () {
    Log.always('Init');

    // Register stuff with the Foundry client
    registerTemplates();

    game.settings.register(PACKAGE_ID, 'log-verbosity', {
        name: `${PACKAGE_ID}.Settings.Verbosity.Name`,
        hint: `${PACKAGE_ID}.Settings.Verbosity.Hint`,
        default: VERBOSITY.WARNING,
        type: Number,
        choices: generateChoices(),
        scope: 'client',
        config: true,
        onChange: () => Logger.init(true),
    });

    Log.always('Logger.init');
    Logger.init(true);
    (globalThis as any).Logger = Logger;
    (globalThis as any).Log = Log;
});

Hooks.once('ready', async function () {
    Log.always('Ready');
    setupSocket();
});
