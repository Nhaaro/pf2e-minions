import { SOCKET_NAME } from '../constants.ts';
import { Log } from './logger.ts';

declare global {
    interface Module {
        handlers?: Map<string, Function>;
    }
}
export const handlers = (globalThis.pf2eMinions.handlers ??= new Map<string, Function>());

export type SocketData = ReturnType<(typeof handlers)['values']>['return'];

export const setupSocket = () => {
    Log.debug('setup socket');
    game.socket.on(SOCKET_NAME, async (data, userId) => {
        const handler = handlers.get(data.type);
        if (handler) {
            handler(data.payload);
        } else {
            Log.groupCollapsed(`${data.type}::`, userId);
            Log.always(data.payload);
            Log.groupEnd();
        }
    });
};
