export const generatePrompt = (language: string, maxLength: number, additionalPrompt: string) =>
    [
        'Generate suitable names for variables in code for the following description with the given specifications below:',
        language ? `- Code language: ${language}` : '',
        `- Variable name must be a maximum of ${maxLength} characters`,
        '- Variable names should be nouns or noun phrases.',
        '- Please ensure that the name is descriptive, intuitive, and aligns well with the provided description.',
        additionalPrompt ? `- ${additionalPrompt}` : '',
    ]
        .filter(Boolean)
        .join('\n');
