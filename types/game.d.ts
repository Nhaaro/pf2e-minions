import * as io from 'socket.io';
import { ActionData } from 'utils/socket/actions.ts';
import { ClassDCData } from '@actor/character/data.js';

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

declare module '@actor/data/base.js' {
    interface ActorAttributesSource {
        /** Used for saves related to class abilities */
        classDC: ClassDCData | null | { value: number };
        /** The best spell DC, used for certain saves related to feats */
        spellDC: { rank?: number; value: number } | null;
        /** The higher between highest spellcasting DC and (if present) class DC */
        classOrSpellDC: { rank?: number; value: number };
    }
}
