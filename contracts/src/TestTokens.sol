// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ERC20.sol";

/**
 * @title TestTokenA
 * @dev Test token A for DEX testing
 */
contract TestTokenA is ERC20 {
    constructor() ERC20("Test Token A", "TTA", 18, 1000000 * 10**18) {}
}

/**
 * @title TestTokenB
 * @dev Test token B for DEX testing
 */
contract TestTokenB is ERC20 {
    constructor() ERC20("Test Token B", "TTB", 18, 1000000 * 10**18) {}
}

/**
 * @title TestTokenC
 * @dev Test token C for DEX testing
 */
contract TestTokenC is ERC20 {
    constructor() ERC20("Test Token C", "TTC", 18, 1000000 * 10**18) {}
}
