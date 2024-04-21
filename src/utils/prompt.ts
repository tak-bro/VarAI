export const generatePrompt = (userInput: string, locale: string, maxLength: number, prompt: string) =>
    [
        'Generate a variable name written in present tense for the following description with the given specifications below:',
        `Variable Description: ${userInput}`,
        `Message language: ${locale}`,
        `Variable name must be a maximum of ${maxLength} characters.`,
        'Please exclude anything unnecessary such as explanation.',
        prompt,
    ]
        .filter(Boolean)
        .join('\n');
