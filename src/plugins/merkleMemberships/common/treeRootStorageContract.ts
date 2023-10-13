import {
  Permissions,
  DeployArgs,
  Field,
  SmartContract,
  State,
  state
} from 'o1js';

export class TreeRootStorageContract extends SmartContract {
  @state(Field) treeRoot = State<Field>();

  deploy(args?: DeployArgs) {
    super.deploy(args);

    this.account.permissions.set({
      ...Permissions.allImpossible(),
      editState: Permissions.signature(),
      access: Permissions.signature()
    });
  }
}
