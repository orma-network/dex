// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Factory} from "../src/Factory.sol";
import {Router} from "../src/Router.sol";
import {TestTokenA, TestTokenB, TestTokenC} from "../src/TestTokens.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {ERC20} from "../src/ERC20.sol";
import {Pair} from "../src/Pair.sol";

/**
 * @title WinDex Deployment Script
 * @dev Comprehensive deployment script for WinDex DEX contracts
 * @author WinDex Team
 */
contract Deploy is Script {
    // Deployment configuration
    struct DeploymentConfig {
        address deployer;
        address feeToSetter;
        uint256 initialTokenSupply;
        bool deployTestTokens;
        bool createInitialPairs;
        bool verifyContracts;
    }

    // Deployed contract addresses
    struct DeployedContracts {
        address factory;
        address router;
        address tokenFactory;
        address testTokenA;
        address testTokenB;
        address testTokenC;
        address[] initialPairs;
    }

    DeploymentConfig public config;
    DeployedContracts public deployed;

    // Events for tracking deployment
    event ContractDeployed(string name, address addr, uint256 gasUsed);
    event PairCreated(address tokenA, address tokenB, address pair);
    event DeploymentCompleted(address factory, address router, address tokenFactory);

    function setUp() public {
        // Load configuration from environment variables
        config.deployer = vm.envOr("DEPLOYER_ADDRESS", msg.sender);
        config.feeToSetter = vm.envOr("FEE_TO_SETTER", msg.sender);
        config.initialTokenSupply = vm.envOr("INITIAL_TOKEN_SUPPLY", uint256(1000000 * 10**18));
        config.deployTestTokens = vm.envOr("DEPLOY_TEST_TOKENS", true);
        config.createInitialPairs = vm.envOr("CREATE_INITIAL_PAIRS", true);
        config.verifyContracts = vm.envOr("VERIFY_CONTRACTS", false);

        console.log("=== WinDex Deployment Configuration ===");
        console.log("Deployer:", config.deployer);
        console.log("Fee To Setter:", config.feeToSetter);
        console.log("Initial Token Supply:", config.initialTokenSupply);
        console.log("Deploy Test Tokens:", config.deployTestTokens);
        console.log("Create Initial Pairs:", config.createInitialPairs);
        console.log("Verify Contracts:", config.verifyContracts);
        console.log("========================================");
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy core contracts
        _deployFactory();
        _deployRouter();
        _deployTokenFactory();

        // Deploy test tokens if configured
        if (config.deployTestTokens) {
            _deployTestTokens();
        }

        // Create initial pairs if configured
        if (config.createInitialPairs && config.deployTestTokens) {
            _createInitialPairs();
        }

        vm.stopBroadcast();

        // Post-deployment actions
        _postDeploymentActions();
        
        emit DeploymentCompleted(deployed.factory, deployed.router, deployed.tokenFactory);
        
        console.log("=== Deployment Completed Successfully ===");
        _printDeploymentSummary();
    }

    function _deployFactory() internal {
        console.log("Deploying Factory...");
        uint256 gasStart = gasleft();
        
        Factory factory = new Factory(config.feeToSetter);
        deployed.factory = address(factory);
        
        uint256 gasUsed = gasStart - gasleft();
        emit ContractDeployed("Factory", deployed.factory, gasUsed);
        
        console.log("Factory deployed at:", deployed.factory);
        console.log("Gas used:", gasUsed);
        
        // Verify deployment
        require(factory.feeToSetter() == config.feeToSetter, "Factory: Invalid feeToSetter");
        require(factory.allPairsLength() == 0, "Factory: Should start with no pairs");
        console.log("Factory verification: PASSED");
    }

    function _deployRouter() internal {
        require(deployed.factory != address(0), "Factory must be deployed first");
        
        console.log("Deploying Router...");
        uint256 gasStart = gasleft();
        
        Router router = new Router(deployed.factory);
        deployed.router = address(router);
        
        uint256 gasUsed = gasStart - gasleft();
        emit ContractDeployed("Router", deployed.router, gasUsed);
        
        console.log("Router deployed at:", deployed.router);
        console.log("Gas used:", gasUsed);
        
        // Verify deployment
        require(address(router.factory()) == deployed.factory, "Router: Invalid factory address");
        console.log("Router verification: PASSED");
    }

    function _deployTokenFactory() internal {
        console.log("Deploying TokenFactory...");
        uint256 gasStart = gasleft();
        
        TokenFactory tokenFactory = new TokenFactory();
        deployed.tokenFactory = address(tokenFactory);
        
        uint256 gasUsed = gasStart - gasleft();
        emit ContractDeployed("TokenFactory", deployed.tokenFactory, gasUsed);
        
        console.log("TokenFactory deployed at:", deployed.tokenFactory);
        console.log("Gas used:", gasUsed);
        
        // Verify deployment
        require(tokenFactory.getTotalTokensCount() == 0, "TokenFactory: Should start with no tokens");
        console.log("TokenFactory verification: PASSED");
    }

    function _deployTestTokens() internal {
        console.log("Deploying Test Tokens...");
        
        // Deploy Test Token A
        uint256 gasStart = gasleft();
        TestTokenA tokenA = new TestTokenA();
        deployed.testTokenA = address(tokenA);
        uint256 gasUsed = gasStart - gasleft();
        emit ContractDeployed("TestTokenA", deployed.testTokenA, gasUsed);
        console.log("TestTokenA deployed at:", deployed.testTokenA);
        
        // Deploy Test Token B
        gasStart = gasleft();
        TestTokenB tokenB = new TestTokenB();
        deployed.testTokenB = address(tokenB);
        gasUsed = gasStart - gasleft();
        emit ContractDeployed("TestTokenB", deployed.testTokenB, gasUsed);
        console.log("TestTokenB deployed at:", deployed.testTokenB);
        
        // Deploy Test Token C
        gasStart = gasleft();
        TestTokenC tokenC = new TestTokenC();
        deployed.testTokenC = address(tokenC);
        gasUsed = gasStart - gasleft();
        emit ContractDeployed("TestTokenC", deployed.testTokenC, gasUsed);
        console.log("TestTokenC deployed at:", deployed.testTokenC);
        
        // Verify test tokens
        require(tokenA.totalSupply() == 1000000 * 10**18, "TestTokenA: Invalid supply");
        require(tokenB.totalSupply() == 1000000 * 10**18, "TestTokenB: Invalid supply");
        require(tokenC.totalSupply() == 1000000 * 10**18, "TestTokenC: Invalid supply");
        console.log("Test tokens verification: PASSED");
    }

    function _createInitialPairs() internal {
        require(deployed.factory != address(0), "Factory not deployed");
        require(deployed.testTokenA != address(0), "TestTokenA not deployed");
        require(deployed.testTokenB != address(0), "TestTokenB not deployed");
        require(deployed.testTokenC != address(0), "TestTokenC not deployed");
        
        console.log("Creating initial pairs...");
        Factory factory = Factory(deployed.factory);
        
        // Create TTA/TTB pair
        address pairAB = factory.createPair(deployed.testTokenA, deployed.testTokenB);
        deployed.initialPairs.push(pairAB);
        emit PairCreated(deployed.testTokenA, deployed.testTokenB, pairAB);
        console.log("Created TTA/TTB pair at:", pairAB);
        
        // Create TTA/TTC pair
        address pairAC = factory.createPair(deployed.testTokenA, deployed.testTokenC);
        deployed.initialPairs.push(pairAC);
        emit PairCreated(deployed.testTokenA, deployed.testTokenC, pairAC);
        console.log("Created TTA/TTC pair at:", pairAC);
        
        // Create TTB/TTC pair
        address pairBC = factory.createPair(deployed.testTokenB, deployed.testTokenC);
        deployed.initialPairs.push(pairBC);
        emit PairCreated(deployed.testTokenB, deployed.testTokenC, pairBC);
        console.log("Created TTB/TTC pair at:", pairBC);
        
        // Verify pairs
        require(factory.allPairsLength() == 3, "Factory: Should have 3 pairs");
        console.log("Initial pairs verification: PASSED");
    }

    function _postDeploymentActions() internal {
        console.log("Executing post-deployment actions...");

        // Generate deployment artifacts
        _generateDeploymentArtifacts();

        // Update frontend configuration
        _generateFrontendConfig();

        // Contract verification (if enabled)
        if (config.verifyContracts) {
            _verifyContracts();
        }
    }

    function _generateDeploymentArtifacts() internal {
        console.log("Generating deployment artifacts...");

        string memory json = "deployment";
        vm.serializeAddress(json, "factory", deployed.factory);
        vm.serializeAddress(json, "router", deployed.router);
        vm.serializeAddress(json, "tokenFactory", deployed.tokenFactory);
        vm.serializeAddress(json, "testTokenA", deployed.testTokenA);
        vm.serializeAddress(json, "testTokenB", deployed.testTokenB);
        vm.serializeAddress(json, "testTokenC", deployed.testTokenC);
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeUint(json, "blockNumber", block.number);
        string memory finalJson = vm.serializeUint(json, "timestamp", block.timestamp);

        string memory fileName = string.concat("deployment-", vm.toString(block.chainid), ".json");
        vm.writeJson(finalJson, fileName);

        console.log("Deployment artifacts saved to:", fileName);
    }

    function _generateFrontendConfig() internal {
        console.log("Generating frontend configuration...");

        // Generate TypeScript configuration for frontend
        string memory tsConfig = string.concat(
            "// Auto-generated deployment configuration\n",
            "// Chain ID: ", vm.toString(block.chainid), "\n",
            "// Deployed at block: ", vm.toString(block.number), "\n\n",
            "export const CONTRACT_ADDRESSES = {\n",
            "  FACTORY: '", vm.toString(deployed.factory), "',\n",
            "  ROUTER: '", vm.toString(deployed.router), "',\n",
            "  TOKEN_FACTORY: '", vm.toString(deployed.tokenFactory), "',\n",
            "  TOKEN_A: '", vm.toString(deployed.testTokenA), "',\n",
            "  TOKEN_B: '", vm.toString(deployed.testTokenB), "',\n",
            "  TOKEN_C: '", vm.toString(deployed.testTokenC), "',\n",
            "} as const;\n\n",
            "export const CHAIN_ID = ", vm.toString(block.chainid), ";\n"
        );

        vm.writeFile("frontend-config.ts", tsConfig);
        console.log("Frontend configuration generated: frontend-config.ts");
    }

    function _verifyContracts() internal {
        console.log("Contract verification would be performed here");
        console.log("Note: Implement verification logic for specific block explorers");
    }

    function _printDeploymentSummary() internal view {
        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("Chain ID:", block.chainid);
        console.log("Block Number:", block.number);
        console.log("Deployer:", config.deployer);
        console.log("");
        console.log("Core Contracts:");
        console.log("  Factory:", deployed.factory);
        console.log("  Router:", deployed.router);
        console.log("  TokenFactory:", deployed.tokenFactory);
        console.log("");
        if (config.deployTestTokens) {
            console.log("Test Tokens:");
            console.log("  TestTokenA (TTA):", deployed.testTokenA);
            console.log("  TestTokenB (TTB):", deployed.testTokenB);
            console.log("  TestTokenC (TTC):", deployed.testTokenC);
            console.log("");
        }
        if (config.createInitialPairs) {
            console.log("Initial Pairs Created:", deployed.initialPairs.length);
            for (uint256 i = 0; i < deployed.initialPairs.length; i++) {
                console.log("  Pair", i + 1, ":", deployed.initialPairs[i]);
            }
        }
        console.log("==========================");
    }
}
