/// <reference types="vite/client" />
/// <reference types="../types/game" />
/// <reference types="../types/modules/wrapgate" />

type Unpacked<T> = T extends (infer R)[] ? R : never;
