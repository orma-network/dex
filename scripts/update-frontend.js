#!/usr/bin/env node

/**
 * WinDex Frontend Configuration Updater
 * Updates frontend configuration with deployed contract addresses
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

function logWarning(message) {
    log(`[WARNING] ${message}`, 'yellow');
}

function logInfo(message) {
    log(`[INFO] ${message}`, 'blue');
}

// Get command line arguments
const args = process.argv.slice(2);
const network = args[0] || 'anvil';

// Map network names to chain IDs
const chainIds = {
    anvil: '31337',
    sepolia: '11155111',
    mainnet: '1'
};

const chainId = chainIds[network];
if (!chainId) {
    logError(`Unknown network: ${network}`);
    logInfo('Supported networks: anvil, sepolia, mainnet');
    process.exit(1);
}

// Paths
const deploymentFile = path.join(__dirname, '..', 'deployments', `deployment-${chainId}.json`);
const wagmiFile = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'wagmi.ts');
const envFile = path.join(__dirname, '..', 'frontend', '.env.local');

logInfo(`Updating frontend configuration for ${network} network (Chain ID: ${chainId})`);

// Check if deployment file exists
if (!fs.existsSync(deploymentFile)) {
    logError(`Deployment file not found: ${deploymentFile}`);
    logInfo('Please run deployment first');
    process.exit(1);
}

// Load deployment data
let deploymentData;
try {
    const deploymentContent = fs.readFileSync(deploymentFile, 'utf8');
    deploymentData = JSON.parse(deploymentContent);
    logSuccess('Deployment data loaded successfully');
} catch (error) {
    logError(`Failed to load deployment data: ${error.message}`);
    process.exit(1);
}

// Validate deployment data
const requiredFields = ['factory', 'router', 'tokenFactory'];
const optionalFields = ['testTokenA', 'testTokenB', 'testTokenC'];

for (const field of requiredFields) {
    if (!deploymentData[field]) {
        logError(`Missing required field in deployment data: ${field}`);
        process.exit(1);
    }
}

logInfo('Deployment addresses:');
logInfo(`  Factory: ${deploymentData.factory}`);
logInfo(`  Router: ${deploymentData.router}`);
logInfo(`  TokenFactory: ${deploymentData.tokenFactory}`);
if (deploymentData.testTokenA) logInfo(`  TestTokenA: ${deploymentData.testTokenA}`);
if (deploymentData.testTokenB) logInfo(`  TestTokenB: ${deploymentData.testTokenB}`);
if (deploymentData.testTokenC) logInfo(`  TestTokenC: ${deploymentData.testTokenC}`);

// Update wagmi.ts file
if (fs.existsSync(wagmiFile)) {
    try {
        let wagmiContent = fs.readFileSync(wagmiFile, 'utf8');
        
        // Update contract addresses with fallback to deployed addresses
        const updates = [
            {
                pattern: /FACTORY: process\.env\.NEXT_PUBLIC_FACTORY_ADDRESS \|\| ''/g,
                replacement: `FACTORY: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '${deploymentData.factory}'`
            },
            {
                pattern: /ROUTER: process\.env\.NEXT_PUBLIC_ROUTER_ADDRESS \|\| ''/g,
                replacement: `ROUTER: process.env.NEXT_PUBLIC_ROUTER_ADDRESS || '${deploymentData.router}'`
            },
            {
                pattern: /TOKEN_FACTORY: process\.env\.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS \|\| ''/g,
                replacement: `TOKEN_FACTORY: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '${deploymentData.tokenFactory}'`
            }
        ];

        // Add test token updates if they exist
        if (deploymentData.testTokenA) {
            updates.push({
                pattern: /TOKEN_A: process\.env\.NEXT_PUBLIC_TOKEN_A_ADDRESS \|\| ''/g,
                replacement: `TOKEN_A: process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || '${deploymentData.testTokenA}'`
            });
        }

        if (deploymentData.testTokenB) {
            updates.push({
                pattern: /TOKEN_B: process\.env\.NEXT_PUBLIC_TOKEN_B_ADDRESS \|\| ''/g,
                replacement: `TOKEN_B: process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS || '${deploymentData.testTokenB}'`
            });
        }

        if (deploymentData.testTokenC) {
            updates.push({
                pattern: /TOKEN_C: process\.env\.NEXT_PUBLIC_TOKEN_C_ADDRESS \|\| ''/g,
                replacement: `TOKEN_C: process.env.NEXT_PUBLIC_TOKEN_C_ADDRESS || '${deploymentData.testTokenC}'`
            });
        }

        // Apply updates
        let updatedCount = 0;
        for (const update of updates) {
            const beforeLength = wagmiContent.length;
            wagmiContent = wagmiContent.replace(update.pattern, update.replacement);
            if (wagmiContent.length !== beforeLength) {
                updatedCount++;
            }
        }

        // Write updated content
        fs.writeFileSync(wagmiFile, wagmiContent);
        logSuccess(`Updated wagmi.ts with ${updatedCount} contract addresses`);
        
    } catch (error) {
        logError(`Failed to update wagmi.ts: ${error.message}`);
    }
} else {
    logWarning('wagmi.ts file not found, skipping update');
}

// Create/update .env.local file
try {
    const envContent = `# Auto-generated deployment configuration
# Network: ${network}
# Chain ID: ${chainId}
# Generated: ${new Date().toISOString()}

NEXT_PUBLIC_FACTORY_ADDRESS=${deploymentData.factory}
NEXT_PUBLIC_ROUTER_ADDRESS=${deploymentData.router}
NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=${deploymentData.tokenFactory}
NEXT_PUBLIC_TOKEN_A_ADDRESS=${deploymentData.testTokenA || ''}
NEXT_PUBLIC_TOKEN_B_ADDRESS=${deploymentData.testTokenB || ''}
NEXT_PUBLIC_TOKEN_C_ADDRESS=${deploymentData.testTokenC || ''}
NEXT_PUBLIC_CHAIN_ID=${chainId}
`;

    fs.writeFileSync(envFile, envContent);
    logSuccess('Created/updated frontend/.env.local');
    
} catch (error) {
    logError(`Failed to create .env.local: ${error.message}`);
}

// Create deployment summary
const summaryFile = path.join(__dirname, '..', 'deployments', `summary-${network}.md`);
try {
    const summaryContent = `# WinDex Deployment Summary

**Network:** ${network}  
**Chain ID:** ${chainId}  
**Deployed:** ${new Date().toISOString()}  
**Block:** ${deploymentData.blockNumber || 'Unknown'}  

## Contract Addresses

| Contract | Address |
|----------|---------|
| Factory | \`${deploymentData.factory}\` |
| Router | \`${deploymentData.router}\` |
| TokenFactory | \`${deploymentData.tokenFactory}\` |
${deploymentData.testTokenA ? `| TestTokenA (TTA) | \`${deploymentData.testTokenA}\` |` : ''}
${deploymentData.testTokenB ? `| TestTokenB (TTB) | \`${deploymentData.testTokenB}\` |` : ''}
${deploymentData.testTokenC ? `| TestTokenC (TTC) | \`${deploymentData.testTokenC}\` |` : ''}

## Verification

- [ ] Factory deployed and functional
- [ ] Router deployed and functional  
- [ ] TokenFactory deployed and functional
- [ ] Test tokens deployed (if applicable)
- [ ] Initial pairs created (if applicable)
- [ ] Frontend configuration updated
- [ ] Basic functionality tested

## Next Steps

1. Test the deployment using the frontend
2. Verify all contracts on block explorer (if applicable)
3. Add initial liquidity to test token pairs
4. Monitor for any issues

## Commands

\`\`\`bash
# Test deployment
./scripts/post-deploy.sh ${network}

# Add liquidity (for test networks)
./scripts/post-deploy.sh ${network} --add-liquidity

# Start frontend
cd frontend && npm run dev
\`\`\`
`;

    fs.writeFileSync(summaryFile, summaryContent);
    logSuccess(`Created deployment summary: ${summaryFile}`);
    
} catch (error) {
    logWarning(`Failed to create deployment summary: ${error.message}`);
}

logSuccess('Frontend configuration update completed!');
logInfo('Next steps:');
logInfo('  1. Start the frontend: cd frontend && npm run dev');
logInfo('  2. Test the DEX functionality');
logInfo('  3. Verify contracts on block explorer (if applicable)');

// Exit with success
process.exit(0);
