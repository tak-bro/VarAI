import chalk from 'chalk';
import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListChoice, ReactiveListLoader } from 'inquirer-reactive-list-prompt';
import { BehaviorSubject, ReplaySubject } from 'rxjs';

import { DONE, sortByDisabled } from '../utils/utils.js';

const defaultLoader = {
    isLoading: false,
    startOption: {
        text: 'AI is generating variable names',
    },
};

const emptyMessage = `No variable names were generated`;

export const varAIprompt = `varAIPrompt`;

export class ReactivePromptManager {
    private choices$: BehaviorSubject<ChoiceItem[]> = new BehaviorSubject<ChoiceItem[]>([]);
    private loader$: BehaviorSubject<ReactiveListLoader> = new BehaviorSubject<ReactiveListLoader>(defaultLoader);
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

    constructor() {}

    initPrompt() {
        inquirer.registerPrompt('reactiveListPrompt', ReactiveListPrompt);
        return inquirer.prompt({
            type: 'reactiveListPrompt',
            name: varAIprompt,
            message: 'Pick a variable name to use: ',
            emptyMessage: `⚠ ${emptyMessage}`,
            choices$: this.choices$,
            loader$: this.loader$,
            loop: false,
        });
    }

    startLoader() {
        this.loader$.next({ isLoading: true });
    }

    refreshChoices(choice: ReactiveListChoice) {
        const { value, isError } = choice;
        if (!choice || !value) {
            return;
        }
        const isNotStream = !choice.id;
        if (isNotStream) {
            this.choices$.next([...this.currentChoices, choice].sort(sortByDisabled));
            return;
        }

        this.checkStreamChoice(choice);
    }

    checkErrorOnChoices() {
        const isAllError = this.choices$
            .getValue()
            .map(choice => choice as ReactiveListChoice)
            .every(value => value?.isError || value?.disabled);

        if (isAllError) {
            this.alertNoGenerated();
            this.logEmptyMessage();
            process.exit(1);
            return;
        }
        this.stopLoaderOnSuccess();
    }

    completeSubject() {
        this.choices$.complete();
        this.loader$.complete();
        this.destroyed$.next(true);
        this.destroyed$.complete();
    }

    private alertNoGenerated() {
        this.loader$.next({
            isLoading: false,
            message: emptyMessage,
            stopOption: {
                doneFrame: '⚠', // '✖'
                color: 'yellow', // 'red'
            },
        });
    }

    private stopLoaderOnSuccess() {
        this.loader$.next({ isLoading: false, message: 'Variable names generated' });
    }

    private logEmptyMessage() {
        console.log(`${chalk.bold.yellow('⚠')} ${chalk.yellow(`${emptyMessage}`)}`);
    }

    private checkStreamChoice(choice: ReactiveListChoice) {
        const isDone = choice.description === DONE;
        if (isDone) {
            const findOriginChoice = this.currentChoices.find(origin => {
                const originId = origin.id || '';
                const hasNumber = /\d/.test(originId);
                return choice.id?.includes(originId) && !hasNumber;
            });
            if (findOriginChoice) {
                this.choices$.next(
                    [...this.currentChoices.filter(origin => origin.id !== findOriginChoice.id), choice].sort(sortByDisabled)
                );
                return;
            }
            this.choices$.next([...this.currentChoices, choice].sort(sortByDisabled));
            return;
        }

        // isUndone
        const origin = this.currentChoices.find(origin => origin?.id === choice.id);
        if (origin) {
            this.choices$.next(this.currentChoices.map(origin => (origin?.id === choice.id ? choice : origin)).sort(sortByDisabled));
            return;
        }
        this.choices$.next([...this.currentChoices, choice].sort(sortByDisabled));
    }

    private get currentChoices(): ReactiveListChoice[] {
        return this.choices$.getValue().map(origin => origin as ReactiveListChoice);
    }
}
