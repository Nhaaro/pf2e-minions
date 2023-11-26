import { MODULE_NAME } from 'src/constants.ts';

export const registerHooks = () => {
    console.debug(`${MODULE_NAME} | registerHooks`);
    import('./socket.ts');
    import('./summons.ts');
    import('./familiar.ts');

    import('./canvas.ts');

    import('./encounter.ts');
};
