export const generateDefaultPrompt = (language: string, maxLength: number, additionalPrompt: string = '') =>
    [
        'You are the expert programmer, you are going to provide a professional variable names.',
        'Generate suitable names for variables in code for the following description with the given specifications below:',
        language ? `Code language: ${language}` : '',
        `Each variable name must be a maximum of ${maxLength} characters`,
        'Variable names should be nouns or noun phrases.',
        'Please ensure that the name is descriptive, intuitive, and aligns well with the provided description.',
        additionalPrompt ? `${additionalPrompt}` : '',
    ]
        .filter(Boolean)
        .join('\n');

export const extraPrompt = (generate: number) =>
    `You must generate suitable ${generate} variable names in numbered list format without any explanation.`;
