# Contributing to Store Review Monitor

Thank you for your interest in contributing to Store Review Monitor! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork and clone the repository:
```bash
git clone https://github.com/your-username/store-review-monitor.git
cd store-review-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Make your changes in the `src/` directory

4. Build the project:
```bash
npm run build
```

5. Package for distribution:
```bash
npm run package
```

## Project Structure

```
store-review-monitor/
├── src/
│   ├── index.ts              # Main entry point
│   ├── monitors/
│   │   ├── appStoreConnect.ts    # App Store Connect API integration
│   │   └── googlePlayConsole.ts  # Google Play Console API integration
│   ├── notifiers/
│   │   └── slack.ts          # Slack notification handler
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── dist/                     # Built output (committed for GitHub Actions)
├── action.yml                # GitHub Action definition
└── package.json
```

## Making Changes

1. Create a new branch for your feature or bugfix:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following these guidelines:
   - Write TypeScript code with proper typing
   - Follow the existing code style
   - Add comments for complex logic
   - Update tests if applicable

3. Build and test your changes:
```bash
npm run build
npm run package
```

4. Commit your changes:
```bash
git add .
git commit -m "Description of your changes"
```

5. Push to your fork:
```bash
git push origin feature/your-feature-name
```

6. Open a Pull Request

## Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Ensure the code builds successfully
- Update documentation if needed
- The `dist/` folder must be committed (required for GitHub Actions)

## Code Style

- Use TypeScript for all source files
- Follow ESLint rules (run `npm run lint`)
- Format code with Prettier (run `npm run format`)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Testing

Before submitting a PR:

1. Build the project: `npm run build`
2. Package for distribution: `npm run package`
3. Test locally if possible

## Adding New Features

When adding new features:

1. Update type definitions in `src/types/index.ts`
2. Add necessary inputs to `action.yml`
3. Update `README.md` with usage examples
4. Consider backward compatibility

## Reporting Issues

When reporting issues, please include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (GitHub Actions runner version, etc.)
- Relevant logs or error messages

## Questions?

Feel free to open an issue for questions or discussions about the project.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
