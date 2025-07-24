#!/usr/bin/env node

/**
 * WinDex ABI Generator
 * Automatically extracts ABIs from compiled Foundry contracts and updates frontend
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
    log(`[ERROR] ${message}`, 'red');
}

function logSuccess(message) {
    log(`[SUCCESS] ${message}`, 'green');
}

function logInfo(message) {
    log(`[INFO] ${message}`, 'blue');
}

function logWarning(message) {
    log(`[WARNING] ${message}`, 'yellow');
}

// Contract configurations
const CONTRACTS = {
    Factory: {
        path: 'contracts/out/Factory.sol/Factory.json',
        name: 'FACTORY_ABI'
    },
    Router: {
        path: 'contracts/out/Router.sol/Router.json',
        name: 'ROUTER_ABI'
    },
    Pair: {
        path: 'contracts/out/Pair.sol/Pair.json',
        name: 'PAIR_ABI'
    },
    TokenFactory: {
        path: 'contracts/out/TokenFactory.sol/TokenFactory.json',
        name: 'TOKEN_FACTORY_ABI'
    },
    ERC20: {
        path: 'contracts/out/ERC20.sol/ERC20.json',
        name: 'ERC20_ABI'
    }
};

// Frontend wagmi.ts file path
const WAGMI_FILE = 'frontend/src/lib/wagmi.ts';

/**
 * Extract ABI from compiled contract JSON
 */
function extractABI(contractPath) {
    try {
        if (!fs.existsSync(contractPath)) {
            throw new Error(`Contract file not found: ${contractPath}`);
        }

        const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        return contractData.abi;
    } catch (error) {
        throw new Error(`Failed to extract ABI from ${contractPath}: ${error.message}`);
    }
}

/**
 * Format ABI for TypeScript
 */
function formatABI(abi, name) {
    const formattedABI = JSON.stringify(abi, null, 2)
        .replace(/"/g, "'")
        .replace(/'/g, '"');
    
    return `export const ${name} = ${formattedABI} as const;`;
}

/**
 * Update wagmi.ts file with new ABIs
 */
function updateWagmiFile(abis) {
    try {
        if (!fs.existsSync(WAGMI_FILE)) {
            throw new Error(`Wagmi file not found: ${WAGMI_FILE}`);
        }

        let content = fs.readFileSync(WAGMI_FILE, 'utf8');
        
        // Update each ABI
        for (const [contractName, config] of Object.entries(CONTRACTS)) {
            if (abis[contractName]) {
                const abiString = formatABI(abis[contractName], config.name);
                
                // Find and replace the existing ABI
                const abiRegex = new RegExp(
                    `export const ${config.name} = \\[[\\s\\S]*?\\] as const;`,
                    'g'
                );
                
                if (content.match(abiRegex)) {
                    content = content.replace(abiRegex, abiString);
                    logInfo(`Updated ${config.name} in wagmi.ts`);
                } else {
                    logWarning(`Could not find ${config.name} in wagmi.ts - manual update required`);
                }
            }
        }
        
        // Write updated content
        fs.writeFileSync(WAGMI_FILE, content, 'utf8');
        logSuccess('Updated wagmi.ts with new ABIs');
        
    } catch (error) {
        throw new Error(`Failed to update wagmi.ts: ${error.message}`);
    }
}

/**
 * Generate ABI TypeScript file
 */
function generateABIFile(abis) {
    const abiFilePath = 'frontend/src/lib/abis.ts';
    
    let content = `// Auto-generated ABIs from Foundry contracts
// Generated: ${new Date().toISOString()}
// DO NOT EDIT MANUALLY - Run 'npm run generate-abis' to update

`;

    // Add each ABI
    for (const [contractName, config] of Object.entries(CONTRACTS)) {
        if (abis[contractName]) {
            content += formatABI(abis[contractName], config.name) + '\n\n';
        }
    }

    // Add export object
    content += `// Export all ABIs
export const ABIS = {
`;

    for (const [contractName, config] of Object.entries(CONTRACTS)) {
        if (abis[contractName]) {
            content += `  ${contractName.toUpperCase()}: ${config.name},\n`;
        }
    }

    content += `} as const;\n`;

    fs.writeFileSync(abiFilePath, content, 'utf8');
    logSuccess(`Generated ${abiFilePath}`);
}

/**
 * Main function
 */
async function main() {
    try {
        logInfo('Starting ABI generation...');
        
        // Check if contracts are compiled
        if (!fs.existsSync('contracts/out')) {
            throw new Error('Contracts not compiled. Run "forge build" first.');
        }
        
        const abis = {};
        
        // Extract ABIs from all contracts
        for (const [contractName, config] of Object.entries(CONTRACTS)) {
            try {
                logInfo(`Extracting ABI for ${contractName}...`);
                abis[contractName] = extractABI(config.path);
                logSuccess(`Extracted ${contractName} ABI (${abis[contractName].length} functions/events)`);
            } catch (error) {
                logWarning(`Skipping ${contractName}: ${error.message}`);
            }
        }
        
        if (Object.keys(abis).length === 0) {
            throw new Error('No ABIs extracted. Check contract compilation.');
        }
        
        // Update wagmi.ts file
        logInfo('Updating frontend ABIs...');
        updateWagmiFile(abis);
        
        // Generate standalone ABI file
        logInfo('Generating ABI file...');
        generateABIFile(abis);
        
        logSuccess('ABI generation completed successfully!');
        logInfo('Next steps:');
        logInfo('  1. Review the updated ABIs in frontend/src/lib/wagmi.ts');
        logInfo('  2. Check the generated frontend/src/lib/abis.ts');
        logInfo('  3. Restart your frontend development server');
        
    } catch (error) {
        logError(error.message);
        process.exit(1);
    }
}

// Handle script execution
if (require.main === module) {
    main();
}

module.exports = { main, extractABI, formatABI };
