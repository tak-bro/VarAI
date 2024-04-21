import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, from, mergeMap, of } from 'rxjs';

import { AIServiceFactory } from '../services/ai/ai-service.factory.js';
import { AIServiceParams, AIType, ApiKeyName } from '../services/ai/ai.service.js';
import { AnthropicService } from '../services/ai/anthropic.service.js';
import { ClovaXService } from '../services/ai/clova-x.service.js';
import { GeminiService } from '../services/ai/gemini.service.js';
import { HuggingService } from '../services/ai/hugging.service.js';
import { MistralService } from '../services/ai/mistral.service.js';
import { OllamaService } from '../services/ai/ollama.service.js';
import { OpenAIService } from '../services/ai/openai.service.js';
import { ValidConfig } from '../utils/config.js';

export class AIRequestManager {
    constructor(
        private readonly config: ValidConfig,
        private readonly userInput: string
    ) {}

    createAIRequests$(availableKeyNames: ApiKeyName[]): Observable<ReactiveListChoice> {
        return from(availableKeyNames).pipe(
            mergeMap(ai => {
                const params: AIServiceParams = {
                    config: this.config,
                    userInput: this.userInput,
                    keyName: ai,
                };
                switch (ai) {
                    case AIType.OPEN_AI:
                        return AIServiceFactory.create(OpenAIService, params).generateVariableName$();
                    case AIType.GEMINI:
                        return AIServiceFactory.create(GeminiService, params).generateVariableName$();
                    case AIType.ANTHROPIC:
                        return AIServiceFactory.create(AnthropicService, params).generateVariableName$();
                    case AIType.HUGGING:
                        return AIServiceFactory.create(HuggingService, params).generateVariableName$();
                    case AIType.CLOVA_X:
                        return AIServiceFactory.create(ClovaXService, params).generateVariableName$();
                    case AIType.MISTRAL:
                        return AIServiceFactory.create(MistralService, params).generateVariableName$();
                    case AIType.OLLAMA:
                        return AIServiceFactory.create(OllamaService, params).generateVariableName$();
                    default:
                        const prefixError = chalk.red.bold(`[${ai}]`);
                        return of({
                            name: prefixError + ' Invalid AI type',
                            value: 'Invalid AI type',
                            isError: true,
                            disabled: true,
                        });
                }
            })
        );
    }
}
