export const generatePrompt = (userInput: string, language: string, maxLength: number, prompt: string) =>
    [
        'I need your assistance in generating suitable names for variables or classes in my code.',
        'I have some text that describes the functionality or role of a class/variable',
        `Here's the text:`,
        '',
        `${userInput}`,
        language ? `Code language: ${language}` : '',
        `Variable name must be a maximum of ${maxLength} characters`,
        'It could be a class name if the description represents the functionality of a class, or a variable name if it describes the purpose of a variable.',
        'Please ensure that the name is descriptive, intuitive, and aligns well with the provided description.',
        'Variable names should be nouns or noun phrases.',
        'Your input will be greatly appreciated in ensuring clarity and coherence in my code.',
        prompt,
    ]
        .filter(Boolean)
        .join('\n');
