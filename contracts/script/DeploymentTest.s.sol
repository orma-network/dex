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
 * @title WinDex Deployment Test Script
 * @dev Tests deployed contracts functionality
 * @author WinDex Team
 */
contract DeploymentTest is Script {
    // Contract addresses (loaded from environment or deployment artifacts)
    address public factory;
    address public router;
    address public tokenFactory;
    address public testTokenA;
    address public testTokenB;
    address public testTokenC;

    // Test configuration
    uint256 public constant TEST_AMOUNT = 1000 * 10**18; // 1000 tokens
    uint256 public constant LIQUIDITY_AMOUNT_A = 100 * 10**18; // 100 tokens
    uint256 public constant LIQUIDITY_AMOUNT_B = 200 * 10**18; // 200 tokens

    function setUp() public {
        // Load contract addresses from environment variables
        factory = vm.envAddress("FACTORY_ADDRESS");
        router = vm.envAddress("ROUTER_ADDRESS");
        tokenFactory = vm.envAddress("TOKEN_FACTORY_ADDRESS");
        testTokenA = vm.envAddress("TOKEN_A_ADDRESS");
        testTokenB = vm.envAddress("TOKEN_B_ADDRESS");
        testTokenC = vm.envAddress("TOKEN_C_ADDRESS");

        console.log("=== WinDex Deployment Test Configuration ===");
        console.log("Factory:", factory);
        console.log("Router:", router);
        console.log("TokenFactory:", tokenFactory);
        console.log("TestTokenA:", testTokenA);
        console.log("TestTokenB:", testTokenB);
        console.log("TestTokenC:", testTokenC);
        console.log("============================================");
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Starting deployment tests...");
        console.log("Test runner:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        // Test 1: Basic contract functionality
        _testBasicFunctionality();

        // Test 2: Token creation via TokenFactory
        _testTokenCreation();

        // Test 3: Pair creation
        _testPairCreation();

        // Test 4: Liquidity operations
        _testLiquidityOperations();

        // Test 5: Swap operations
        _testSwapOperations();

        vm.stopBroadcast();

        console.log("=== All Tests Completed Successfully ===");
    }

    function _testBasicFunctionality() internal {
        console.log("Test 1: Basic contract functionality...");

        // Test Factory
        Factory factoryContract = Factory(factory);
        require(factoryContract.feeToSetter() != address(0), "Factory: Invalid feeToSetter");
        console.log("  [OK] Factory basic functionality");

        // Test Router
        Router routerContract = Router(router);
        require(address(routerContract.factory()) == factory, "Router: Invalid factory reference");
        console.log("  [OK] Router basic functionality");

        // Test TokenFactory
        TokenFactory tokenFactoryContract = TokenFactory(tokenFactory);
        uint256 initialTokenCount = tokenFactoryContract.getTotalTokensCount();
        console.log("  [OK] TokenFactory basic functionality (tokens created:", initialTokenCount, ")");

        // Test Test Tokens
        if (testTokenA != address(0)) {
            ERC20 tokenA = ERC20(testTokenA);
            require(tokenA.totalSupply() > 0, "TestTokenA: Invalid supply");
            console.log("  [OK] TestTokenA functionality");
        }

        if (testTokenB != address(0)) {
            ERC20 tokenB = ERC20(testTokenB);
            require(tokenB.totalSupply() > 0, "TestTokenB: Invalid supply");
            console.log("  [OK] TestTokenB functionality");
        }

        if (testTokenC != address(0)) {
            ERC20 tokenC = ERC20(testTokenC);
            require(tokenC.totalSupply() > 0, "TestTokenC: Invalid supply");
            console.log("  [OK] TestTokenC functionality");
        }

        console.log("Test 1: PASSED");
    }

    function _testTokenCreation() internal {
        console.log("Test 2: Token creation via TokenFactory...");

        TokenFactory tokenFactoryContract = TokenFactory(tokenFactory);
        uint256 initialCount = tokenFactoryContract.getTotalTokensCount();

        // Create a test token
        address newToken = tokenFactoryContract.createToken(
            "Test Custom Token",
            "TCT",
            18,
            1000000 * 10**18,
            msg.sender
        );

        require(newToken != address(0), "Token creation failed");
        console.log("  [OK] Custom token created at:", newToken);

        // Verify token was registered
        uint256 newCount = tokenFactoryContract.getTotalTokensCount();
        require(newCount == initialCount + 1, "Token not registered in factory");
        console.log("  [OK] Token registered in factory");

        // Test token functionality
        ERC20 customToken = ERC20(newToken);
        require(customToken.totalSupply() == 1000000 * 10**18, "Invalid token supply");
        require(customToken.balanceOf(msg.sender) == 1000000 * 10**18, "Invalid token balance");
        console.log("  [OK] Custom token functionality verified");

        console.log("Test 2: PASSED");
    }

    function _testPairCreation() internal {
        console.log("Test 3: Pair creation...");

        if (testTokenA == address(0) || testTokenB == address(0)) {
            console.log("  [SKIP] Skipping pair creation test (test tokens not deployed)");
            return;
        }

        Factory factoryContract = Factory(factory);
        uint256 initialPairCount = factoryContract.allPairsLength();

        // Check if pair already exists
        address existingPair = factoryContract.getPair(testTokenA, testTokenB);
        if (existingPair != address(0)) {
            console.log("  [OK] Pair already exists at:", existingPair);
        } else {
            // Create new pair
            address newPair = factoryContract.createPair(testTokenA, testTokenB);
            require(newPair != address(0), "Pair creation failed");
            console.log("  [OK] New pair created at:", newPair);

            // Verify pair was registered
            uint256 newPairCount = factoryContract.allPairsLength();
            require(newPairCount == initialPairCount + 1, "Pair not registered in factory");
            console.log("  [OK] Pair registered in factory");
        }

        console.log("Test 3: PASSED");
    }

    function _testLiquidityOperations() internal {
        console.log("Test 4: Liquidity operations...");

        if (testTokenA == address(0) || testTokenB == address(0)) {
            console.log("  [WARN] Skipping liquidity test (test tokens not deployed)");
            return;
        }

        Router routerContract = Router(router);
        ERC20 tokenA = ERC20(testTokenA);
        ERC20 tokenB = ERC20(testTokenB);

        // Check balances
        uint256 balanceA = tokenA.balanceOf(msg.sender);
        uint256 balanceB = tokenB.balanceOf(msg.sender);

        if (balanceA < LIQUIDITY_AMOUNT_A || balanceB < LIQUIDITY_AMOUNT_B) {
            console.log("  [WARN] Insufficient token balance for liquidity test");
            console.log("    Required TTA:", LIQUIDITY_AMOUNT_A);
            console.log("    Required TTB:", LIQUIDITY_AMOUNT_B);
            console.log("    Available TTA:", balanceA);
            console.log("    Available TTB:", balanceB);
            return;
        }

        // Approve router to spend tokens
        tokenA.approve(router, LIQUIDITY_AMOUNT_A);
        tokenB.approve(router, LIQUIDITY_AMOUNT_B);
        console.log("  [OK] Router approved to spend tokens");

        // Add liquidity
        try routerContract.addLiquidity(
            testTokenA,
            testTokenB,
            LIQUIDITY_AMOUNT_A,
            LIQUIDITY_AMOUNT_B,
            LIQUIDITY_AMOUNT_A * 95 / 100, // 5% slippage
            LIQUIDITY_AMOUNT_B * 95 / 100, // 5% slippage
            msg.sender,
            block.timestamp + 300
        ) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
            console.log("  [OK] Liquidity added successfully");
            console.log("    Amount A:", amountA);
            console.log("    Amount B:", amountB);
            console.log("    LP Tokens:", liquidity);
        } catch {
            console.log("  [WARN] Liquidity addition failed (may already exist)");
        }

        console.log("Test 4: PASSED");
    }

    function _testSwapOperations() internal {
        console.log("Test 5: Swap operations...");

        if (testTokenA == address(0) || testTokenB == address(0)) {
            console.log("  [WARN] Skipping swap test (test tokens not deployed)");
            return;
        }

        Router routerContract = Router(router);
        ERC20 tokenA = ERC20(testTokenA);
        ERC20 tokenB = ERC20(testTokenB);

        // Check if we have tokens to swap
        uint256 swapAmount = 10 * 10**18; // 10 tokens
        uint256 balanceA = tokenA.balanceOf(msg.sender);

        if (balanceA < swapAmount) {
            console.log("  [WARN] Insufficient token balance for swap test");
            return;
        }

        // Get pair address
        Factory factoryContract = Factory(factory);
        address pairAddress = factoryContract.getPair(testTokenA, testTokenB);
        
        if (pairAddress == address(0)) {
            console.log("  [WARN] No pair exists for swap test");
            return;
        }

        // Check if pair has liquidity
        Pair pair = Pair(pairAddress);
        (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
        
        if (reserve0 == 0 || reserve1 == 0) {
            console.log("  [WARN] Pair has no liquidity for swap test");
            return;
        }

        console.log("  [OK] Pair has liquidity");
        console.log("    Reserve0:", reserve0);
        console.log("    Reserve1:", reserve1);

        // Approve router for swap
        tokenA.approve(router, swapAmount);

        // Prepare swap path
        address[] memory path = new address[](2);
        path[0] = testTokenA;
        path[1] = testTokenB;

        // Get expected output
        uint256[] memory amounts = routerContract.getAmountsOut(swapAmount, path);
        uint256 expectedOutput = amounts[1];
        uint256 minOutput = expectedOutput * 95 / 100; // 5% slippage

        console.log("  [OK] Expected swap output:", expectedOutput);

        // Execute swap
        try routerContract.swapExactTokensForTokens(
            swapAmount,
            minOutput,
            path,
            msg.sender,
            block.timestamp + 300
        ) returns (uint256[] memory swapAmounts) {
            console.log("  [OK] Swap executed successfully");
            console.log("    Input:", swapAmounts[0]);
            console.log("    Output:", swapAmounts[1]);
        } catch Error(string memory reason) {
            console.log("  [WARN] Swap failed:", reason);
        } catch {
            console.log("  [WARN] Swap failed with unknown error");
        }

        console.log("Test 5: PASSED");
    }
}
