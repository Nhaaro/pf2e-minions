import { MODULE_NAME } from '../../constants.ts';
import { registerTemplates } from '../../scripts/register-templates.ts';
import { setupSocket } from '../socket.ts';

Hooks.once('init', async function () {
    // Register stuff with the Foundry client
    registerTemplates();
});

Hooks.once('ready', async function () {
    console.log(`${MODULE_NAME} | Ready`);
    setupSocket();
});
