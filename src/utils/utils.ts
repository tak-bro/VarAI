import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

export const getRandomNumber = (min: number, max: number): number => {
    const minValue = Math.ceil(min);
    const maxValue = Math.floor(max);
    return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
};

export async function* toObservable<T>(promiseAsyncGenerator: Promise<AsyncGenerator<T>>): AsyncGenerator<T> {
    const asyncGenerator = await promiseAsyncGenerator;
    for await (const value of asyncGenerator) {
        yield value;
    }
}

export const sortByDisabled = (a: ReactiveListChoice, b: ReactiveListChoice) => {
    if (a.disabled && !b.disabled) {
        return 1;
    }
    if (!a.disabled && b.disabled) {
        return -1;
    }
    return 0;
};

export const DONE = `done`;
export const UNDONE = `undone`;
