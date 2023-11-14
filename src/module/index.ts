import { MODULE_NAME } from 'src/constants.ts';

export const registerHooks = () => {
    console.debug(`${MODULE_NAME} | registerHooks`);
    import('./summons.ts');
};
