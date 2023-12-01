import { MODULE_NAME, SOCKET_NAME } from '../constants.ts';

declare global {
    interface Module {
        handlers?: Map<string, Function>;
    }
}
export const handlers = (globalThis.pf2eMinions.handlers ??= new Map<string, Function>());

export type SocketData = ReturnType<(typeof handlers)['values']>['return'];

export const setupSocket = () => {
    console.debug(`${MODULE_NAME} | setup socket`);
    game.socket.on(SOCKET_NAME, async (data, userId) => {
        const handler = handlers.get(data.type);
        if (handler) {
            handler(data.payload);
        } else {
            console.groupCollapsed(`${MODULE_NAME}::${data.type}`, userId);
            console.log(data.payload);
            console.groupEnd();
        }
    });
};
