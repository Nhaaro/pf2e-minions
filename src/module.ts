import '../utils/vite/hmr.ts';
import './styles/module.css';

import { MODULE_NAME } from 'src/constants.ts';
import { registerTemplates } from './scripts/register-templates.ts';
import { registerHooks } from './module/index.ts';
import { actionHandler } from './module/chat.ts';

type Action<Action extends string, Callback extends (() => unknown) | undefined = undefined> = Callback extends Function
    ? {
          action: Action;
          callback: Callback;
      }
    : {
          action: Action;
      };
export interface ActionRequest extends Action<'commandHandler', () => void> {
    nativeEvent: DeepPartial<MouseEvent> & Pick<MouseEvent, 'shiftKey'>;
    messageId: string;
    minionUuid?: string;
}

export type SocketPayload = ActionRequest;

Hooks.once('init', async function () {
    // Register stuff with the Foundry client
    registerTemplates();
    registerHooks();
});

Hooks.once('ready', async function () {
    console.log(`${MODULE_NAME} | Ready`);

    game.socket.on(`module.${MODULE_NAME}`, async ({ action, ...payload }, callback) => {
        switch (action) {
            case 'commandHandler':
                await actionHandler(payload);
                break;
            default:
                console.groupCollapsed(`${MODULE_NAME}::${action}`);
                console.log(payload);
                console.groupEnd();
                break;
        }
    });
});
