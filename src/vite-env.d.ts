/// <reference types="vite/client" />
/// <reference types="../types/game" />

type Unpacked<T> = T extends (infer R)[] ? R : never;

