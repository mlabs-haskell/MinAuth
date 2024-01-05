export const IERC721_ABI = [
  // // ERC721 Metadata
  // "function name() view returns (string)",
  // "function symbol() view returns (string)",
  // "function tokenURI(uint256 tokenId) view returns (string)",

  // // ERC721 Enumerable
  // "function totalSupply() view returns (uint256)",
  // "function tokenByIndex(uint256 index) view returns (uint256)",
  // "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",

  // ERC721
  'function balanceOf(address owner) view returns (uint256 balance)',
  'function ownerOf(uint256 tokenId) view returns (address owner)',

  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address operator)',
  'function setApprovalForAll(address operator, bool _approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',

  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)'

  // // Events
  // "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  // "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
  // "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)"
];
