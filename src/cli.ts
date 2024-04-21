import { cli } from 'cleye';

import configCommand from './commands/config.js';
import varAI from './commands/varai.js';
import { description, version } from '../package.json';

const rawArgv = process.argv.slice(2);

cli(
    {
        name: 'VarAI',
        version,
        /**
         * Since this is a wrapper around `git commit`,
         * flags should not overlap with it
         * https://git-scm.com/docs/git-commit
         */
        flags: {
            message: {
                type: String,
                description: `Message that represents the user's request or instruction to AI (Required)`,
                alias: 'm',
            },
            locale: {
                type: String,
                description: 'Locale to use for the generated variable names (default: en)',
                alias: 'l',
            },
            generate: {
                type: Number,
                description: 'Number of variable names to generate (Warning: generating multiple costs more) (default: 3)',
                alias: 'g',
            },
            clipboard: {
                type: Boolean,
                description: 'Copy the selected name to the clipboard',
                alias: 'c',
                default: true,
            },
            prompt: {
                type: String,
                description: 'Additional prompt to let users fine-tune provided prompt',
                alias: 'p',
            },
        },

        commands: [configCommand],

        help: {
            description,
        },

        ignoreArgv: type => type === 'unknown-flag' || type === 'argument',
    },
    argv => {
        varAI(argv.flags.message, argv.flags.locale, argv.flags.generate, argv.flags.clipboard, argv.flags.prompt, rawArgv);
    },
    rawArgv
);
