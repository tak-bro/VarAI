import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, filter, from, map, of, scan, tap } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';


import { AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { extraPrompt, generateDefaultPrompt } from '../../utils/prompt.js';
import { DONE, UNDONE, toObservable } from '../../utils/utils.js';

export interface AnthropicServiceError extends AIServiceError {
    error?: {
        error?: {
            message?: string;
        };
    };
}

export class AnthropicService extends AIService {
    private anthropic: Anthropic;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#AE5630',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Anthropic]');
        this.errorPrefix = chalk.red.bold(`[Anthropic]`);
        this.anthropic = new Anthropic({ apiKey: this.params.config.ANTHROPIC_KEY });
    }

    generateVariableName$(): Observable<ReactiveListChoice> {
        // TODO: add below
        // if (isStream) {
        //     return this.generateStreamVariable$();
        // }

        return fromPromise(this.generateMessage()).pipe(
            concatMap(messages => from(messages)),
            map(message => ({
                name: `${this.serviceName} ${message}`,
                value: message,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(): Promise<string[]> {
        try {
            const userInput = this.params.userInput;
            const { language, generate, prompt: additionalPrompt, logging } = this.params.config;
            const maxLength = this.params.config['max-length'];

            const defaultPrompt = generateDefaultPrompt(language, maxLength, additionalPrompt);
            const systemPrompt = `${defaultPrompt}\n${extraPrompt(generate)}`;

            const params: Anthropic.MessageCreateParams = {
                max_tokens: this.params.config['max-tokens'],
                temperature: this.params.config.temperature,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userInput,
                    },
                ],
                model: this.params.config.ANTHROPIC_MODEL,
            };
            const result: Anthropic.Message = await this.anthropic.messages.create(params);
            const completion = result.content.map(({ text }) => text).join('');
            logging && createLogResponse('Anthropic', userInput, systemPrompt, completion);
            return deduplicateMessages(this.sanitizeMessage(completion, generate));
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    handleError$ = (anthropicError: AnthropicServiceError) => {
        const simpleMessage = anthropicError.error?.error?.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    generateStreamVariable$(): Observable<ReactiveListChoice> {
        return this.generateStreamChoice$().pipe(
            scan((acc: ReactiveListChoice[], data: ReactiveListChoice) => {
                const isDone = data.description === DONE;
                if (isDone) {
                    const messages = deduplicateMessages(this.sanitizeMessage(data.value, this.params.config.generate));

                    // TODO: refactor below
                    const userInput = this.params.userInput;
                    const { language, generate, prompt: additionalPrompt, logging } = this.params.config;
                    const maxLength = this.params.config['max-length'];
                    const defaultPrompt = generateDefaultPrompt(language, maxLength, additionalPrompt);
                    const systemPrompt = `${defaultPrompt}\n${extraPrompt(generate)}`;
                    logging && createLogResponse('Anthropic', userInput, systemPrompt, data.value);

                    const isFailedExtract = !messages || messages.length === 0;
                    if (isFailedExtract) {
                        return [
                            {
                                id: `${this.params.keyName}_${DONE}_0`,
                                name: `${this.serviceName} Failed to extract messages from response`,
                                value: `Failed to extract messages from response`,
                                isError: true,
                                description: DONE,
                                disabled: true,
                            },
                        ];
                    }
                    return messages.map((message, index) => {
                        return {
                            id: `${this.params.keyName}_${DONE}_${index}`,
                            name: `${this.serviceName} ${message}`,
                            value: `${message}`,
                            isError: false,
                            description: DONE,
                            disabled: false,
                        };
                    });
                }
                // if has origin data
                const originData = acc.find((origin: ReactiveListChoice) => origin.id === data.id);
                if (originData) {
                    return [...acc.map((origin: ReactiveListChoice) => (data.id === origin.id ? data : origin))];
                }
                // init
                return [{ ...data }];
            }, []),
            concatMap(messages => messages), // flat messages
            catchError(this.handleError$)
        );
    }

    generateStreamChoice$ = (): Observable<ReactiveListChoice> => {
        const userInput = this.params.userInput;
        const { language, generate, prompt: additionalPrompt } = this.params.config;
        const maxLength = this.params.config['max-length'];

        const defaultPrompt = generateDefaultPrompt(language, maxLength, additionalPrompt);
        const systemPrompt = `${defaultPrompt}\n${extraPrompt(generate)}`;

        const params: Anthropic.MessageCreateParams = {
            max_tokens: this.params.config['max-tokens'],
            temperature: this.params.config.temperature,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userInput,
                },
            ],
            model: this.params.config.ANTHROPIC_MODEL,
            stream: true,
        };

        // NOTE: refer https://docs.anthropic.com/claude/reference/messages-streaming
        const anthropicStream = this.anthropic.messages.create(params) as any as Promise<AsyncGenerator<Anthropic.MessageStreamEvent>>;

        let allValue = '';
        return from(toObservable(anthropicStream)).pipe(
            filter((streamEvent: Anthropic.MessageStreamEvent) => ['content_block_delta', 'message_stop'].includes(streamEvent.type)),
            map(
                (streamEvent: Anthropic.MessageStreamEvent) => streamEvent as Anthropic.ContentBlockDeltaEvent | Anthropic.MessageStopEvent
            ),
            tap(streamEvent => {
                if (streamEvent.type === 'content_block_delta') {
                    allValue += streamEvent.delta.text;
                }
            }),
            map((streamEvent: Anthropic.ContentBlockDeltaEvent | Anthropic.MessageStopEvent) => {
                const isDone = streamEvent.type === 'message_stop';
                return {
                    id: this.params.keyName,
                    name: `${this.serviceName} ${allValue}`,
                    value: `${allValue}`,
                    isError: false,
                    description: isDone ? DONE : UNDONE,
                    disabled: !isDone,
                };
            })
        );
    };
}
