module.exports = {
    root: true,                                                             // root directory
    env: {
        browser: true,                                                      // define browser global variables
        es6: true,                                                          // ES6 environment
        mocha: true,                                                        // define Mocha testing global variables
    },
    parser: '@typescript-eslint/parser',

    parserOptions: {
        ecmaVersion: 2018,                                                  // Allows for the parsing of modern ECMAScript features
        sourceType: 'module',                                               // Allows for the use of imports
        ecmaFeatures: { 'jsx': true },                                      // Parse JSX
    },
    plugins: ['@typescript-eslint'],
    ignorePatterns: ['**/*.js', '**/*.map', '**/*.html', '**/*.ccxml', '**/*.json'],  // ignore all js files, .map files -> only lint ts files
    extends: [
        'eslint:recommended',                                               // enables a subset of core rules from eslint
        'plugin:@typescript-eslint/eslint-recommended',                     // eslint compatibility ruleset for typescript override
        'plugin:@typescript-eslint/recommended',  // enables the recommended rules from typescript plugin
    ],
    rules: {
        // ESLint Styling
        'semi-style': ['warn', 'last'],                                     // Semicolons at the end of the line
        'semi-spacing': 'warn',                                             // No spacing before semicolon
        'no-trailing-spaces': 'warn',                                       // Remove whitespace after a line
        'object-property-newline': ['warn', { 'allowAllPropertiesOnSameLine': true }], // properties can be all on the same line
        'template-curly-spacing': ['warn', 'never'],                       // Requires one or more spaces inside of the curly brace pair brace pair.
        'keyword-spacing': 'warn',                                          // Enforce consistent spacing before and after keywords
        'key-spacing': 'warn',                                              // Spacing for keys in objects
        // 'spaced-comment': ['warn', 'always', { 'block': { 'balanced': true } }], // Whitespace after // or /* , whitespace before and after comment in block
        'object-curly-spacing': ['warn', 'always'],                         //enforce consistent space inside braces
        'comma-spacing': ['warn', { 'before': false, 'after': true }],      // comma spacing in grouped data (ie [a, b, c, d]), no space before one space after the comma
        'brace-style': 'off',                                               // eslint off for typescript override
        'indent': 'off',                                                    // eslint off for typescript override
        'quotes': 'off',                                                    // eslint off for typescript override
        'semi': 'off',                                                      // eslint off for typescript override
        'no-extra-semi': 'off',                                             // eslint off for typescript override

        // ESLint Best Practices
        'eqeqeq': ['error', 'always'],                                      // Require the use of `===` and `!==`
        'prefer-const': 'error',                                            // If a variable is never reassigned, using the const declaration is better.
        'no-console': 'error',                                              // Disallow the use of `console`
        'no-unused-vars': 'off',                                            // Checks only that local declared vars are used but will allow global vars to be unused.
        'no-duplicate-imports': 'error',                                    // Disallow duplicate imports


        // Typescript specific additional options or overrides
        '@typescript-eslint/brace-style': 'warn',                           // enforces 1tbs (one true brace style)
        '@typescript-eslint/indent': ['error', 4],                          // enforce 4 space to a indent
        '@typescript-eslint/quotes': ['error', 'single'],                   // Single quote usage only
        '@typescript-eslint/semi': ['error', 'always'],                     // Require semicolons
        '@typescript-eslint/explicit-function-return-type': 'off',          // ensures that the return value is assigned to a variable of the correct type
        '@typescript-eslint/no-inferrable-types': ['error', {
            'ignoreParameters': true,
            'ignoreProperties': true,                                       // disallows explicit type declarations on parameters, variables and properties where
        }],                                                                 // the type can be easily inferred
        '@typescript-eslint/interface-name-prefix': 'off',                  //  never prefixing interfaces with I
        // '@typescript-eslint/no-explicit-any': 'off',                     // doesn't allow any types to be defined
        '@typescript-eslint/no-namespace': ['off'],                         // suppress namespace warnings
        '@typescript-eslint/explicit-module-boundary-types': 'off',         // explicit return and argument types on exported functions' and classes' public class methods

        // GUI Composer overrides
        '@typescript-eslint/ban-ts-ignore': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
    }
}