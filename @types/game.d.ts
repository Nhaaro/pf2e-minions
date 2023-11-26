import * as io from 'socket.io';
import { SocketData } from 'src/module.ts';
import { ActionData } from 'utils/socket/actions.ts';

type DistributiveOmit<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

interface ClientToServerEvents {
    'module.pf2e-minions': (data: ActionData<string, unknown>, userId?: string) => void;
}

declare global {
    interface Game<
        TActor extends Actor<null>,
        TActors extends Actors<TActor>,
        TChatMessage extends ChatMessage,
        TCombat extends Combat,
        TItem extends Item<null>,
        TMacro extends Macro,
        TScene extends Scene,
        TUser extends User
    > {
        /** A reference to the open Socket.io connection */
        socket: io.Socket<ClientToServerEvents>;
    }
}
