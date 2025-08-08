# Project Organization

This document describes the organized structure of the PeanutButterAndJam project.

## 📁 Directory Structure

```
peanutbutterandjam/
├── 📚 docs/                    # All documentation
│   ├── README.md              # Documentation index
│   ├── DEVELOPMENT.md         # Development guidelines
│   ├── TESTING.md             # Testing procedures
│   ├── TESTNET_README.md      # Testnet setup guide
│   ├── MULTI_NODE_SETUP.md    # Multi-node Docker setup
│   ├── JAMNP_IMPLEMENTATION_PLAN.md  # JAM Networking Protocol plan
│   └── RELEASE.md             # Release procedures
│
├── 🚀 scripts/                 # All automation scripts
│   ├── README.md              # Scripts documentation
│   ├── hybrid-testnet.sh      # Polkajam + PBNJ testnet
│   ├── simple-testnet.sh      # Polkajam-only testnet
│   ├── testnet-setup.sh       # Custom testnet setup
│   ├── start-nodes.sh         # Multi-node Docker setup
│   ├── test-single-node.sh    # Single node testing
│   └── release.sh             # Release automation
│
├── 📦 packages/               # TypeScript packages
│   ├── core/                  # Core types and utilities
│   ├── cli/                   # Command-line interface
│   ├── safrole/               # Safrole consensus
│   ├── pvm/                   # Polkadot Virtual Machine
│   └── ...                    # Other packages
│
├── 🔧 config/                 # Configuration files
│   ├── grafana/               # Grafana dashboards
│   ├── typescript/            # TypeScript configs
│   └── ...                    # Other configs
│
├── 🐳 infra/                  # Infrastructure
│   └── node/                  # Node implementation
│
├── 📡 apis/                   # API implementations
│   └── rpc-server/            # RPC server
│
├── 📋 submodules/             # External dependencies
│   ├── graypaper/             # JAM protocol specification
│   ├── jam-docs/              # JAM documentation
│   ├── jamtestvectors/        # Official test vectors
│   └── ...                    # Other submodules
│
└── 📄 Root files
    ├── README.md              # Main project overview
    ├── ORGANIZATION.md        # This file
    └── ...                    # Other root files
```

## 🎯 Organization Benefits

### 📚 **Documentation (`docs/`)**
- **Centralized**: All documentation in one place
- **Categorized**: Organized by topic (development, testing, networking, etc.)
- **Indexed**: Main index file for easy navigation
- **Linked**: Cross-references between related documents

### 🚀 **Scripts (`scripts/`)**
- **Automation**: All setup and automation scripts
- **Categorized**: Testnet, Docker, and utility scripts
- **Documented**: Each script has clear documentation
- **Reusable**: Scripts can be run from anywhere

### 📦 **Packages (`packages/`)**
- **Modular**: Each package has a specific responsibility
- **Independent**: Packages can be developed and tested separately
- **Monorepo**: Shared tooling and dependencies

## 🔗 Quick Navigation

### For New Users
1. Start with **[README.md](README.md)** for project overview
2. Check **[docs/README.md](docs/README.md)** for complete documentation
3. Use **[scripts/README.md](scripts/README.md)** to find automation scripts

### For Developers
1. Read **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for setup
2. Use **[docs/TESTING.md](docs/TESTING.md)** for testing procedures
3. Run **[scripts/hybrid-testnet.sh](scripts/hybrid-testnet.sh)** for testing

### For Testnet Setup
1. Read **[docs/TESTNET_README.md](docs/TESTNET_README.md)** for detailed instructions
2. Run **[scripts/hybrid-testnet.sh](scripts/hybrid-testnet.sh)** for quick start
3. Use **[docs/MULTI_NODE_SETUP.md](docs/MULTI_NODE_SETUP.md)** for Docker setup

## 📋 Migration Summary

### Moved Files
- **Documentation**: All `.md` files moved to `docs/`
- **Scripts**: All `.sh` files moved to `scripts/`
- **Indexes**: Created README files for both directories
- **References**: Updated all internal links

### Updated References
- Main README now points to organized documentation
- Script paths updated in documentation
- Cross-references between docs and scripts

## 🎉 Benefits Achieved

1. **Better Organization**: Clear separation of concerns
2. **Easier Navigation**: Logical grouping of related files
3. **Improved Documentation**: Centralized and indexed
4. **Reusable Scripts**: Organized automation tools
5. **Scalable Structure**: Easy to add new docs and scripts 