import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Ollama } from 'ollama';
import { Observable, catchError, concatMap, from, map, of, scan, switchMap, tap } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';


import { AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { DEFAULT_OLLMA_HOST } from '../../utils/config.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { extraPrompt, generateDefaultPrompt } from '../../utils/prompt.js';
import { DONE, UNDONE, toObservable } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

import type { ChatResponse } from 'ollama/src/interfaces.js';

export interface OllamaServiceError extends AIServiceError {}

export class OllamaService extends AIService {
    private host = DEFAULT_OLLMA_HOST;
    private model = '';
    private ollama: Ollama;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#FFF',
            secondary: '#000',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Ollama]');
        this.errorPrefix = chalk.red.bold(`[Ollama]`);
        this.model = this.params.config.OLLAMA_MODEL;
        this.host = this.params.config.OLLAMA_HOST || DEFAULT_OLLMA_HOST;
        this.ollama = new Ollama({ host: this.host });
    }

    generateVariableName$(): Observable<ReactiveListChoice> {
        if (this.params.config.OLLAMA_STREAM) {
            return this.generateStreamVariableName$();
        }

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

    handleError$ = (error: OllamaServiceError) => {
        if (!!error.response && error.response.data?.error) {
            return of({
                name: `${this.errorPrefix} ${error.response.data?.error}`,
                value: error.response.data?.error,
                isError: true,
                disabled: true,
            });
        }
        const simpleMessage = error.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    generateStreamChoice$ = (): Observable<ReactiveListChoice> => {
        const defaultPrompt = generateDefaultPrompt(
            this.params.config.language,
            this.params.config['max-length'],
            this.params.config.prompt
        );
        const systemContent = `${defaultPrompt}\n${extraPrompt(this.params.config.generate)}`;

        const promiseAsyncGenerator: Promise<AsyncGenerator<ChatResponse>> = this.ollama.chat({
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: systemContent,
                },
                {
                    role: 'user',
                    content: this.params.userInput,
                },
            ],
            options: {
                temperature: this.params.config.temperature,
            },
            stream: true,
        });

        let allValue = '';
        return from(toObservable(promiseAsyncGenerator)).pipe(
            tap((part: ChatResponse) => (allValue += part.message.content)),
            map((part: ChatResponse) => {
                return {
                    id: this.params.keyName,
                    name: `${this.serviceName} ${allValue}`,
                    value: `${allValue}`,
                    isError: false,
                    description: part.done ? DONE : UNDONE,
                    disabled: !part.done,
                };
            })
        );
    };

    generateStreamVariableName$(): Observable<ReactiveListChoice> {
        return fromPromise(this.checkIsAvailableOllama()).pipe(
            switchMap(() => this.generateStreamChoice$()),
            scan((acc: ReactiveListChoice[], data: ReactiveListChoice) => {
                const isDone = data.description === DONE;
                if (isDone) {
                    const { generate, logging } = this.params.config;
                    if (logging) {
                        const systemPrompt = this.createSystemPrompt();
                        createLogResponse('Ollama', this.params.userInput, systemPrompt, data.value);
                    }
                    const messages = deduplicateMessages(this.sanitizeMessage(data.value, generate));
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

    private async generateMessage(): Promise<string[]> {
        try {
            await this.checkIsAvailableOllama();
            const chatResponse = await this.createChatCompletions();

            const { generate, logging } = this.params.config;
            const systemPrompt = this.createSystemPrompt();
            logging && createLogResponse('Ollama', this.params.userInput, systemPrompt, chatResponse);

            return deduplicateMessages(this.sanitizeMessage(chatResponse, generate));
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private async checkIsAvailableOllama() {
        try {
            const response = await new HttpRequestBuilder({
                method: 'GET',
                baseURL: `${this.host}`,
                timeout: this.params.config.OLLAMA_TIMEOUT,
            }).execute();

            return response.data;
        } catch (e: any) {
            if (e.code === 'ECONNREFUSED') {
                throw new KnownError(`Error connecting to ${this.host}. Please run Ollama or check host`);
            }
            throw e;
        }
    }

    private async createChatCompletions() {
        const systemPrompt = this.createSystemPrompt();
        const response = await this.ollama.chat({
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: this.params.userInput,
                },
            ],
            stream: false,
            options: {
                temperature: this.params.config.temperature,
            },
        });
        return response.message.content;
    }

    private createSystemPrompt() {
        const defaultPrompt = generateDefaultPrompt(
            this.params.config.language,
            this.params.config['max-length'],
            this.params.config.prompt
        );
        return `${defaultPrompt}\n${extraPrompt(this.params.config.generate)}`;
    }
}
