import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { ValidConfig } from '../../utils/config.js';
import { generatePrompt } from '../../utils/prompt.js';
import { extractNumberedList } from '../../utils/utils.js';

// NOTE: get AI Type from key names
export const AIType = {
    OPEN_AI: 'OPENAI_KEY',
    GEMINI: 'GEMINI_KEY',
    ANTHROPIC: 'ANTHROPIC_KEY',
    HUGGING: 'HUGGING_COOKIE',
    CLOVA_X: 'CLOVAX_COOKIE',
    MISTRAL: 'MISTRAL_KEY',
    OLLAMA: 'OLLAMA_MODEL',
} as const;
export type ApiKeyName = (typeof AIType)[keyof typeof AIType];
export const ApiKeyNames: ApiKeyName[] = Object.values(AIType).map(value => value);

export interface AIServiceParams {
    config: ValidConfig;
    userInput: string;
    keyName: ApiKeyName;
}

export interface AIServiceError extends Error {
    response?: any;
}

export interface Theme {
    primary: string;
    [key: string]: string;
}

export abstract class AIService {
    protected serviceName: string;
    protected errorPrefix: string;
    protected colors: Theme;

    protected constructor(params: AIServiceParams) {
        this.serviceName = 'AI';
        this.errorPrefix = 'ERROR';
        this.colors = {
            primary: '',
        };
    }

    abstract generateVariableName$(): Observable<ReactiveListChoice>;

    protected buildPrompt(userInput: string, language: string, completions: number, maxLength: number, prompt: string) {
        const defaultPrompt = generatePrompt(userInput, language, maxLength, prompt);
        return `${defaultPrompt}\nPlease just generate ${completions} variable names in numbered list format without any explanation.`;
    }

    protected handleError$ = (error: AIServiceError): Observable<ReactiveListChoice> => {
        let simpleMessage = 'An error occurred';
        if (error.message) {
            simpleMessage = error.message;
        }
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    protected sanitizeMessage(generatedText: string, maxCount: number) {
        return extractNumberedList(generatedText)
            .map((message: string) => message.trim().replace(/^\d+\.\s/, ''))
            .map((message: string) => message.replace(/`/g, ''))
            .filter((message: string) => !!message);
    }
}
