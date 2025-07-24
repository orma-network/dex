// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Factory.sol";
import "../src/Router.sol";
import "../src/Pair.sol";
import "../src/TestTokens.sol";

contract DEXTest is Test {
    Factory public factory;
    Router public router;
    TestTokenA public tokenA;
    TestTokenB public tokenB;
    TestTokenC public tokenC;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);
    
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    uint256 public constant LIQUIDITY_AMOUNT = 10000 * 10**18;
    
    function setUp() public {
        // Deploy contracts
        factory = new Factory(address(this));
        router = new Router(address(factory));
        
        // Deploy test tokens
        tokenA = new TestTokenA();
        tokenB = new TestTokenB();
        tokenC = new TestTokenC();
        
        // Transfer tokens to test accounts
        tokenA.transfer(alice, INITIAL_SUPPLY / 4);
        tokenB.transfer(alice, INITIAL_SUPPLY / 4);
        tokenC.transfer(alice, INITIAL_SUPPLY / 4);
        
        tokenA.transfer(bob, INITIAL_SUPPLY / 4);
        tokenB.transfer(bob, INITIAL_SUPPLY / 4);
        tokenC.transfer(bob, INITIAL_SUPPLY / 4);
        
        tokenA.transfer(charlie, INITIAL_SUPPLY / 4);
        tokenB.transfer(charlie, INITIAL_SUPPLY / 4);
        tokenC.transfer(charlie, INITIAL_SUPPLY / 4);
    }
    
    function testFactoryCreatePair() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pair);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
        assertEq(factory.allPairsLength(), 1);
        
        // Test that creating the same pair again fails
        vm.expectRevert("Factory: PAIR_EXISTS");
        factory.createPair(address(tokenA), address(tokenB));
    }
    
    function testAddLiquidity() public {
        vm.startPrank(alice);
        
        // Approve router to spend tokens
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        // Add initial liquidity
        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            alice,
            block.timestamp + 1000
        );
        
        assertEq(amountA, LIQUIDITY_AMOUNT);
        assertEq(amountB, LIQUIDITY_AMOUNT);
        assertGt(liquidity, 0);
        
        // Check pair was created
        address pair = factory.getPair(address(tokenA), address(tokenB));
        assertNotEq(pair, address(0));
        
        // Check LP tokens were minted
        assertEq(Pair(pair).balanceOf(alice), liquidity);
        
        vm.stopPrank();
    }
    
    function testSwapExactTokensForTokens() public {
        // First add liquidity
        vm.startPrank(alice);
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            alice,
            block.timestamp + 1000
        );
        vm.stopPrank();
        
        // Now test swap
        vm.startPrank(bob);
        uint256 swapAmount = 1000 * 10**18;
        tokenA.approve(address(router), swapAmount);
        
        uint256 balanceBefore = tokenB.balanceOf(bob);
        
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            swapAmount,
            0,
            path,
            bob,
            block.timestamp + 1000
        );
        
        uint256 balanceAfter = tokenB.balanceOf(bob);
        
        assertEq(amounts[0], swapAmount);
        assertGt(amounts[1], 0);
        assertEq(balanceAfter - balanceBefore, amounts[1]);
        
        vm.stopPrank();
    }
    
    function testRemoveLiquidity() public {
        // First add liquidity
        vm.startPrank(alice);
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        (,, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            alice,
            block.timestamp + 1000
        );
        
        // Now remove liquidity
        address pair = factory.getPair(address(tokenA), address(tokenB));
        Pair(pair).approve(address(router), liquidity);
        
        uint256 balanceABefore = tokenA.balanceOf(alice);
        uint256 balanceBBefore = tokenB.balanceOf(alice);
        
        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            0,
            0,
            alice,
            block.timestamp + 1000
        );
        
        uint256 balanceAAfter = tokenA.balanceOf(alice);
        uint256 balanceBAfter = tokenB.balanceOf(alice);
        
        assertEq(balanceAAfter - balanceABefore, amountA);
        assertEq(balanceBAfter - balanceBBefore, amountB);
        assertEq(Pair(pair).balanceOf(alice), 0);
        
        vm.stopPrank();
    }
    
    function testPriceImpact() public {
        // Add liquidity
        vm.startPrank(alice);
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            alice,
            block.timestamp + 1000
        );
        vm.stopPrank();
        
        // Test small swap (should have minimal price impact)
        vm.startPrank(bob);
        uint256 smallSwap = 100 * 10**18;
        tokenA.approve(address(router), smallSwap);
        
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        
        uint256[] memory smallAmounts = router.getAmountsOut(smallSwap, path);
        
        // Test large swap (should have significant price impact)
        uint256 largeSwap = 5000 * 10**18;
        tokenA.approve(address(router), largeSwap);
        
        uint256[] memory largeAmounts = router.getAmountsOut(largeSwap, path);
        
        // Large swap should have worse rate due to price impact
        uint256 smallRate = (smallAmounts[1] * 10**18) / smallAmounts[0];
        uint256 largeRate = (largeAmounts[1] * 10**18) / largeAmounts[0];
        
        assertLt(largeRate, smallRate);
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_InsufficientLiquidity() public {
        vm.startPrank(bob);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        // This should fail because no liquidity exists
        vm.expectRevert("Router: PAIR_DOES_NOT_EXIST");
        router.swapExactTokensForTokens(
            1000 * 10**18,
            0,
            path,
            bob,
            block.timestamp + 1000
        );

        vm.stopPrank();
    }

    function test_RevertWhen_ExpiredDeadline() public {
        vm.startPrank(alice);
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);

        // This should fail because deadline is in the past
        vm.expectRevert("Router: EXPIRED");
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            alice,
            block.timestamp - 1
        );

        vm.stopPrank();
    }
    
    function testMultiHopSwap() public {
        // Add liquidity for A-B pair
        vm.startPrank(alice);
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            alice,
            block.timestamp + 1000
        );
        
        // Add liquidity for B-C pair
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        
        router.addLiquidity(
            address(tokenB),
            address(tokenC),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            alice,
            block.timestamp + 1000
        );
        vm.stopPrank();
        
        // Test A -> B -> C swap
        vm.startPrank(bob);
        uint256 swapAmount = 1000 * 10**18;
        tokenA.approve(address(router), swapAmount);
        
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        uint256 balanceBefore = tokenC.balanceOf(bob);
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            swapAmount,
            0,
            path,
            bob,
            block.timestamp + 1000
        );
        
        uint256 balanceAfter = tokenC.balanceOf(bob);
        
        assertEq(amounts[0], swapAmount);
        assertGt(amounts[2], 0);
        assertEq(balanceAfter - balanceBefore, amounts[2]);
        
        vm.stopPrank();
    }
}
