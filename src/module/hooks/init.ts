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
        onChange: () => {
            try {
                Logger.init(true);
            } catch (e) {
                console.error(e);
            }
        },
    });
});

Hooks.once('ready', async function () {
    Log.always('Ready');
    setupSocket();
});
