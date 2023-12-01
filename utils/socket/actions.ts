import { SOCKET_NAME } from '../../src/constants.ts';
import { handlers } from '../../src/module/socket.ts';

export function dispatch<T extends string = string, P = void>(data: ActionData<T, P>) {
    const handler = handlers.get(data.type);
    if (game.user.isGM) handler?.(data.payload);
    else game.socket.emit(SOCKET_NAME, data);
}

export type Action<T extends string = string> = {
    type: T;
};
export type PrepareAction<P> = (...args: any[]) => { payload: P };

export interface ActionData<T extends string = string, P = void> {
    type: T;
    payload: P;
}

export interface SimpleActionCreator<T extends string = string, P = void, Args extends any[] = any[]> {
    type: T;
    (...args: Args): ActionData<T, P>;
    match: (action: Action<string>) => action is ActionData<T, P>;
}

export function createAction<PA extends PrepareAction<any>, T extends string = string>(
    type: T,
    prepareAction: PA,
    handler?: (payload: ReturnType<PA>['payload']) => void
): SimpleActionCreator<T, ReturnType<PA>['payload'], Parameters<PA>> {
    function actionCreator(...args: Parameters<PA>) {
        let prepared = prepareAction(...args);
        if (!prepared) {
            throw new Error('prepareAction did not return an object');
        }

        return {
            type,
            payload: prepared.payload,
        };
    }

    handler && handlers.set(type, handler);

    actionCreator.toString = () => `${type}`;
    actionCreator.type = type;
    actionCreator.match = (action: Action<string>): action is ActionData<ReturnType<PA>['payload'], T> =>
        action.type === type;

    return actionCreator;
}
