// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ERC20.sol";

/**
 * @title TokenFactory
 * @dev Factory contract for creating custom ERC-20 tokens
 */
contract TokenFactory {
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint8 decimals,
        uint256 initialSupply
    );

    struct TokenInfo {
        address tokenAddress;
        address creator;
        string name;
        string symbol;
        uint8 decimals;
        uint256 initialSupply;
        uint256 createdAt;
    }

    mapping(address => address[]) public tokensByCreator;
    mapping(address => TokenInfo) public tokenInfo;
    address[] public allTokens;

    /**
     * @dev Create a new ERC-20 token
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @param initialSupply Initial token supply
     * @param owner Token owner
     * @return tokenAddress Address of the created token
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 initialSupply,
        address owner
    ) external returns (address tokenAddress) {
        // Deploy new ERC20 token
        ERC20 newToken = new ERC20(name, symbol, decimals, initialSupply);
        tokenAddress = address(newToken);

        // Transfer ownership to the specified owner
        if (owner != address(this)) {
            // Transfer all tokens to the owner
            newToken.transfer(owner, initialSupply);
        }

        // Store token information
        TokenInfo memory info = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            name: name,
            symbol: symbol,
            decimals: decimals,
            initialSupply: initialSupply,
            createdAt: block.timestamp
        });

        tokenInfo[tokenAddress] = info;
        tokensByCreator[msg.sender].push(tokenAddress);
        allTokens.push(tokenAddress);

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, decimals, initialSupply);
    }

    /**
     * @dev Get tokens created by a specific address
     * @param creator Creator address
     * @return Array of token addresses
     */
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return tokensByCreator[creator];
    }

    /**
     * @dev Get all deployed tokens
     * @return Array of token addresses
     */
    function getDeployedTokens() external view returns (address[] memory) {
        return allTokens;
    }

    /**
     * @dev Get total number of tokens created
     * @return Total token count
     */
    function getTotalTokensCount() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @dev Get detailed information about all tokens
     * @return Array of TokenInfo structs
     */
    function getAllTokensInfo() external view returns (TokenInfo[] memory) {
        TokenInfo[] memory tokens = new TokenInfo[](allTokens.length);
        for (uint256 i = 0; i < allTokens.length; i++) {
            tokens[i] = tokenInfo[allTokens[i]];
        }
        return tokens;
    }

    /**
     * @dev Get token information by address
     * @param tokenAddress Token address
     * @return TokenInfo struct
     */
    function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory) {
        return tokenInfo[tokenAddress];
    }
}
