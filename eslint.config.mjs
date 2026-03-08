import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // SonarJS recommended rules
  sonarjs.configs.recommended,
  // Global rules for unused variables and code quality
  {
    plugins: {
      unicorn: unicorn,
    },
    rules: {
      // Unused variables
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      "react/no-unused-prop-types": "error",
      "react/jsx-no-useless-fragment": "warn",

      // ============================================
      // Type Safety & Reliability (SonarQube Issues)
      // ============================================

      // Prevent implicit any (SonarQube S4323, S4328)
      "@typescript-eslint/no-explicit-any": "error",
      // Note: These rules require type-checking setup (parserOptions.project)
      // Uncomment when tsconfig type checking is configured in ESLint
      // "@typescript-eslint/no-unsafe-assignment": "warn",
      // "@typescript-eslint/no-unsafe-member-access": "warn",
      // "@typescript-eslint/no-unsafe-call": "warn",
      // "@typescript-eslint/no-unsafe-return": "warn",

      // Consistent type imports (better tree-shaking)
      "@typescript-eslint/consistent-type-imports": ["error", {
        "prefer": "type-imports",
        "fixStyle": "inline-type-imports"
      }],

      // React hooks dependency array (prevent stale closures)
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",

      // Cognitive complexity (like SonarQube)
      "sonarjs/cognitive-complexity": ["error", 15],

      // ============================================
      // Maintainability & Code Quality
      // ============================================

      // Complexity limits
      "complexity": ["error", 15],
      "max-depth": ["error", 4],

      // Prevent unnecessary code
      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["error", { "allow": ["warn", "error"] }],

      // TypeScript readonly rules (require type checking setup - see TypeScript files config below)
      "@typescript-eslint/prefer-readonly": "off",
      "@typescript-eslint/prefer-readonly-parameter-types": "off",

      // Additional SonarJS quality rules
      "sonarjs/no-duplicate-string": ["warn", { "threshold": 3 }],
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-small-switch": "warn",
      "sonarjs/no-nested-conditional": "warn",
      "sonarjs/prefer-immediate-return": "warn",

      // ============================================
      // Rules for issues fixed in this session
      // ============================================

      // Prevent deprecated onKeyPress (use onKeyDown/onKeyUp)
      "react/no-deprecated": "error",

      // Prefer modern array methods
      "prefer-destructuring": ["warn", {
        "array": false,  // Allow array[0] - common pattern
        "object": true
      }],

      // Enforce proper export patterns (prevents S7763) - Warning only to not break builds
      "no-restricted-syntax": [
        "off",  // Disabled - causes too many warnings in existing codebase
        {
          "selector": "ImportDeclaration[source.value=/^\\./] ~ ExportNamedDeclaration[source=null]",
          "message": "Use 'export { X } from ...' instead of 'import { X } from ...'; export { X };"
        }
      ],

      // React Context performance - require useMemo for Context.Provider value
      "react/jsx-no-constructed-context-values": "error",

      // ============================================
      // Rules to prevent Sonar issues
      // ============================================

      // Prevent components defined inside components (S6478)
      // Note: This is enforced by sonarjs plugin - no additional ESLint rule needed
      // Best practice: Extract components outside parent or use useMemo/useCallback

      // Prevent negated conditions in ternaries (S7735)
      "sonarjs/prefer-single-boolean-return": "warn",
      "sonarjs/no-inverted-boolean-check": "error",

      // Prefer Number.parseFloat over global parseFloat (S7773) & globalThis over window (S7764)
      "no-restricted-globals": [
        "error",
        {
          "name": "parseFloat",
          "message": "Use Number.parseFloat() instead of global parseFloat()"
        },
        {
          "name": "parseInt",
          "message": "Use Number.parseInt() instead of global parseInt()"
        },
        {
          "name": "window",
          "message": "Use globalThis instead of window for cross-platform compatibility"
        }
      ],

      // Require node: prefix for Node.js built-in modules (S7772)
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["fs", "path", "http", "https", "crypto", "stream", "util", "os", "events", "buffer", "child_process"],
              "message": "Import Node.js built-in modules with 'node:' prefix (e.g., 'node:fs' instead of 'fs')"
            }
          ]
        }
      ],

      // Accessibility: Enforce keyboard handlers on interactive elements (S1082, S6848, S6819)
      // Note: These are primarily caught by Next.js's built-in jsx-a11y rules
      // The following rules are already enabled via eslint-config-next:
      // - jsx-a11y/click-events-have-key-events
      // - jsx-a11y/no-static-element-interactions
      // - jsx-a11y/interactive-supports-focus
      // - jsx-a11y/prefer-tag-over-role (prevents <div role="button">, use <button> instead)

      // Prevent deprecated React APIs (S1874)


      // Prevent unnecessary type assertions (S4325)
      "@typescript-eslint/no-unnecessary-type-assertion": "off",  // Requires type-checking setup

      // Prevent array index keys in React (S6479)
      "react/no-array-index-key": "warn",

      // Accessibility - Heading content (S6850)
      // Note: Enforced via jsx-a11y plugin in Next.js config


      // Unknown properties (S6747)
      "react/no-unknown-property": ["error", {
        "ignore": ["data-*", "aria-*"]
      }],

      // Ambiguous JSX spacing (S6772)
      // Note: This is a Sonar-specific formatting rule - use Prettier for consistent formatting
      // No direct ESLint equivalent

      // Empty object patterns (S3799)
      "@typescript-eslint/no-empty-object-type": "off",  // Too strict for component props

      // Deprecated Recharts Cell component (S1874)
      // Note: This is library-specific and should be handled during library updates
      // Consider using import restrictions if needed

      // Components defined inside components (S6478)
      // Note: Enforced by sonarjs plugin's no-identical-functions rule
      // Best practice: Extract or memoize components

      // Prefer replaceAll over replace with regex (S7781)
      "prefer-named-capture-group": "off",  // Not directly related
      // Note: No direct ESLint rule - requires manual code review

      // Prefer .at() over [array.length - index] (S7755)
      "unicorn/prefer-at": "error",

      // Prefer globalThis over window (S7764)
      // Note: Already covered by no-restricted-globals above

      // Negated conditions (S7735)
      // Note: Already covered by sonarjs rules above

      // Prefer export from (S7763, S7787)
      // Note: This is a style preference - not critical for functionality
      // Can be enforced via custom rules if needed

      // ============================================
      // SonarQube PR Issues - Required Rules
      // ============================================

      // Mark the props of the component as read-only (TypeScript S6759)
      "sonarjs/prefer-read-only-props": "error",
    }
  },
  // TypeScript files with type-checking (for @typescript-eslint/no-misused-promises)
  ...tseslint.config({
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Promise-returning function provided to property where a void return was expected
      "@typescript-eslint/no-misused-promises": ["error", {
        "checksVoidReturn": {
          "attributes": true,
          "properties": true,
        }
      }],

      // Disable all other type-checked rules to avoid noise
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    }
  }),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "coverage/**",
    "test-results/**"
  ]),
  // E2E tests and test files - Relaxed rules for testing
  {
    files: [
      "e2e/**/*.ts",
      "e2e/**/*.tsx",
      "tests/**/*.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.mock.ts",
      "**/*.mock.tsx",
      "**/mocks/**/*.ts",
      "e2e/setup/**/*.ts"
    ],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "max-lines-per-function": "off",
      "max-lines": "off",
      "complexity": "off",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "sonarjs/no-duplicate-string": "off", // Allow duplicate strings in tests for clarity
    },
  },
  // Config and script files
  {
    files: ["*.config.ts", "*.config.js", "*.config.mjs", "scripts/**/*.ts", "scripts/**/*.js", "prisma/**/*.ts", "prisma/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
]);  

export default eslintConfig;
