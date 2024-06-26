import { cli } from 'cleye';

import configCommand from './commands/config.js';
import varAI from './commands/varai.js';
import { description, version } from '../package.json';

const rawArgv = process.argv.slice(2);

cli(
    {
        name: 'VarAI',
        version,
        flags: {
            message: {
                type: String,
                description: `Message that represents the user's request or instruction to AI (Required)`,
                alias: 'm',
            },
            language: {
                type: String,
                description: 'Code Language to use for the generated variables',
                alias: 'l',
            },
            generate: {
                type: Number,
                description: 'Number of variable names to generate (Warning: generating multiple costs more) (default: 3)',
                alias: 'g',
            },
            clipboard: {
                type: Boolean,
                description: 'Copy the selected name to the clipboard (default: true)',
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
        varAI(argv.flags.message, argv.flags.language, argv.flags.generate, argv.flags.clipboard, argv.flags.prompt, rawArgv);
    },
    rawArgv
);
