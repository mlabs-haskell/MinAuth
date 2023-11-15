import {
  Permissions,
  DeployArgs,
  Field,
  SmartContract,
  State,
  state,
  method
} from 'o1js';

/**
 * A simple contract that stores a single field - the root of a Merkle tree.
 * Anyone can read the root, but only the owner of the contract private key can change it.
 */
export class TreeRootStorageContract extends SmartContract {
  @state(Field) treeRoot = State<Field>();

  /** o1js assumes that at least one method must be present */
  @method foo() {}
  deploy(args?: DeployArgs) {
    super.deploy(args);

    this.account.permissions.set({
      ...Permissions.allImpossible(),
      editState: Permissions.signature(),
      access: Permissions.signature()
    });
  }
}
