# Build Tools

A comprehensive collection of custom Nx executors and generators for streamlined containerization and deployment workflows. This workspace provides specialized tools for building, tagging, and deploying Docker containers with intelligent version management.

## 🚀 Features

- **Custom Nx Executors**: Specialized executors for Docker containerization workflows
- **Version Management**: Intelligent version detection from package.json and Git tags
- **Registry Integration**: Built-in support for pushing to container registries
- **Git Integration**: Automatic SHA-based tagging for traceability
- **Local Development**: Local Verdaccio registry for testing and development

## 📦 Projects

### `@mschoenbo/nx-build-tools/source`

The main build tools library containing custom Nx executors and generators.

### `build-tools`

Custom Nx executors for containerization and deployment workflows.

### `build-tools-e2e`

End-to-end tests for the build tools functionality.

## 🛠️ Available Executors

### `tag-and-build`

A powerful executor for building, tagging, and pushing Docker images with intelligent version management.

#### Key Features

- **Automatic Version Detection**: Reads version from `package.json` or Git tags
- **Flexible Tagging Strategy**: Supports semantic versioning with major/minor tags
- **Git Integration**: Uses Git SHA for traceability
- **Build Integration**: Runs Nx build targets before containerization
- **Registry Support**: Built-in support for pushing to container registries

#### Configuration Options

| Option               | Type     | Required | Default      | Description                                           |
| -------------------- | -------- | -------- | ------------ | ----------------------------------------------------- |
| `appName`            | string   | ✅       | -            | The name of the Nx app to build and tag               |
| `dockerRepository`   | string   | ✅       | -            | Base Docker repository (e.g., `ghcr.io/your-org/`)    |
| `buildTarget`        | string   | ✅       | `build`      | Nx build target to run before containerization        |
| `dockerfile`         | string   | ❌       | `Dockerfile` | Path to Dockerfile relative to project root           |
| `context`            | string   | ❌       | `.`          | Build context for Docker relative to project root     |
| `push`               | boolean  | ❌       | `false`      | Whether to push Docker image(s) to registry           |
| `additionalTags`     | string[] | ❌       | `[]`         | Additional static tags (e.g., `['latest']`)           |
| `generateMajorMinor` | boolean  | ❌       | `false`      | Generate major and minor version tags                 |
| `tagPrefix`          | string   | ❌       | `v`          | Prefix for Git tags (e.g., `v` for `app-name/v1.2.3`) |

#### Usage Example

```json
{
  "executor": "@mschoenbo/nx-build-tools:tag-and-build",
  "options": {
    "appName": "frontend",
    "dockerRepository": "ghcr.io/your-org/",
    "buildTarget": "build",
    "push": true,
    "generateMajorMinor": true,
    "additionalTags": ["latest"]
  }
}
```

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js (v18 or later)
- Docker
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd build-tools
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the tools**
   ```bash
   npx nx build build-tools
   ```

### Development

1. **Run tests**

   ```bash
   npx nx test build-tools
   npx nx e2e build-tools-e2e
   ```

2. **Lint code**
   ```bash
   npx nx lint build-tools
   ```

## 🔧 Development Tools

### Available Commands

```bash
# Build the tools
npx nx build build-tools

# Run tests
npx nx test build-tools
npx nx e2e build-tools-e2e

# Lint code
npx nx lint build-tools

# Visualize the workspace
npx nx graph
```

## 📚 Documentation

For detailed documentation on the custom executors and their configuration options, see the [build-tools README](./build-tools/README.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Useful Links

- [Nx Documentation](https://nx.dev)
- [Nx Plugin Registry](https://nx.dev/plugin-registry)
- [Nx Community](https://go.nx.dev/community)
