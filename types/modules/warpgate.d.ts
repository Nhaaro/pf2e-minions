export {};

declare global {
    /**
     * @global
     * @summary Top level (global) symbol providing access to all Warp Gate API functions
     * @static
     * @namespace warpgate
     * @property {warpgate.CONST} CONST
     * @property {warpgate.EVENT} EVENT
     * @property {warpgate.USERS} USERS
     * @borrows api._spawn as spawn
     * @borrows api._spawnAt as spawnAt
     * @borrows Gateway.dismissSpawn as dismiss
     * @borrows Mutator.mutate as mutate
     * @borrows Mutator.revertMutation as revert
     * @borrows MODULE.wait as wait
     * @borrows MODULE.buttonDialog as buttonDialog
     * @borrows MODULE.menu as menu
     */
    var warpgate: {
        spawn: api._spawn;
        spawnAt: api._spawnAt;
        /**
         * Deletes the specified token from the specified scene. This function allows anyone
         * to delete any specified token unless this functionality is restricted to only
         * owned tokens in Warp Gate's module settings. This is the same function called
         * by the "Dismiss" header button on owned actor sheets.
         *
         * @param {string} tokenId
         * @param {string} [sceneId = canvas.scene.id] Needed if the dismissed token does not reside
         *  on the currently viewed scene
         * @param {string} [onBehalf = game.user.id] Impersonate another user making this request
         */
        dismiss: (tokenId: string, scene: string = canvas.scene.id, onBehalf: string = game.user.id) => Promise<void>;
        mutate: mutate;
        revert: revertMutation;
        /**
         * Factory method for creating a new mutation stack class from
         * the provided token document
         *
         * @memberof warpgate
         * @static
         * @param {TokenDocument} tokenDoc
         * @return {MutationStack} Locked instance of a token actor's mutation stack.
         *
         * @see {@link MutationStack}
         */
        mutationStack: (tokenDoc) => MutationStack;
        wait: MODULE.wait;
        menu: MODULE.menu;
        buttonDialog: MODULE.buttonDialog;
        /**
         * @summary Utility functions for common queries and operations
         * @namespace
         * @alias warpgate.util
         * @borrows MODULE.firstGM as firstGM
         * @borrows MODULE.isFirstGM as isFirstGM
         * @borrows MODULE.firstOwner as firstOwner
         * @borrows MODULE.isFirstOwner as isFirstOwner
         */
        util: {
            firstGM: MODULE.firstGM;
            isFirstGM: MODULE.isFirstGM;
            firstOwner: MODULE.firstOwner;
            isFirstOwner: MODULE.isFirstOwner;
        };

        /**
         * @summary Crosshairs methods
         * @namespace
         * @alias warpgate.crosshairs
         * @borrows Gateway.showCrosshairs as show
         * @borrows Crosshairs.getTag as getTag
         * @borrows Gateway.collectPlaceables as collect
         */
        crosshairs: {
            show: showCrosshairs;
            getTag: Crosshairs.getTag;
            collect: collectPlaceables;
        };
        /**
         * @summary Methods intended for warp gate "pylons" (e.g. Warp Gate-dependent modules)
         * @namespace
         * @alias warpgate.plugin
         * @borrows api._notice as notice
         * @borrows Mutator.batchMutate as batchMutate
         * @borrows Mutator.batchRevert as batchRevert
         * @borrows RingGenerator as RingGenerator
         */
        plugin: {
            queueUpdate;
            notice: api._notice;
            batchMutate;
            batchRevert;
            RingGenerator;
        };
        /**
         * @summary Helper functions related to grid-centric canvas operations
         * @namespace
         * @alias warpgate.grid
         * @borrows highlightRing as highlightRing
         */
        grid: {
            highlightRing;
        };
        /**
         * @summary System specific helpers
         * @namespace
         * @private
         * @alias warpgate.dnd5e
         * @prop {Function} rollItem
         * @borrows Gateway._rollItemGetLevel as rollItem
         */
        get dnd5e(): {
            rollItem: _rollItemGetLevel;
        };
        /**
         * @description Constants and enums for use in embedded shorthand fields
         * @alias warpgate.CONST
         * @readonly
         * @enum {string}
         */
        CONST: {
            /** Instructs warpgate to delete the identified embedded document. Used in place of the update or create data objects. */
            DELETE: 'delete';
        };
        /**
         * @description Helper enums for retrieving user IDs
         * @alias warpgate.USERS
         * @readonly
         * @enum {Array<string>}
         * @property {Array<string>} ALL All online users
         * @property {Array<string>} SELF The current user
         * @property {Array<string>} GM All online GMs
         * @property {Array<string>} PLAYERS All online players (non-gms)
         */
        USERS: {
            /** All online users */
            get ALL();
            /** The current user */
            get SELF();
            /** All online GMs */
            get GM();
            /** All online players */
            get PLAYERS();
        };
        /**
         *
         * The following table describes the stock event type payloads that are broadcast during {@link warpgate.event.notify}
         *
         * | Event | Payload | Notes |
         * | :-- | -- | -- |
         * | `<any>` | `{sceneId: string, userId: string}` | userId is the initiator |
         * | {@link warpgate.EVENT.PLACEMENT} | `{templateData: {@link CrosshairsData}|Object, tokenData: TokenData|String('omitted'), options: {@link WarpOptions}} | The final Crosshairs data used to spawn the token, and the final token data that will be spawned. There is no actor data provided. In the case of omitting raw data, `template` data will be of type `{x: number, y: number, size: number, cancelled: boolean}`  |
         * | SPAWN | `{uuid: string, updates: {@link Shorthand}|String('omitted'), options: {@link WarpOptions}|{@link SpawningOptions}, iteration: number}` | UUID of created token, updates applied to the token, options used for spawning, and iteration this token was spawned on.|
         * | DISMISS | `{actorData: {@link PackedActorData}|string}` | `actorData` is a customized version of `Actor#toObject` with its `token` field containing the actual token document data dismissed, instead of its prototype data. |
         * | MUTATE | `{uuid: string, updates: {@link Shorthand}, options: {@link WorkflowOptions} & {@link MutationOptions}` | UUID of modified token, updates applied to the token, options used for mutation. When raw data is omitted, `updates` will be `String('omitted')`|
         * | REVERT | `{uuid: string, updates: {@link Shorthand}, options: {@link WorkflowOptions}} | UUID is that of reverted token and updates applied to produce the final reverted state (or `String('omitted') if raw data is omitted). |
         * | REVERT\_RESPONSE | `{accepted: bool, tokenId: string, mutationId: string, options: {@link WorkflowOptions}` | Indicates acceptance/rejection of the remote revert request, including target identifiers and options |
         * | MUTATE\_RESPONSE | `{accepted: bool, tokenId: string, mutationId: string, options: {@link WorkflowOptions}` | `mutationId` is the name provided in `options.name` OR a randomly assigned ID if not provided. Callback functions provided for remote mutations will be internally converted to triggers for this event and do not need to be registered manually by the user. `accepted` is a bool field that indicates if the remote user accepted the mutation. |
         *
         * @description Event name constants for use with the {@link warpgate.event} system.
         * @alias warpgate.EVENT
         * @enum {string}
         */
        EVENT: {
            /** After placement is chosen */
            PLACEMENT: 'wg_placement';
            /** After each token has been spawned and fully updated */
            SPAWN: 'wg_spawn';
            /** After a token has been dismissed via warpgate */
            DISMISS: 'wg_dismiss';
            /** After a token has been fully reverted */
            REVERT: 'wg_revert';
            /** After a token has been fully modified */
            MUTATE: 'wg_mutate';
            /** Feedback of mutation acceptance/rejection from the remote owning player in
             * the case of an "unowned" or remote mutation operation
             */
            MUTATE_RESPONSE: 'wg_response_mutate';
            /** Feedback of mutation revert acceptance/rejection from the remote owning player in
             * the case of an "unowned" or remote mutation operation
             */
            REVERT_RESPONSE: 'wg_response_revert';
        };
        /**
         * Warp Gate includes a hook-like event system that can be used to respond to stages of the
         * spawning and mutation process. Additionally, the event system is exposed so that users
         * and module authors can create custom events in any context.
         *
         * @summary Event system API functions.
         * @see warpgate.event.notify
         *
         * @namespace
         * @alias warpgate.event
         * @borrows Events.watch as watch
         * @borrows Events.trigger as trigger
         * @borrows Events.remove as remove
         * @borrows Comms.notifyEvent as notify
         *
         */
        event: {
            watch: Events.watch;
            trigger: Events.trigger;
            remove: Events.remove;
            notify: notifyEvent;
        };
        /**
         * @summary Warp Gate classes suitable for extension
         * @namespace
         * @alias warpgate.abstract
         * @property {Crosshairs} Crosshairs
         * @property {MutationStack} MutationStack
         * @property {PlaceableFit} PlaceableFit
         */
        abstract: {
            Crosshairs;
            MutationStack;
            PlaceableFit;
        };
    };
}
