const { ethers } = require('ethers');

async function testDeployment() {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Test Factory
    const factoryCode = await provider.getCode('0x5FbDB2315678afecb367f032d93F642f64180aa3');
    if (factoryCode === '0x') {
        throw new Error('Factory not deployed');
    }
    console.log('✓ Factory deployed and accessible');
    
    // Test Router
    const routerCode = await provider.getCode('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    if (routerCode === '0x') {
        throw new Error('Router not deployed');
    }
    console.log('✓ Router deployed and accessible');
    
    // Test TokenFactory
    const tokenFactoryCode = await provider.getCode('0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0');
    if (tokenFactoryCode === '0x') {
        throw new Error('TokenFactory not deployed');
    }
    console.log('✓ TokenFactory deployed and accessible');
    
    console.log('✓ All contracts deployed successfully');
}

testDeployment().catch(console.error);
