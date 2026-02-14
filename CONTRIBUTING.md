# Contributing to ZeroUpload

Thank you for your interest in contributing to **ZeroUpload**! We welcome contributions from the community and appreciate your help in making this project better. This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Types of Contributions](#types-of-contributions)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)
- [Testing](#testing)
- [Documentation](#documentation)
- [Contact](#contact)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please read and adhere to our code of conduct:

- **Be Respectful** — Treat all community members with respect and dignity
- **Be Inclusive** — Welcome people of all backgrounds and experience levels
- **Be Professional** — Keep discussions on-topic and constructive
- **Report Issues** — If you encounter inappropriate behavior, report it to the maintainers

### Unacceptable Behavior

- Harassment, discrimination, or hate speech
- Personal attacks or insulting comments
- Trolling, spamming, or disruptive behavior
- Violation of others' privacy
- Any conduct that violates applicable laws

**Violations may result in permanent removal from the project.**

---

## Getting Started

### Before You Begin

1. **Check Existing Issues** — Search for existing issues/PRs related to your contribution
2. **Fork the Repository** — Create your own fork of the project
3. **Read Documentation** — Familiarize yourself with the project structure
4. **Set Up Environment** — Follow the development setup instructions below

### Local Repository Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/File.Tools.git
cd File.Tools

# Add upstream remote
git remote add upstream https://github.com/The-Developer-Diaries/File.Tools.git

# Create a feature branch
git checkout -b feature/your-feature-name
```

---

## Types of Contributions

### 🐛 Bug Reports & Fixes
- **Report Bugs** — Submit detailed bug reports through GitHub Issues
- **Fix Bugs** — Submit pull requests to fix identified bugs
- Include steps to reproduce and expected vs. actual behavior

### ✨ New Features
- **Suggest Features** — Discuss new features before implementation
- **Implement Features** — Create new tools or improve existing ones
- **Maintain Consistency** — Follow existing code patterns and structure

### 📚 Documentation
- **Update README** — Improve project documentation
- **Add Guides** — Create tutorials or guides for tools
- **Fix Typos** — Correct spelling and grammar errors
- **Add Examples** — Provide usage examples and code samples

### 🎨 UI/UX Improvements
- **Design Enhancements** — Improve visual appearance and usability
- **Accessibility** — Make the project more accessible
- **Responsive Design** — Improve mobile experience
- **Theme Improvements** — Enhance dark/light theme support

### 🌐 Localization
- **Translate UI** — Translate interface text to other languages
- **Localize Content** — Adapt documentation for different regions
- **Regional Fixes** — Address region-specific issues

### ♻️ Code Quality
- **Refactoring** — Improve code structure and efficiency
- **Performance** — Optimize processing and loading times
- **Security** — Fix security vulnerabilities
- **Testing** — Add or improve test coverage

---

## Development Setup

### Prerequisites

- **Node.js** (v14 or higher) — For development tooling
- **Git** — Version control
- **Modern Web Browser** — Chrome, Firefox, Safari, or Edge
- **Code Editor** — VS Code recommended

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR-USERNAME/File.Tools.git
cd File.Tools

# 2. Install dependencies (if applicable)
npm install

# 3. Start local development server
# Option 1: Python 3
python -m http.server 8000

# Option 2: Node.js with http-server
npx http-server

# Option 3: Node.js with live-server (auto-reload)
npx live-server
```

### Accessing the Application

- Visit `http://localhost:8000` in your browser
- Changes will be reflected immediately (with live-server)
- Open browser DevTools to debug and check console

---

## Coding Standards

### JavaScript/HTML/CSS Style Guide

#### Naming Conventions
```javascript
// Variables and functions: camelCase
const toolName = 'Merge PDF';
function handleFileUpload() { }

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 1000000;

// Classes: PascalCase
class FileTool { }

// CSS classes: kebab-case
.tool-card-container { }
```

#### Code Structure
- **Functional Programming** — Prefer pure functions
- **Modular Design** — Separate concerns into modules
- **DRY Principle** — Don't Repeat Yourself
- **Comments** — Add meaningful comments for complex logic
- **Error Handling** — Implement proper error handling

#### Example Code Style
```javascript
/**
 * Processes a file and returns the result
 * @param {File} file - The input file
 * @param {Object} options - Processing options
 * @returns {Promise<Blob>} Processed file as Blob
 */
async function processFile(file, options = {}) {
  try {
    // Validate input
    if (!file) {
      throw new Error('File is required');
    }

    // Process file
    const result = await performProcessing(file, options);

    return result;
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
}
```

#### CSS Guidelines
```css
/* Use variables for consistent styling */
:root {
  --primary-color: #6366f1;
  --text-primary: #1f2937;
  --border-radius: 8px;
}

/* Group related properties */
.tool-card {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: var(--border-radius);
  background-color: var(--bg-secondary);
}

/* Mobile-first responsive design */
@media (min-width: 768px) {
  .tools-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### HTML Standards
- **Semantic HTML** — Use appropriate HTML5 elements
- **Accessibility** — Include ARIA labels and alt text
- **Validation** — Ensure valid HTML5
- **BEM Naming** — Consider BEM for CSS class names

---

## Commit Message Guidelines

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type
- `feat` — A new feature
- `fix` — A bug fix
- `docs` — Documentation changes
- `style` — Code style changes (formatting, missing semicolons, etc.)
- `refactor` — Code refactoring
- `perf` — Performance improvements
- `test` — Adding or updating tests
- `chore` — Build process, dependencies, etc.

### Examples

```
feat(pdf-tools): add watermark functionality to PDF merger

- Implemented watermark customization options
- Added preview before applying watermark
- Tested with various PDF formats

Closes #123
```

```
fix(image-compression): correct quality calculation

The compression quality algorithm was incorrectly calculating
the final output size. Fixed the calculation formula.

Related to #456
```

```
docs: update installation instructions
```

### Guidelines
- Use lowercase
- Use imperative mood ("add" not "added")
- Don't end with a period
- Keep subject line under 50 characters
- Provide detailed explanation in body
- Reference related issues and pull requests

---

## Pull Request Process

### Before Submitting

1. **Sync with Main** — Ensure your branch is up-to-date
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Test Changes** — Verify your changes work correctly
3. **Update Documentation** — Update README or docs as needed
4. **Review Own Code** — Check your code for issues
5. **Run Linting** — Ensure code meets style standards

### Creating a Pull Request

1. **Push Your Branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open Pull Request** — Go to GitHub and create a PR with:
   - **Clear Title** — Descriptive PR title
   - **Detailed Description** — Explain changes and why
   - **Related Issues** — Reference any related issues
   - **Screenshots** — Include visuals for UI changes
   - **Checklist** — Mark items from the template

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #(number)

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing Done
- [ ] Manual testing completed
- [ ] Tested on desktop
- [ ] Tested on mobile
- [ ] No console errors

## Screenshots
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tested on multiple browsers
```

### Review Process

- **Maintainers Review** — Project maintainers will review your PR
- **Address Feedback** — Respond to and fix any issues raised
- **Continuous Integration** — CI checks must pass
- **Approval** — PR needs approval before merging
- **Merged** — Once approved, your changes will be merged

### After Merge

- **Branch Cleanup** — Delete your feature branch
- **Keep Synced** — Pull latest changes from main branch
- **Celebrate!** — You've contributed to ZeroUpload! 🎉

---

## Reporting Issues

### Bug Report Template

```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., Windows 10, macOS, Ubuntu]
- Browser: [e.g., Chrome 120]
- Version: [specific version if applicable]

## Screenshots
[Attach screenshots if helpful]

## Additional Context
Any other relevant information
```

### How to Report

1. **Check Existing Issues** — Search before reporting
2. **Open New Issue** — Use GitHub Issues
3. **Provide Details** — Include all requested information
4. **Be Patient** — Maintainers will respond when available

---

## Feature Requests

### Suggesting Features

1. **Check Existing Requests** — Avoid duplicates
2. **Describe Use Case** — Explain why this feature is needed
3. **Provide Examples** — Show how it would work
4. **Consider Impact** — Think about scope and complexity

### Feature Request Template

```markdown
## Feature Description
Clear description of the requested feature

## Use Case
Why is this feature needed?

## Proposed Solution
How should this feature work?

## Alternative Solutions
Any other approaches you've considered

## Additional Context
Any other relevant information
```

---

## Testing

### Manual Testing Checklist

- [ ] Feature works on desktop browsers
- [ ] Feature works on mobile browsers
- [ ] No console errors or warnings
- [ ] Error handling works properly
- [ ] Edge cases are handled
- [ ] Performance is acceptable
- [ ] Dark and light themes work
- [ ] Responsive design is maintained

### Browsers to Test

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

### Performance Testing

- Test with large files
- Monitor memory usage
- Check processing speed
- Verify UI responsiveness

---

## Documentation

### Documentation Guidelines

- **Clear and Concise** — Easy to understand language
- **Complete** — Cover all aspects of the feature
- **Examples** — Include code examples where applicable
- **Formatted** — Use proper markdown formatting
- **Updated** — Keep documentation current

### What to Document

- New features and tools
- API changes or modifications
- Configuration options
- Troubleshooting guides
- Usage examples

---

## Questions or Need Help?

### Contact the Maintainers

- **Email** — [subhanshu20135@iiitd.ac.in](mailto:subhanshu20135@iiitd.ac.in)
- **GitHub Issues** — Ask questions in issue discussions
- **GitHub Discussions** — Participate in community discussions

### Resources

- [Project README](README.md)
- [Full Documentation](DOCUMENTATION.md)
- [GitHub Issues](https://github.com/The-Developer-Diaries/File.Tools/issues)

---

## Recognition

### Contributors

We recognize and celebrate all contributors! Your efforts help make ZeroUpload better for everyone.

### How We Recognize Contributors

- Listed in README contributors section
- Mentioned in release notes
- Credited in commit history
- Featured in community highlights

---

## License

By contributing to ZeroUpload, you agree that your contributions will be licensed under the same Apache 2.0 License as the project.

---

## Final Notes

- **Start Small** — Consider opening an issue first for large changes
- **Be Respectful** — Treat other contributors and maintainers with respect
- **Have Fun** — Contributing should be enjoyable!
- **Ask Questions** — Don't hesitate to ask if unsure about something

Thank you for contributing to ZeroUpload! Together, we're making file processing more private and accessible for everyone. 🚀

---

<div align="center">

**Made with ❤️ by The Developer Diaries**

*For questions or issues, contact: [subhanshu20135@iiitd.ac.in](mailto:subhanshu20135@iiitd.ac.in)*

</div>
