import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ReactivePromptManager } from '../managers/reactive-prompt.manager.js';
import { ApiKeyName, ApiKeyNames } from '../services/ai/ai.service.js';
import { getConfig } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';

const consoleManager = new ConsoleManager();

export default async (
    message: string | undefined,
    locale: string | undefined,
    generate: number | undefined,
    useClipboard: boolean,
    prompt: string | undefined,
    rawArgv: string[]
) =>
    (async () => {
        consoleManager.printTitle();

        if (!message) {
            throw new KnownError(
                'Message option is required. Please provide a message using the `--message` or `-m` flag to generate a variable name.'
            );
        }

        const { env } = process;
        const config = await getConfig({
            OPENAI_KEY: env.OPENAI_KEY || env.OPENAI_API_KEY,
            OPENAI_MODEL: env.OPENAI_MODEL || env['openai-model'] || env['openai_model'],
            OPENAI_URL: env.OPENAI_URL || env['openai-url'] || env['OPENAI_URL'],
            GEMINI_KEY: env.GEMINI_KEY || env.GEMINI_API_KEY,
            GEMINI_MODEL: env.GEMINI_MODEL || env['gemini-model'] || env['gemini_model'],
            ANTHROPIC_KEY: env.ANTHROPIC_KEY || env.ANTHROPIC_API_KEY,
            ANTHROPIC_MODEL: env.ANTHROPIC_MODEL || env['anthropic-model'] || env['anthropic_model'],
            HUGGING_COOKIE: env.HUGGING_COOKIE || env.HUGGING_API_KEY || env.HF_TOKEN,
            HUGGING_MODEL: env.HUGGING_MODEL || env['hugging-model'],
            CLOVAX_COOKIE: env.CLOVAX_COOKIE || env.CLOVA_X_COOKIE,
            proxy: env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
            temperature: env.temperature,
            generate: generate?.toString() || env.generate,
            locale: locale?.toString() || env.locale,
            prompt: prompt?.toString() || env.prompt,
        });

        const availableAPIKeyNames: ApiKeyName[] = Object.entries(config)
            .filter(([key]) => ApiKeyNames.includes(key as ApiKeyName))
            .filter(([_, value]) => !!value)
            .map(([key]) => key as ApiKeyName);

        const hasNoAvailableAIs = availableAPIKeyNames.length === 0;
        if (hasNoAvailableAIs) {
            throw new KnownError('Please set at least one API key via `varai config set OPENAI_KEY=<your token>`');
        }

        const aiRequestManager = new AIRequestManager(config, message);
        const reactivePromptManager = new ReactivePromptManager();
        const selectPrompt = reactivePromptManager.initPrompt();

        reactivePromptManager.startLoader();
        const subscription = aiRequestManager.createAIRequests$(availableAPIKeyNames).subscribe(
            (choice: ReactiveListChoice) => reactivePromptManager.refreshChoices(choice),
            () => {
                /* empty */
            },
            () => reactivePromptManager.checkErrorOnChoices()
        );
        const answer = await selectPrompt;
        subscription.unsubscribe();
        reactivePromptManager.completeSubject();

        // NOTE: reactiveListPrompt has 2 blank lines
        consoleManager.moveCursorUp();

        const chosenMessage = answer.varAIPrompt?.value;
        if (!chosenMessage) {
            throw new KnownError('An error occurred! No selected name');
        }

        if (useClipboard) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ncp = require('copy-paste');
            ncp.copy(chosenMessage);
            consoleManager.printCopied();
            process.exit();
        }

        consoleManager.printNoCopiedName();
        process.exit();
    })().catch(error => {
        consoleManager.printErrorMessage(error.message);
        handleCliError(error);
        process.exit(1);
    });
